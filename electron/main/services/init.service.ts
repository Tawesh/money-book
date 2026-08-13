/**
 * 初始化服务：首次启动自动创建默认账本、预置分类与基础账户
 * 保证用户打开应用即可记账，无需手动初始化
 */
import { getDb } from '../db/database';
import { createLedger } from './ledger.service';
import { createAccount } from './account.service';

/** 检查是否已有任何有效账本 */
export function hasAnyLedger(): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS c FROM ledger WHERE deleted = 0').get() as { c: number };
  return row.c > 0;
}

/** 为指定账本补齐默认账户（若该账本无账户） */
export function ensureDefaultAccounts(ledgerId: number): void {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM account WHERE ledger_id = ? AND deleted = 0')
    .get(ledgerId) as { c: number };
  if (row.c > 0) return;

  const defaults: { name: string; type: 'cash' | 'bank_card' | 'alipay'; icon: string; balance: number }[] = [
    { name: '现金', type: 'cash', icon: '💵', balance: 0 },
    { name: '银行卡', type: 'bank_card', icon: '💳', balance: 0 },
    { name: '支付宝', type: 'alipay', icon: '📱', balance: 0 },
  ];
  for (const d of defaults) {
    createAccount({
      ledger_id: ledgerId,
      name: d.name,
      type: d.type,
      icon: d.icon,
      balance: d.balance,
      currency: 'CNY',
    });
  }
}

/** 初始化数据：无账本时创建默认账本并补齐账户 */
export function ensureInitialData(): void {
  if (!hasAnyLedger()) {
    const ledger = createLedger({ name: '默认账本', icon: '📒', currency: 'CNY' });
    ensureDefaultAccounts(ledger.id);
    console.log('[init] 已创建默认账本与基础账户');
  } else {
    // 已有账本：为所有账本补齐默认账户（若缺失）
    const db = getDb();
    const ledgers = db.prepare('SELECT id FROM ledger WHERE deleted = 0').all() as { id: number }[];
    for (const l of ledgers) {
      ensureDefaultAccounts(l.id);
    }
  }
}
