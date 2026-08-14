/**
 * 系统托盘服务
 * 提供：托盘图标、右键菜单（显隐窗口 / 快速记账 / 本月收支 / 退出）、左键单击切换窗口
 */
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import path from 'node:path';
import type { NativeImage } from 'electron';
import { getDb } from '../db/database';
import { getSettings } from './system.service';
import { listLedgers } from './ledger.service';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
/** 用户主动退出标志：为 true 时放行窗口关闭（真正退出应用） */
let isQuitting = false;
/** 定时刷新菜单（用于更新本月收支） */
let refreshTimer: NodeJS.Timeout | null = null;
/** 窗口被销毁后需要重新创建窗口的回调（由主进程注入） */
let recreateWindow: (() => void) | null = null;

// ============ 标志位 ============

export function setQuitting(flag: boolean): void {
  isQuitting = flag;
}

export function isQuittingFlag(): boolean {
  return isQuitting;
}

export function hasTray(): boolean {
  return !!tray;
}

/** 注入“重新创建主窗口”的回调（窗口被关闭销毁后，从托盘重新打开时使用） */
export function setRecreateHandler(fn: () => void): void {
  recreateWindow = fn;
}

// ============ 托盘图标 ============

function trayIcon(): NativeImage {
  const base = path.join(app.getAppPath(), 'resources');
  const icoPath = path.join(base, 'icon.ico');
  let img = nativeImage.createFromPath(icoPath);
  if (img.isEmpty()) {
    img = nativeImage.createFromPath(path.join(base, 'icon.png'));
  }
  if (img.isEmpty()) return img;
  // 使用 ICO 时直接返回（内含多尺寸），否则生成 16/32 双分辨率表示
  if (icoPath.endsWith('.ico') && nativeImage.createFromPath(icoPath).getSize().width > 0) {
    return img;
  }
  const composed = nativeImage.createEmpty();
  composed.addRepresentation({
    scaleFactor: 1,
    width: 16,
    height: 16,
    buffer: img.resize({ width: 16, height: 16 }).toPNG(),
  });
  composed.addRepresentation({
    scaleFactor: 2,
    width: 32,
    height: 32,
    buffer: img.resize({ width: 32, height: 32 }).toPNG(),
  });
  return composed.isEmpty() ? img : composed;
}

// ============ 本月收支 ============

interface MonthSummary {
  ledgerName: string;
  income: number;
  expense: number;
}

function currentMonthSummary(): MonthSummary | null {
  try {
    const db = getDb();
    const settings = getSettings();
    const ledgers = listLedgers();
    if (ledgers.length === 0) return null;
    const ledgerId =
      settings.last_ledger_id && ledgers.some((l) => l.id === settings.last_ledger_id)
        ? settings.last_ledger_id
        : ledgers[0].id;
    const ledger = ledgers.find((l) => l.id === ledgerId);
    if (!ledger) return null;

    const d = new Date();
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 1 THEN amount ELSE 0 END), 0) AS expense,
           COALESCE(SUM(CASE WHEN type = 2 THEN amount ELSE 0 END), 0) AS income
         FROM transactions
         WHERE ledger_id = ? AND happened_at LIKE ?`
      )
      .get(ledgerId, `${prefix}%`) as { expense: number; income: number };
    return { ledgerName: ledger.name, income: row.income, expense: row.expense };
  } catch {
    return null;
  }
}

function formatMoney(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============ 窗口控制 ============

/** 绑定主窗口（主进程创建窗口后调用） */
export function bindWindow(win: BrowserWindow): void {
  mainWindow = win;
}

/** 显示并聚焦主窗口（若已销毁则重建） */
export function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    recreateWindow?.();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  refreshTrayMenu();
}

function hideWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

/** 左键单击：切换显示/隐藏 */
export function toggleWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused()) {
    hideWindow();
  } else {
    showWindow();
  }
}

/** 快速记账：显示窗口并通知渲染进程跳转到记账页 */
function quickAdd(): void {
  showWindow();
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  const notify = () => win.webContents.send('moneybook:tray:quick-add');
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', notify);
  } else {
    notify();
  }
}

/** 真正退出应用 */
function quitApp(): void {
  isQuitting = true;
  app.quit();
}

// ============ 菜单 ============

function buildMenu(): Menu {
  const summary = currentMonthSummary();
  const visible = !!mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: visible ? '隐藏主窗口' : '显示主窗口',
      click: () => toggleWindow(),
    },
    {
      label: '✏️ 快速记账',
      click: () => quickAdd(),
    },
    { type: 'separator' },
  ];

  if (summary) {
    items.push(
      { label: `账本：${summary.ledgerName}`, enabled: false },
      { label: `本月收入：¥ ${formatMoney(summary.income)}`, enabled: false },
      { label: `本月支出：¥ ${formatMoney(summary.expense)}`, enabled: false },
      { type: 'separator' }
    );
  }

  items.push({
    label: '退出 MoneyBook',
    click: () => quitApp(),
  });

  return Menu.buildFromTemplate(items);
}

/** 刷新托盘右键菜单（收支数据变化后调用） */
export function refreshTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(buildMenu());
}

// ============ 生命周期 ============

/** 创建托盘（设置中启用了托盘时由主进程调用） */
export function createTray(win: BrowserWindow): void {
  mainWindow = win;
  if (tray) {
    refreshTrayMenu();
    return;
  }
  tray = new Tray(trayIcon());
  tray.setToolTip('MoneyBook 个人记账本');
  // Windows：左键单击切换窗口；双击显示窗口
  tray.on('click', () => toggleWindow());
  tray.on('double-click', () => showWindow());
  refreshTrayMenu();
  refreshTimer = setInterval(() => refreshTrayMenu(), 60_000);
}

/** 销毁托盘 */
export function destroyTray(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  tray?.destroy();
  tray = null;
}

/** 根据设置同步托盘状态（设置变更后调用） */
export function syncTray(win?: BrowserWindow): void {
  if (win) mainWindow = win;
  const settings = getSettings();
  if (settings.tray_enabled) {
    if (!tray && mainWindow) {
      createTray(mainWindow);
    } else {
      refreshTrayMenu();
    }
  } else {
    destroyTray();
  }
}
