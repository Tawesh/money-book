/**
 * 前后端共享类型定义
 * 用于 IPC 协议与业务模型的类型契约
 */

// ============ 基础类型 ============

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 业务错误码 */
export const ErrorCode = {
  OK: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============ 账本 ============

export interface Ledger {
  id: number;
  name: string;
  icon: string;
  currency: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted: number;
}

// ============ 账户 ============

export type AccountType = 'cash' | 'bank_card' | 'credit_card' | 'alipay' | 'wechat' | 'other';

export interface Account {
  id: number;
  ledger_id: number;
  name: string;
  type: AccountType;
  icon: string;
  balance: number;
  currency: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted: number;
}

// ============ 分类 ============

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: number;
  ledger_id: number;
  parent_id: number | null;
  name: string;
  icon: string;
  kind: CategoryKind;
  sort_order: number;
  deleted: number;
}

// ============ 流水 ============

export type TransactionType = 1 | 2 | 3 | 4; // 1=支出 2=收入 3=转账 4=调账

export interface Transaction {
  id: number;
  ledger_id: number;
  account_id: number;
  category_id: number | null;
  type: TransactionType;
  amount: number;
  currency: string;
  happened_at: string;
  note: string;
  tags: string[];
  transfer_account_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionQuery {
  ledger_id: number;
  account_id?: number;
  category_id?: number;
  type?: TransactionType;
  start_date?: string;
  end_date?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}

export interface TransactionListItem extends Transaction {
  account_name?: string;
  category_name?: string;
  category_icon?: string;
  transfer_account_name?: string;
}

export interface PagedResult<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

// ============ 预算 ============

export interface Budget {
  id: number;
  ledger_id: number;
  year: number;
  month: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetItem {
  id: number;
  budget_id: number;
  category_id: number;
  amount: number;
}

export interface BudgetWithUsage extends Budget {
  used_amount: number;
  items: BudgetItem[];
}

// ============ 报表 ============

export interface CategoryStat {
  category_id: number | null;
  name: string;
  icon: string;
  amount: number;
  percent: number;
}

export interface DailyStat {
  date: string;
  income: number;
  expense: number;
}

export interface AccountStat {
  account_id: number;
  name: string;
  amount: number;
}

export interface ReportSummary {
  month: string;
  income_total: number;
  expense_total: number;
  balance: number;
  by_category: CategoryStat[];
  daily_trend: DailyStat[];
  top_accounts: AccountStat[];
}

// ============ 周期账单 ============

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: number;
  ledger_id: number;
  account_id: number;
  category_id: number;
  type: TransactionType;
  amount: number;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  next_run_date: string;
  active: number;
  note: string;
}

// ============ 系统/设置 ============

export interface ExportResult {
  file_path: string;
  count: number;
}

export interface BackupResult {
  file_path: string;
  size: number;
  created_at: string;
}

export interface Settings {
  app_lock_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  backup_dir: string;
  backup_enabled: boolean;
  last_ledger_id: number | null;
  /** 是否启用系统托盘 */
  tray_enabled: boolean;
  /** 点击窗口关闭按钮时最小化到托盘（而非退出） */
  close_to_tray: boolean;
  /** 最小化时最小化到托盘 */
  minimize_to_tray: boolean;
}

// ============ 前置 API 定义（渲染进程通过 window.moneyBook 调用） ============

export interface MoneyBookApi {
  ledger: {
    list: () => Promise<Ledger[]>;
    create: (name: string, icon?: string, currency?: string) => Promise<Ledger>;
    update: (id: number, data: Partial<Ledger>) => Promise<Ledger>;
    remove: (id: number) => Promise<void>;
  };
  account: {
    list: (ledgerId: number) => Promise<Account[]>;
    create: (data: Partial<Account>) => Promise<Account>;
    update: (id: number, data: Partial<Account>) => Promise<Account>;
    remove: (id: number) => Promise<void>;
  };
  category: {
    list: (ledgerId: number, kind?: CategoryKind) => Promise<Category[]>;
    create: (data: Partial<Category>) => Promise<Category>;
    update: (id: number, data: Partial<Category>) => Promise<Category>;
    remove: (id: number) => Promise<void>;
  };
  transaction: {
    list: (query: TransactionQuery) => Promise<PagedResult<TransactionListItem>>;
    create: (data: Partial<Transaction>) => Promise<TransactionListItem>;
    update: (id: number, data: Partial<Transaction>) => Promise<TransactionListItem>;
    remove: (id: number) => Promise<void>;
  };
  report: {
    summary: (ledgerId: number, year: number, month: number) => Promise<ReportSummary>;
  };
  budget: {
    get: (ledgerId: number, year: number, month: number) => Promise<BudgetWithUsage | null>;
    save: (data: { ledger_id: number; year: number; month: number; total_amount: number; items: { category_id: number; amount: number }[] }) => Promise<BudgetWithUsage>;
  };
  recurring: {
    list: (ledgerId: number) => Promise<RecurringRule[]>;
    create: (data: Partial<RecurringRule>) => Promise<RecurringRule>;
    update: (id: number, data: Partial<RecurringRule>) => Promise<RecurringRule>;
    remove: (id: number) => Promise<void>;
    runDue: () => Promise<number>;
  };
  system: {
    getSettings: () => Promise<Settings>;
    setSettings: (data: Partial<Settings>) => Promise<Settings>;
    export: (ledgerId: number, format: 'csv' | 'json') => Promise<ExportResult>;
    import: (filePath: string, ledgerId: number) => Promise<{ imported: number; skipped: number }>;
    backup: () => Promise<BackupResult>;
    setAppLock: (password: string) => Promise<void>;
    unlock: (password: string) => Promise<boolean>;
    isLocked: () => Promise<boolean>;
    selectFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
    selectDirectory: () => Promise<string | null>;
    getVersion: () => Promise<string>;
  };
  tray: {
    /** 监听托盘“快速记账”：显示主窗口并跳转到记账页。返回取消监听函数 */
    onQuickAdd: (callback: () => void) => () => void;
  };
}
