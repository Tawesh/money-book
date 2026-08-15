/**
 * 预加载脚本：通过 contextBridge 暴露白名单 API window.moneyBook
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { ApiResponse, MoneyBookApi, UpdaterStatus } from '../shared/types';

/**
 * IPC 调用包装：
 * - 对 payload 做 JSON 深拷贝，把 Vue 3 reactive/ref（Proxy）对象转为普通对象，
 *   避免 "An object could not be cloned"（V8 结构化克隆无法克隆 Proxy）
 */
async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const safePayload = payload === undefined ? undefined : JSON.parse(JSON.stringify(payload));
  const res = (await ipcRenderer.invoke(channel, safePayload)) as ApiResponse<T>;
  if (res.code !== 0) {
    throw new Error(res.message || '操作失败');
  }
  return res.data;
}

const api: MoneyBookApi = {
  ledger: {
    list: () => invoke('moneybook:ledger:list'),
    create: (name, icon, currency) => invoke('moneybook:ledger:create', { name, icon, currency }),
    update: (id, data) => invoke('moneybook:ledger:update', { id, data }),
    remove: (id) => invoke('moneybook:ledger:remove', { id }),
  },
  account: {
    list: (ledgerId) => invoke('moneybook:account:list', { ledger_id: ledgerId }),
    create: (data) => invoke('moneybook:account:create', data),
    update: (id, data) => invoke('moneybook:account:update', { id, data }),
    remove: (id) => invoke('moneybook:account:remove', { id }),
  },
  category: {
    list: (ledgerId, kind) => invoke('moneybook:category:list', { ledger_id: ledgerId, kind }),
    create: (data) => invoke('moneybook:category:create', data),
    update: (id, data) => invoke('moneybook:category:update', { id, data }),
    remove: (id) => invoke('moneybook:category:remove', { id }),
  },
  transaction: {
    list: (query) => invoke('moneybook:transaction:list', query),
    create: (data) => invoke('moneybook:transaction:create', data),
    update: (id, data) => invoke('moneybook:transaction:update', { id, data }),
    remove: (id) => invoke('moneybook:transaction:delete', { id }),
  },
  report: {
    summary: (ledgerId, year, month) => invoke('moneybook:report:summary', { ledger_id: ledgerId, year, month }),
  },
  budget: {
    get: (ledgerId, year, month) => invoke('moneybook:budget:get', { ledger_id: ledgerId, year, month }),
    save: (data) => invoke('moneybook:budget:save', data),
  },
  recurring: {
    list: (ledgerId) => invoke('moneybook:recurring:list', { ledger_id: ledgerId }),
    create: (data) => invoke('moneybook:recurring:create', data),
    update: (id, data) => invoke('moneybook:recurring:update', { id, data }),
    remove: (id) => invoke('moneybook:recurring:remove', { id }),
    runDue: () => invoke('moneybook:recurring:runDue'),
  },
  currency: {
    list: () => invoke('moneybook:currency:list'),
    add: (code, name, symbol, rate) => invoke('moneybook:currency:add', { code, name, symbol, rate }),
    updateRate: (code, rate) => invoke('moneybook:currency:updateRate', { code, rate }),
    remove: (code) => invoke('moneybook:currency:remove', { code }),
    convert: (amount, from, to) => invoke('moneybook:currency:convert', { amount, from, to }),
  },
  tag: {
    list: (ledgerId) => invoke('moneybook:tag:list', { ledger_id: ledgerId }),
    create: (data) => invoke('moneybook:tag:create', data),
    update: (id, data) => invoke('moneybook:tag:update', { id, data }),
    remove: (id) => invoke('moneybook:tag:remove', { id }),
  },
  system: {
    getSettings: () => invoke('moneybook:system:getSettings'),
    setSettings: (data) => invoke('moneybook:system:setSettings', data),
    export: (ledgerId, format) => invoke('moneybook:system:export', { ledger_id: ledgerId, format }),
    import: (filePath, ledgerId) => invoke('moneybook:system:import', { file_path: filePath, ledger_id: ledgerId }),
    backup: () => invoke('moneybook:system:backup'),
    setAppLock: (password) => invoke('moneybook:system:setAppLock', { password }),
    unlock: (password) => invoke('moneybook:system:unlock', { password }),
    isLocked: () => invoke('moneybook:system:isLocked'),
    selectFile: (filters) => invoke('moneybook:system:selectFile', { filters }),
    selectDirectory: () => invoke('moneybook:system:selectDirectory'),
    getVersion: () => invoke('moneybook:system:getVersion'),
  },
  tray: {
    onQuickAdd: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('moneybook:tray:quick-add', listener);
      return () => ipcRenderer.removeListener('moneybook:tray:quick-add', listener);
    },
  },
  updater: {
    check: () => invoke('moneybook:updater:check'),
    download: () => invoke('moneybook:updater:download'),
    quitAndInstall: () => invoke('moneybook:updater:quitAndInstall'),
    getStatus: () => invoke('moneybook:updater:getStatus'),
    onStatus: (callback) => {
      const listener = (_event: unknown, status: UpdaterStatus) => callback(status);
      ipcRenderer.on('moneybook:updater:status', listener);
      return () => ipcRenderer.removeListener('moneybook:updater:status', listener);
    },
  },
};

contextBridge.exposeInMainWorld('moneyBook', api);

// 类型声明（供渲染进程使用）
declare global {
  interface Window {
    moneyBook: MoneyBookApi;
  }
}
