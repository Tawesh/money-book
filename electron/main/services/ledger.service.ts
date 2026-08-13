/**
 * 账本服务
 */
import { getDb, now, seedCategories } from '../db/database';
import type { Ledger } from '../../shared/types';

export interface LedgerInput {
  name: string;
  icon?: string;
  currency?: string;
}

export function listLedgers(): Ledger[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM ledger WHERE deleted = 0 ORDER BY sort_order ASC, id ASC')
    .all() as Ledger[];
}

export function createLedger(input: LedgerInput): Ledger {
  const db = getDb();
  const ts = now();
  const result = db
    .prepare(
      `INSERT INTO ledger (name, icon, currency, sort_order, created_at, updated_at, deleted)
       VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM ledger), ?, ?, 0)`
    )
    .run(input.name, input.icon ?? '📒', input.currency ?? 'CNY', ts, ts);
  const id = Number(result.lastInsertRowid);
  // 新账本自动预置默认分类
  seedCategories(id);
  return getLedger(id)!;
}

export function getLedger(id: number): Ledger | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM ledger WHERE id = ? AND deleted = 0').get(id) as Ledger) ?? null;
}

export function updateLedger(id: number, data: Partial<Ledger>): Ledger {
  const db = getDb();
  const existing = getLedger(id);
  if (!existing) throw new Error('账本不存在');
  db.prepare('UPDATE ledger SET name = ?, icon = ?, currency = ?, updated_at = ? WHERE id = ?').run(
    data.name ?? existing.name,
    data.icon ?? existing.icon,
    data.currency ?? existing.currency,
    now(),
    id
  );
  return getLedger(id)!;
}

export function removeLedger(id: number): void {
  const db = getDb();
  db.prepare('UPDATE ledger SET deleted = 1, updated_at = ? WHERE id = ?').run(now(), id);
}
