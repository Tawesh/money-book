/**
 * SQLite 数据库连接与迁移
 * 使用 better-sqlite3，WAL 模式，PRAGMA user_version 管理迁移版本
 */
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

let db: Database.Database | null = null;

/** 获取全局数据库实例 */
export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

/** 迁移脚本列表：索引 i 对应 user_version = i+1 */
const MIGRATIONS: string[] = [
  // ---- v1：初始表结构 ----
  `
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📒',
    currency TEXT DEFAULT 'CNY',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id INTEGER NOT NULL REFERENCES ledger(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other',
    icon TEXT DEFAULT '💳',
    balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_account_ledger ON account(ledger_id);

  CREATE TABLE IF NOT EXISTS category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id INTEGER NOT NULL REFERENCES ledger(id),
    parent_id INTEGER REFERENCES category(id),
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
    sort_order INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_category_ledger ON category(ledger_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id INTEGER NOT NULL REFERENCES ledger(id),
    account_id INTEGER NOT NULL REFERENCES account(id),
    category_id INTEGER REFERENCES category(id),
    type INTEGER NOT NULL CHECK (type IN (1,2,3,4)),
    amount REAL NOT NULL CHECK (amount >= 0),
    currency TEXT DEFAULT 'CNY',
    happened_at TEXT NOT NULL,
    note TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    transfer_account_id INTEGER REFERENCES account(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_txn_ledger_time ON transactions(ledger_id, happened_at DESC);
  CREATE INDEX IF NOT EXISTS idx_txn_account ON transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_txn_category ON transactions(category_id, happened_at);

  CREATE TABLE IF NOT EXISTS budget (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id INTEGER NOT NULL REFERENCES ledger(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    total_amount REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(ledger_id, year, month)
  );
  CREATE INDEX IF NOT EXISTS idx_budget_period ON budget(ledger_id, year, month);

  CREATE TABLE IF NOT EXISTS budget_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_id INTEGER NOT NULL REFERENCES budget(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES category(id),
    amount REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS recurring_rule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id INTEGER NOT NULL REFERENCES ledger(id),
    account_id INTEGER NOT NULL REFERENCES account(id),
    category_id INTEGER REFERENCES category(id),
    type INTEGER NOT NULL CHECK (type IN (1,2)),
    amount REAL NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
    day_of_month INTEGER,
    next_run_date TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    note TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS attachment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

/** 默认支出/收入分类 */
export const DEFAULT_CATEGORIES = {
  expense: [
    { name: '餐饮', icon: '🍜' },
    { name: '交通', icon: '🚌' },
    { name: '购物', icon: '🛍️' },
    { name: '居住', icon: '🏠' },
    { name: '娱乐', icon: '🎮' },
    { name: '医疗', icon: '💊' },
    { name: '教育', icon: '📚' },
    { name: '人情', icon: '🎁' },
    { name: '其他', icon: '📦' },
  ],
  income: [
    { name: '工资', icon: '💰' },
    { name: '奖金', icon: '🏆' },
    { name: '理财', icon: '📈' },
    { name: '兼职', icon: '💼' },
    { name: '其他', icon: '📦' },
  ],
};

/** 为新账本插入默认分类 */
export function seedCategories(ledgerId: number): void {
  const database = getDb();
  const insert = database.prepare(
    `INSERT INTO category (ledger_id, parent_id, name, icon, kind, sort_order, deleted)
     VALUES (?, NULL, ?, ?, ?, ?, 0)`
  );
  const tx = database.transaction((id: number) => {
    let order = 0;
    for (const kind of ['expense', 'income'] as const) {
      for (const c of DEFAULT_CATEGORIES[kind]) {
        insert.run(id, c.name, c.icon, kind, order++);
      }
    }
  });
  tx(ledgerId);
}

/** 执行迁移 */
function migrate(database: Database.Database): void {
  const current = database.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v];
    database.transaction(() => {
      database.exec(sql);
      database.pragma(`user_version = ${v + 1}`);
    })();
  }
}

/** 初始化数据库（主进程启动时调用） */
export function initDatabase(): Database.Database {
  const dir = app.getPath('userData');
  const file = path.join(dir, 'moneybook.db');
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

/** 当前时间 ISO 字符串 */
export function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
