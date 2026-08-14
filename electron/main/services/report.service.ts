/**
 * 报表服务：月度汇总、分类占比、每日趋势、账户排行
 * 支持多币种：所有金额统一换算为账本基准币种（ledger.currency）
 */
import { getDb } from '../db/database';
import type { AccountStat, CategoryStat, DailyStat, ReportSummary } from '../../shared/types';
import { baseCurrencyOf, getCurrency } from './currency.service';

export function reportSummary(ledgerId: number, year: number, month: number): ReportSummary {
  const db = getDb();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const start = `${monthStr}-01`;
  const end = `${monthStr}-31`;

  // 账本基准币种
  const baseCode = baseCurrencyOf(ledgerId);
  const base = getCurrency(baseCode);
  const baseRate = base?.rate && base.rate > 0 ? base.rate : 1;

  // 换算因子：金额(CNY) / baseRate = 金额(基准币)
  const toBase = `(t.amount * COALESCE(cr.rate, 1) / ${baseRate})`;

  // 收支合计（换算为基准币）
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN t.type = 2 THEN ${toBase} ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN t.type = 1 THEN ${toBase} ELSE 0 END), 0) AS expense
       FROM transactions t
       LEFT JOIN currency cr ON cr.code = t.currency
       WHERE t.ledger_id = ? AND t.happened_at BETWEEN ? AND ?`
    )
    .get(ledgerId, start, end) as { income: number; expense: number };

  // 分类占比（支出）
  const byCategory = db
    .prepare(
      `SELECT t.category_id AS category_id, COALESCE(c.name, '未分类') AS name, COALESCE(c.icon, '❓') AS icon,
              SUM(${toBase}) AS amount
       FROM transactions t
       LEFT JOIN category c ON c.id = t.category_id
       LEFT JOIN currency cr ON cr.code = t.currency
       WHERE t.ledger_id = ? AND t.type = 1 AND t.happened_at BETWEEN ? AND ?
       GROUP BY t.category_id
       ORDER BY amount DESC`
    )
    .all(ledgerId, start, end) as { category_id: number | null; name: string; icon: string; amount: number }[];

  const expenseTotal = totals.expense || 1;
  const categoryStats: CategoryStat[] = byCategory.map((row) => ({
    category_id: row.category_id,
    name: row.name,
    icon: row.icon,
    amount: round2(row.amount),
    percent: round2((row.amount / expenseTotal) * 100),
  }));

  // 每日趋势
  const daily = db
    .prepare(
      `SELECT substr(t.happened_at, 1, 10) AS date,
              COALESCE(SUM(CASE WHEN t.type = 2 THEN ${toBase} ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN t.type = 1 THEN ${toBase} ELSE 0 END), 0) AS expense
       FROM transactions t
       LEFT JOIN currency cr ON cr.code = t.currency
       WHERE t.ledger_id = ? AND t.happened_at BETWEEN ? AND ?
       GROUP BY substr(t.happened_at, 1, 10)
       ORDER BY date ASC`
    )
    .all(ledgerId, start, end) as { date: string; income: number; expense: number }[];
  const dailyTrend: DailyStat[] = daily.map((d) => ({
    date: d.date,
    income: round2(d.income),
    expense: round2(d.expense),
  }));

  // 账户排行（支出）
  const topAccounts = db
    .prepare(
      `SELECT t.account_id AS account_id, COALESCE(a.name, '未知') AS name, SUM(${toBase}) AS amount
       FROM transactions t
       LEFT JOIN account a ON a.id = t.account_id
       LEFT JOIN currency cr ON cr.code = t.currency
       WHERE t.ledger_id = ? AND t.type = 1 AND t.happened_at BETWEEN ? AND ?
       GROUP BY t.account_id
       ORDER BY amount DESC
       LIMIT 5`
    )
    .all(ledgerId, start, end) as { account_id: number; name: string; amount: number }[];
  const accountStats: AccountStat[] = topAccounts.map((a) => ({
    account_id: a.account_id,
    name: a.name,
    amount: round2(a.amount),
  }));

  return {
    month: monthStr,
    base_currency: baseCode,
    income_total: round2(totals.income),
    expense_total: round2(totals.expense),
    balance: round2(totals.income - totals.expense),
    by_category: categoryStats,
    daily_trend: dailyTrend,
    top_accounts: accountStats,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
