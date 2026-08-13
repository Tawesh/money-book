/**
 * 系统服务：设置、备份、导入导出、应用锁
 */
import { app, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb, now } from '../db/database';
import type { BackupResult, ExportResult, Settings } from '../../shared/types';
import { listTransactions, createTransaction } from './transaction.service';

const DEFAULT_SETTINGS: Settings = {
  app_lock_enabled: false,
  theme: 'system',
  backup_dir: '',
  backup_enabled: true,
  last_ledger_id: null,
};

// ============ 设置 ============

export function getSettings(): Settings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const parsed: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      parsed[r.key] = JSON.parse(r.value);
    } catch {
      parsed[r.key] = r.value;
    }
  }
  return { ...DEFAULT_SETTINGS, ...parsed } as Settings;
}

export function setSettings(data: Partial<Settings>): Settings {
  const db = getDb();
  const current = getSettings();
  const next = { ...current, ...data };
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [k, v] of Object.entries(next)) {
    upsert.run(k, JSON.stringify(v));
  }
  return getSettings();
}

function dbPath(): string {
  return path.join(app.getPath('userData'), 'moneybook.db');
}

// ============ 备份 ============

export function createBackup(): BackupResult {
  const settings = getSettings();
  const dir = settings.backup_dir || path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `moneybook-backup-${now().replace(/[-: ]/g, '')}.db`;
  const target = path.join(dir, filename);
  fs.copyFileSync(dbPath(), target);
  // 清理旧备份，保留最近 10 份
  const backups = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('moneybook-backup-') && f.endsWith('.db'))
    .sort();
  while (backups.length > 10) {
    fs.unlinkSync(path.join(dir, backups.shift()!));
  }
  return {
    file_path: target,
    size: fs.statSync(target).size,
    created_at: now(),
  };
}

// ============ 导入导出 ============

function escapeCsv(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportData(ledgerId: number, format: 'csv' | 'json'): ExportResult {
  const settings = getSettings();
  const dir = settings.backup_dir || path.join(app.getPath('userData'), 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const ts = now().replace(/[-: ]/g, '');
  const filePath = path.join(dir, `moneybook-export-${ts}.${format}`);

  const { items } = listTransactions({ ledger_id: ledgerId, page_size: 100000 });

  if (format === 'json') {
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
  } else {
    const header = ['id', 'type', 'amount', 'currency', 'happened_at', 'note', 'account_name', 'category_name', 'tags'];
    const lines = [header.map(escapeCsv).join(',')];
    for (const it of items) {
      lines.push(
        [
          it.id,
          it.type,
          it.amount,
          it.currency,
          it.happened_at,
          it.note,
          it.account_name ?? '',
          it.category_name ?? '',
          (it.tags ?? []).join('|'),
        ]
          .map(escapeCsv)
          .join(',')
      );
    }
    fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf-8'); // BOM 便于 Excel 识别
  }

  return { file_path: filePath, count: items.length };
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

export function importData(filePath: string, ledgerId: number): ImportResult {
  const db = getDb();
  const ext = path.extname(filePath).toLowerCase();
  let imported = 0;
  let skipped = 0;

  if (ext === '.json') {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>[];
    db.transaction(() => {
      for (const row of raw) {
        try {
          createTransaction({
            ledger_id: ledgerId,
            account_id: Number(row.account_id),
            category_id: row.category_id ? Number(row.category_id) : null,
            type: Number(row.type) as 1 | 2 | 3 | 4,
            amount: Number(row.amount),
            currency: String(row.currency ?? 'CNY'),
            happened_at: String(row.happened_at ?? now()),
            note: String(row.note ?? ''),
            tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
          });
          imported++;
        } catch {
          skipped++;
        }
      }
    })();
  } else if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length <= 1) return { imported: 0, skipped: 0 };
    const header = parseCsvLine(lines[0]);
    const idx = (name: string) => header.indexOf(name);
    const iType = idx('type');
    const iAmount = idx('amount');
    const iDate = idx('happened_at');
    const iNote = idx('note');
    const iAccount = idx('account_name');
    const iCategory = idx('category_name');
    const iTags = idx('tags');

    db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        try {
          const type = Number(cols[iType]) || 1;
          const amount = Number(cols[iAmount]);
          if (!amount || amount <= 0) {
            skipped++;
            continue;
          }
          // 通过名称查找账户/分类，找不到则跳过
          const accountName = cols[iAccount];
          const categoryName = cols[iCategory];
          const account = db
            .prepare('SELECT id FROM account WHERE ledger_id = ? AND name = ? AND deleted = 0')
            .get(ledgerId, accountName) as { id: number } | undefined;
          if (!account) {
            skipped++;
            continue;
          }
          let categoryId: number | null = null;
          if (categoryName) {
            const cat = db
              .prepare('SELECT id FROM category WHERE ledger_id = ? AND name = ? AND deleted = 0')
              .get(ledgerId, categoryName) as { id: number } | undefined;
            categoryId = cat?.id ?? null;
          }
          createTransaction({
            ledger_id: ledgerId,
            account_id: account.id,
            category_id: categoryId,
            type: type as 1 | 2 | 3 | 4,
            amount,
            happened_at: cols[iDate] || now(),
            note: cols[iNote] ?? '',
            tags: (cols[iTags] ?? '').split('|').filter(Boolean),
          });
          imported++;
        } catch {
          skipped++;
        }
      }
    })();
  } else {
    throw new Error('仅支持 CSV 或 JSON 文件');
  }
  return { imported, skipped };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ============ 应用锁 ============

const LOCK_KEY = 'app_lock_hash';
const LOCK_SALT = 'app_lock_salt';

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
}

/** 设置应用锁口令 */
export function setAppLockPassword(password: string): void {
  if (!password || password.length < 4) throw new Error('密码至少 4 位');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const db = getDb();
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  upsert.run(LOCK_SALT, JSON.stringify(salt));
  upsert.run(LOCK_KEY, JSON.stringify(hash));
  setSettings({ app_lock_enabled: true });
}

/** 校验解锁口令 */
export function verifyPassword(password: string): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(LOCK_KEY) as { value: string } | undefined;
  if (!row) return true; // 未设置锁则直接通过
  const saltRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(LOCK_SALT) as
    | { value: string }
    | undefined;
  const salt = saltRow ? JSON.parse(saltRow.value) : '';
  const hash = JSON.parse(row.value);
  return hashPassword(password, salt) === hash;
}

export function isAppLockEnabled(): boolean {
  const db = getDb();
  return !!db.prepare('SELECT value FROM settings WHERE key = ?').get(LOCK_KEY);
}

// ============ 文件选择 ============

export function selectFile(win: BrowserWindow, filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  return dialog
    .showOpenDialog(win, { filters, properties: ['openFile'] })
    .then((result) => (result.canceled ? null : result.filePaths[0] ?? null));
}

export function selectDirectory(win: BrowserWindow): Promise<string | null> {
  return dialog
    .showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
    .then((result) => (result.canceled ? null : result.filePaths[0] ?? null));
}
