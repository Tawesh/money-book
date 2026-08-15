/**
 * 应用自动更新服务
 * 基于 electron-updater + GitHub Releases：
 *  - 打包后的正式版本启动时自动检查更新
 *  - 发现新版本后由渲染进程提示用户，确认后后台下载
 *  - 下载完成后提示“重启安装”
 *
 * 开发环境（npm run dev / dev:electron）不会触发任何更新逻辑。
 */
import { app, BrowserWindow } from 'electron';
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let initialized = false;

/** 是否正在下载更新（防止重复下载） */
let downloading = false;

// 不自动下载，先通知渲染进程让用户确认；应用退出时自动安装已下载的更新
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

/** 向渲染进程推送更新状态事件 */
function emit(state: UpdaterState, payload: Record<string, unknown> = {}): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('moneybook:updater:status', { state, ...payload });
  }
}

export type UpdaterState =
  | 'idle'
  | 'checking' // 正在检查更新
  | 'available' // 发现新版本
  | 'not-available' // 当前已是最新
  | 'downloading' // 正在下载
  | 'downloaded' // 下载完成，可重启安装
  | 'error'; // 检查/下载出错

export interface UpdaterStatus {
  state: UpdaterState;
  version?: string;
  currentVersion?: string;
  percent?: number;
  message?: string;
}

/**
 * 初始化更新服务（主窗口创建后调用）。
 * 仅在打包后的正式版本中启用自动更新；开发环境直接跳过。
 */
export function initUpdater(win: BrowserWindow): void {
  mainWindow = win;

  if (initialized) return;
  if (!app.isPackaged) {
    console.log('[updater] 开发环境，跳过自动更新检查');
    return;
  }
  initialized = true;

  // electron-updater 默认回退使用 console 输出日志
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    emit('checking');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    downloading = false;
    emit('available', {
      version: info.version,
      currentVersion: app.getVersion(),
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    emit('not-available', { version: info.version });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    emit('downloading', { percent: Math.round(progress.percent * 10) / 10 });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    downloading = false;
    emit('downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err: Error) => {
    downloading = false;
    emit('error', { message: err?.message ?? String(err) });
  });

  // 启动后延迟数秒再静默检查更新，避免干扰首次启动流程
  setTimeout(() => {
    checkForUpdates().catch((err) => {
      console.error('[updater] 启动自动检查失败:', err);
    });
  }, 5000);
}

/** 手动检查更新（渲染进程可调用，如设置页的“检查更新”按钮） */
export async function checkForUpdates(): Promise<UpdaterStatus> {
  if (!app.isPackaged) {
    return { state: 'not-available', currentVersion: app.getVersion() };
  }
  try {
    emit('checking');
    await autoUpdater.checkForUpdates();
    return { state: 'checking', currentVersion: app.getVersion() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit('error', { message });
    return { state: 'error', message };
  }
}

/** 下载更新（渲染进程确认后调用） */
export async function downloadUpdate(): Promise<UpdaterStatus> {
  if (downloading) {
    return { state: 'downloading', percent: 0 };
  }
  downloading = true;
  try {
    await autoUpdater.downloadUpdate();
    downloading = false;
    return { state: 'downloaded' };
  } catch (err) {
    downloading = false;
    const message = err instanceof Error ? err.message : String(err);
    emit('error', { message });
    return { state: 'error', message };
  }
}

/** 退出并安装更新 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true);
}

/** 查询当前更新状态（供渲染进程初始化时同步 UI） */
export function getStatus(): UpdaterStatus {
  return { state: 'idle', currentVersion: app.getVersion() };
}
