/**
 * 主进程入口：创建窗口、初始化数据库、注册 IPC、启动周期账单检查、系统托盘
 */
import { app, BrowserWindow, nativeTheme } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase } from './db/database';
import { registerIpcHandlers } from './ipc';
import { runDueRecurring } from './services/recurring.service';
import { getSettings } from './services/system.service';
import { ensureInitialData } from './services/init.service';
import * as trayService from './services/tray.service';
import { runSmokeTest } from './smoke';

let mainWindow: BrowserWindow | null = null;

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// 冒烟测试模式：使用独立数据目录
if (process.env.MONEYBOOK_SMOKE && process.env.MONEYBOOK_USER_DATA) {
  const testDir = path.resolve(process.env.MONEYBOOK_USER_DATA);
  fs.mkdirSync(testDir, { recursive: true });
  app.setPath('userData', testDir);
}

// 单实例：托盘应用只允许一个实例
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'MoneyBook 个人记账本',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload 中需要 require
    },
  });

  trayService.bindWindow(mainWindow);

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // 关闭窗口：若启用“关闭到托盘”则隐藏而非退出
  mainWindow.on('close', (e) => {
    if (trayService.isQuittingFlag()) return; // 用户主动退出，放行
    const settings = getSettings();
    if (settings.tray_enabled && settings.close_to_tray && trayService.hasTray()) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  // 最小化：若启用“最小化到托盘”则隐藏到托盘
  mainWindow.on('minimize', () => {
    const settings = getSettings();
    if (settings.tray_enabled && settings.minimize_to_tray && trayService.hasTray()) {
      // 延迟执行，等待最小化动画完成后隐藏，避免任务栏图标闪烁
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
      }, 120);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** 应用主题联动 */
function applyTheme(): void {
  const settings = getSettings();
  if (settings.theme === 'dark') nativeTheme.themeSource = 'dark';
  else if (settings.theme === 'light') nativeTheme.themeSource = 'light';
  else nativeTheme.themeSource = 'system';
}

app.whenReady().then(() => {
  // 冒烟测试模式：跑完即退出
  if (process.env.MONEYBOOK_SMOKE) {
    runSmokeTest();
    return;
  }

  // 未获得单实例锁（已有实例在运行），直接退出
  if (!gotTheLock) {
    app.quit();
    return;
  }

  initDatabase();
  registerIpcHandlers();
  applyTheme();

  // 首次启动：确保有默认账本与基础账户（保证开箱即可记账）
  try {
    ensureInitialData();
  } catch (e) {
    console.error('ensureInitialData failed:', e);
  }

  // 启动时处理到期周期账单
  try {
    runDueRecurring();
  } catch (e) {
    console.error('run recurring failed:', e);
  }

  createWindow();

  // 启用系统托盘（根据设置）
  trayService.setRecreateHandler(createWindow);
  trayService.syncTray(mainWindow ?? undefined);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // 第二个实例启动时：显示主窗口
  app.on('second-instance', () => {
    trayService.showWindow();
  });
});

app.on('window-all-closed', () => {
  // 托盘存在时保持应用驻留，仅当托盘不可用（或未启用）时才退出
  if (process.platform !== 'darwin' && !trayService.hasTray()) {
    app.quit();
  }
});

// 应用退出前清理托盘
app.on('before-quit', () => {
  trayService.setQuitting(true);
  trayService.destroyTray();
});
