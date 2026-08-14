/**
 * IPC 路由：将渲染进程的 window.moneyBook.* 调用分发到服务层
 * 统一响应格式 { code, message, data }
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { ApiResponse, TransactionQuery } from '../../shared/types';
import * as ledgerService from '../services/ledger.service';
import * as accountService from '../services/account.service';
import * as categoryService from '../services/category.service';
import * as transactionService from '../services/transaction.service';
import * as reportService from '../services/report.service';
import * as budgetService from '../services/budget.service';
import * as recurringService from '../services/recurring.service';
import * as systemService from '../services/system.service';
import * as trayService from '../services/tray.service';

function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, message: 'ok', data };
}

function fail(error: unknown): ApiResponse<null> {
  const message = error instanceof Error ? error.message : String(error);
  return { code: 500, message, data: null };
}

type Handler = (payload: unknown, win: BrowserWindow) => unknown;

function register(channel: string, handler: Handler): void {
  ipcMain.handle(channel, async (event, payload) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const data = await handler(payload, win!);
      return ok(data);
    } catch (e) {
      return fail(e);
    }
  });
}

/** 注册全部 IPC handler（主进程启动时调用） */
export function registerIpcHandlers(): void {
  // ===== 账本 =====
  register('moneybook:ledger:list', () => ledgerService.listLedgers());
  register('moneybook:ledger:create', (p) => {
    const { name, icon, currency } = p as { name: string; icon?: string; currency?: string };
    if (!name) throw new Error('账本名称不能为空');
    return ledgerService.createLedger({ name, icon, currency });
  });
  register('moneybook:ledger:update', (p) => {
    const { id, data } = p as { id: number; data: Partial<never> };
    return ledgerService.updateLedger(id, data);
  });
  register('moneybook:ledger:remove', (p) => {
    const { id } = p as { id: number };
    return ledgerService.removeLedger(id);
  });

  // ===== 账户 =====
  register('moneybook:account:list', (p) => {
    const { ledger_id } = p as { ledger_id: number };
    return accountService.listAccounts(ledger_id);
  });
  register('moneybook:account:create', (p) => accountService.createAccount(p as never));
  register('moneybook:account:update', (p) => {
    const { id, data } = p as { id: number; data: Partial<never> };
    return accountService.updateAccount(id, data);
  });
  register('moneybook:account:remove', (p) => {
    const { id } = p as { id: number };
    return accountService.removeAccount(id);
  });

  // ===== 分类 =====
  register('moneybook:category:list', (p) => {
    const { ledger_id, kind } = p as { ledger_id: number; kind?: 'expense' | 'income' };
    return categoryService.listCategories(ledger_id, kind);
  });
  register('moneybook:category:create', (p) => categoryService.createCategory(p as never));
  register('moneybook:category:update', (p) => {
    const { id, data } = p as { id: number; data: Partial<never> };
    return categoryService.updateCategory(id, data);
  });
  register('moneybook:category:remove', (p) => {
    const { id } = p as { id: number };
    return categoryService.removeCategory(id);
  });

  // ===== 流水 =====
  register('moneybook:transaction:list', (p) => transactionService.listTransactions(p as TransactionQuery));
  register('moneybook:transaction:create', (p) => transactionService.createTransaction(p as never));
  register('moneybook:transaction:update', (p) => {
    const { id, data } = p as { id: number; data: never };
    return transactionService.updateTransaction(id, data);
  });
  register('moneybook:transaction:delete', (p) => {
    const { id } = p as { id: number };
    return transactionService.deleteTransaction(id);
  });

  // ===== 报表 =====
  register('moneybook:report:summary', (p) => {
    const { ledger_id, year, month } = p as { ledger_id: number; year: number; month: number };
    return reportService.reportSummary(ledger_id, year, month);
  });

  // ===== 预算 =====
  register('moneybook:budget:get', (p) => {
    const { ledger_id, year, month } = p as { ledger_id: number; year: number; month: number };
    return budgetService.getBudgetWithUsage(ledger_id, year, month);
  });
  register('moneybook:budget:save', (p) => budgetService.saveBudget(p as never));

  // ===== 周期账单 =====
  register('moneybook:recurring:list', (p) => {
    const { ledger_id } = p as { ledger_id: number };
    return recurringService.listRecurringRules(ledger_id);
  });
  register('moneybook:recurring:create', (p) => recurringService.createRecurringRule(p as never));
  register('moneybook:recurring:update', (p) => {
    const { id, data } = p as { id: number; data: never };
    return recurringService.updateRecurringRule(id, data);
  });
  register('moneybook:recurring:remove', (p) => {
    const { id } = p as { id: number };
    return recurringService.removeRecurringRule(id);
  });
  register('moneybook:recurring:runDue', () => recurringService.runDueRecurring());

  // ===== 系统 =====
  register('moneybook:system:getSettings', () => systemService.getSettings());
  register('moneybook:system:setSettings', (p) => {
    const next = systemService.setSettings(p as never);
    // 设置变更后同步托盘状态（启用/禁用托盘）
    trayService.syncTray();
    return next;
  });
  register('moneybook:system:export', (p) => {
    const { ledger_id, format } = p as { ledger_id: number; format: 'csv' | 'json' };
    return systemService.exportData(ledger_id, format);
  });
  register('moneybook:system:import', (p) => {
    const { file_path, ledger_id } = p as { file_path: string; ledger_id: number };
    return systemService.importData(file_path, ledger_id);
  });
  register('moneybook:system:backup', () => systemService.createBackup());
  register('moneybook:system:setAppLock', (p) => {
    const { password } = p as { password: string };
    return systemService.setAppLockPassword(password);
  });
  register('moneybook:system:unlock', (p) => {
    const { password } = p as { password: string };
    return systemService.verifyPassword(password);
  });
  register('moneybook:system:isLocked', () => systemService.isAppLockEnabled());
  register('moneybook:system:selectFile', (p, win) => {
    const { filters } = p as { filters: { name: string; extensions: string[] }[] };
    return systemService.selectFile(win, filters);
  });
  register('moneybook:system:selectDirectory', (_p, win) => systemService.selectDirectory(win));
  register('moneybook:system:getVersion', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json');
    return pkg.version as string;
  });
}
