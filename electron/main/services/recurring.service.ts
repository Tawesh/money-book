/**
 * 周期性账单服务：规则 CRUD + 到期自动生成流水
 */
import { getDb, now } from '../db/database';
import type { RecurringRule, RecurringFrequency, TransactionType } from '../../shared/types';
import { createTransaction } from './transaction.service';

export interface RecurringInput {
  ledger_id: number;
  account_id: number;
  category_id?: number | null;
  type: TransactionType;
  amount: number;
  frequency: RecurringFrequency;
  day_of_month?: number | null;
  next_run_date?: string;
  note?: string;
}

export function listRecurringRules(ledgerId: number): RecurringRule[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM recurring_rule WHERE ledger_id = ? ORDER BY id ASC')
    .all(ledgerId) as RecurringRule[];
}

export function createRecurringRule(input: RecurringInput): RecurringRule {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO recurring_rule
       (ledger_id, account_id, category_id, type, amount, frequency, day_of_month, next_run_date, active, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .run(
      input.ledger_id,
      input.account_id,
      input.category_id ?? null,
      input.type,
      input.amount,
      input.frequency,
      input.day_of_month ?? null,
      input.next_run_date ?? now().slice(0, 10),
      input.note ?? ''
    );
  return getRecurringRule(Number(result.lastInsertRowid))!;
}

export function getRecurringRule(id: number): RecurringRule | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM recurring_rule WHERE id = ?').get(id) as RecurringRule) ?? null;
}

export function updateRecurringRule(id: number, data: Partial<RecurringInput>): RecurringRule {
  const db = getDb();
  const existing = getRecurringRule(id);
  if (!existing) throw new Error('周期规则不存在');
  db.prepare(
    `UPDATE recurring_rule SET account_id=?, category_id=?, type=?, amount=?, frequency=?, day_of_month=?, next_run_date=?, note=? WHERE id=?`
  ).run(
    data.account_id ?? existing.account_id,
    data.category_id !== undefined ? data.category_id : existing.category_id,
    data.type ?? existing.type,
    data.amount ?? existing.amount,
    data.frequency ?? existing.frequency,
    data.day_of_month !== undefined ? data.day_of_month : existing.day_of_month,
    data.next_run_date ?? existing.next_run_date,
    data.note !== undefined ? data.note : existing.note,
    id
  );
  return getRecurringRule(id)!;
}

export function removeRecurringRule(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM recurring_rule WHERE id = ?').run(id);
}

/** 计算下一次执行日期 */
function nextDate(rule: RecurringRule, from: Date): Date {
  const d = new Date(from);
  switch (rule.frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly': {
      const day = rule.day_of_month ?? d.getDate();
      d.setMonth(d.getMonth() + 1, 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, daysInMonth));
      break;
    }
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

/** 处理所有到期的周期规则，生成流水并推进 next_run_date。返回生成的条数 */
export function runDueRecurring(): number {
  const db = getDb();
  const today = now().slice(0, 10);
  const due = db
    .prepare('SELECT * FROM recurring_rule WHERE active = 1 AND next_run_date <= ?')
    .all(today) as RecurringRule[];

  let count = 0;
  for (const rule of due) {
    // 只生成一条（生成日期 = next_run_date），并推进下一次
    createTransaction({
      ledger_id: rule.ledger_id,
      account_id: rule.account_id,
      category_id: rule.category_id,
      type: rule.type,
      amount: rule.amount,
      happened_at: `${rule.next_run_date} 00:00:00`,
      note: rule.note || `周期账单(${rule.frequency})`,
    });
    const next = nextDate(rule, new Date(`${rule.next_run_date}T00:00:00`));
    const pad = (n: number) => String(n).padStart(2, '0');
    db.prepare('UPDATE recurring_rule SET next_run_date = ? WHERE id = ?').run(
      `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
      rule.id
    );
    count++;
  }
  return count;
}
