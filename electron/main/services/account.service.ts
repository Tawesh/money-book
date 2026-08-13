/**
 * 账户服务
 */
import { getDb, now } from '../db/database';
import type { Account } from '../../shared/types';

export interface AccountInput {
  ledger_id: number;
  name: string;
  type: Account['type'];
  icon?: string;
  balance?: number;
  currency?: string;
}

export function listAccounts(ledgerId: number): Account[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM account WHERE ledger_id = ? AND deleted = 0 ORDER BY sort_order ASC, id ASC')
    .all(ledgerId) as Account[];
}

export function getAccount(id: number): Account | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM account WHERE id = ? AND deleted = 0').get(id) as Account) ?? null;
}

export function createAccount(input: AccountInput): Account {
  const db = getDb();
  const ts = now();
  const result = db
    .prepare(
      `INSERT INTO account (ledger_id, name, type, icon, balance, currency, sort_order, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM account WHERE ledger_id = ?), ?, ?, 0)`
    )
    .run(
      input.ledger_id,
      input.name,
      input.type,
      input.icon ?? '💳',
      input.balance ?? 0,
      input.currency ?? 'CNY',
      input.ledger_id,
      ts,
      ts
    );
  return getAccount(Number(result.lastInsertRowid))!;
}

export function updateAccount(id: number, data: Partial<Account>): Account {
  const db = getDb();
  const existing = getAccount(id);
  if (!existing) throw new Error('账户不存在');
  db.prepare(
    'UPDATE account SET name = ?, type = ?, icon = ?, currency = ?, updated_at = ? WHERE id = ?'
  ).run(
    data.name ?? existing.name,
    data.type ?? existing.type,
    data.icon ?? existing.icon,
    data.currency ?? existing.currency,
    now(),
    id
  );
  return getAccount(id)!;
}

/** 调整余额（供转账/记账事务内调用，不单独暴露） */
export function adjustBalance(accountId: number, delta: number): void {
  const db = getDb();
  db.prepare('UPDATE account SET balance = balance + ?, updated_at = ? WHERE id = ?').run(
    delta,
    now(),
    accountId
  );
}

export function removeAccount(id: number): void {
  const db = getDb();
  db.prepare('UPDATE account SET deleted = 1, updated_at = ? WHERE id = ?').run(now(), id);
}
