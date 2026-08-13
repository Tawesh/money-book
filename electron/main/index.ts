/**
 * 主进程入口：创建窗口、初始化数据库、注册 IPC、启动周期账单检查
 */
import { app, BrowserWindow, nativeTheme } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase } from './db/database';
import { registerIpcHandlers } from './ipc';
import { runDueRecurring } from './services/recurring.service';
import { getSettings } from './services/system.service';
import { ensureInitialData } from './services/init.service';
import { runSmokeTest } from './smoke';

let mainWindow: BrowserWindow | null = null;

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// 冒烟测试模式：使用独立数据目录
if (process.env.MONEYBOOK_SMOKE && process.env.MONEYBOOK_USER_DATA) {
  const testDir = path.resolve(process.env.MONEYBOOK_USER_DATA);
  fs.mkdirSync(testDir, { recursive: true });
  app.setPath('userData', testDir);
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

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
