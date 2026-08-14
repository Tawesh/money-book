/**
 * 货币与汇率服务
 * 汇率 rate 定义：1 单位该货币 = rate 单位人民币(CNY)
 * 账本基准币种 = ledger.currency，报表汇总时统一换算为基准币种
 */
import { getDb, now } from '../db/database';
import type { Currency } from '../../shared/types';

/** 全部货币（含汇率） */
export function listCurrencies(): Currency[] {
  const db = getDb();
  return db.prepare('SELECT * FROM currency ORDER BY code ASC').all() as Currency[];
}

export function getCurrency(code: string): Currency | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM currency WHERE code = ?').get(code) as Currency) ?? null;
}

/** 新增货币 */
export function addCurrency(code: string, name: string, symbol: string, rate: number): Currency {
  const db = getDb();
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) throw new Error('货币代码需为 3 位字母，如 USD');
  if (!rate || rate <= 0) throw new Error('汇率必须大于 0');
  const existing = getCurrency(c);
  if (existing) throw new Error(`货币 ${c} 已存在`);
  db.prepare('INSERT INTO currency (code, name, symbol, rate, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    c,
    name.trim() || c,
    symbol.trim() || c,
    rate,
    now()
  );
  return getCurrency(c)!;
}

/** 更新汇率（相对 CNY） */
export function updateRate(code: string, rate: number): Currency {
  const db = getDb();
  if (!rate || rate <= 0) throw new Error('汇率必须大于 0');
  const existing = getCurrency(code);
  if (!existing) throw new Error('货币不存在');
  db.prepare('UPDATE currency SET rate = ?, updated_at = ? WHERE code = ?').run(rate, now(), code);
  return getCurrency(code)!;
}

/** 删除货币（删除前检查是否被引用） */
export function removeCurrency(code: string): void {
  const db = getDb();
  const existing = getCurrency(code);
  if (!existing) throw new Error('货币不存在');
  if (code === 'CNY') throw new Error('人民币为基准货币，不可删除');
  const used = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT currency FROM ledger WHERE currency = ? AND deleted = 0
         UNION ALL
         SELECT currency FROM account WHERE currency = ? AND deleted = 0
         UNION ALL
         SELECT currency FROM transactions WHERE currency = ?
       )`
    )
    .get(code, code, code) as { c: number };
  if (used.c > 0) throw new Error(`货币 ${code} 正在被使用，无法删除`);
  db.prepare('DELETE FROM currency WHERE code = ?').run(code);
}

/**
 * 将金额从 srcCode 换算为 dstCode（通过 CNY 中转）
 * 1 src = srcRate CNY，1 dst = dstRate CNY → src→dst = amount * srcRate / dstRate
 */
export function convert(amount: number, srcCode: string, dstCode: string): number {
  if (srcCode === dstCode) return amount;
  const db = getDb();
  const src = db.prepare('SELECT rate FROM currency WHERE code = ?').get(srcCode) as { rate: number } | undefined;
  const dst = db.prepare('SELECT rate FROM currency WHERE code = ?').get(dstCode) as { rate: number } | undefined;
  if (!src || !dst || src.rate <= 0 || dst.rate <= 0) return amount;
  return (amount * src.rate) / dst.rate;
}

/** 获取账本的基准币种 */
export function baseCurrencyOf(ledgerId: number): string {
  const db = getDb();
  const row = db.prepare('SELECT currency FROM ledger WHERE id = ?').get(ledgerId) as
    | { currency: string }
    | undefined;
  return row?.currency ?? 'CNY';
}
