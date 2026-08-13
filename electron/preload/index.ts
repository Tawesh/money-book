/**
 * 预加载脚本：通过 contextBridge 暴露白名单 API window.moneyBook
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { ApiResponse, MoneyBookApi } from '../shared/types';

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, payload)) as ApiResponse<T>;
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
};

contextBridge.exposeInMainWorld('moneyBook', api);

// 类型声明（供渲染进程使用）
declare global {
  interface Window {
    moneyBook: MoneyBookApi;
  }
}
