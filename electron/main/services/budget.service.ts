/**
 * 预算服务：月度预算设置与使用情况
 */
import { getDb, now } from '../db/database';
import type { Budget, BudgetItem, BudgetWithUsage } from '../../shared/types';

export interface BudgetSaveInput {
  ledger_id: number;
  year: number;
  month: number;
  total_amount: number;
  items: { category_id: number; amount: number }[];
}

/** 查询某月预算及其使用情况 */
export function getBudgetWithUsage(ledgerId: number, year: number, month: number): BudgetWithUsage | null {
  const db = getDb();
  const budget = db
    .prepare('SELECT * FROM budget WHERE ledger_id = ? AND year = ? AND month = ?')
    .get(ledgerId, year, month) as Budget | undefined;
  if (!budget) return null;

  const items = db
    .prepare('SELECT * FROM budget_item WHERE budget_id = ?')
    .all(budget.id) as BudgetItem[];

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const used = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE ledger_id = ? AND type = 1 AND happened_at BETWEEN ? AND ?`
    )
    .get(ledgerId, `${monthStr}-01`, `${monthStr}-31`) as { total: number };

  return {
    ...budget,
    used_amount: Math.round(used.total * 100) / 100,
    items,
  };
}

/** 保存（创建或覆盖）月度预算 */
export function saveBudget(input: BudgetSaveInput): BudgetWithUsage {
  const db = getDb();
  const ts = now();
  db.transaction(() => {
    // 删除旧预算
    const old = db
      .prepare('SELECT id FROM budget WHERE ledger_id = ? AND year = ? AND month = ?')
      .get(input.ledger_id, input.year, input.month) as { id: number } | undefined;
    if (old) {
      db.prepare('DELETE FROM budget_item WHERE budget_id = ?').run(old.id);
      db.prepare('DELETE FROM budget WHERE id = ?').run(old.id);
    }
    // 插入新预算
    const result = db
      .prepare(
        'INSERT INTO budget (ledger_id, year, month, total_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(input.ledger_id, input.year, input.month, input.total_amount, ts, ts);
    const budgetId = Number(result.lastInsertRowid);
    const insertItem = db.prepare(
      'INSERT INTO budget_item (budget_id, category_id, amount) VALUES (?, ?, ?)'
    );
    for (const item of input.items) {
      if (item.amount > 0) insertItem.run(budgetId, item.category_id, item.amount);
    }
  })();
  return getBudgetWithUsage(input.ledger_id, input.year, input.month)!;
}
