/**
 * 流水服务（核心）
 * 记账 = 插入流水 + 更新账户余额，在同一个事务内完成
 */
import { getDb, now } from '../db/database';
import type {
  PagedResult,
  Transaction,
  TransactionListItem,
  TransactionQuery,
  TransactionType,
} from '../../shared/types';

export interface TransactionInput {
  ledger_id: number;
  account_id: number;
  category_id?: number | null;
  type: TransactionType;
  amount: number;
  currency?: string;
  happened_at?: string;
  note?: string;
  tags?: string[];
  transfer_account_id?: number | null;
}

/** 根据流水类型计算账户余额增量 */
function balanceDelta(type: TransactionType, amount: number): number {
  switch (type) {
    case 1: // 支出
      return -amount;
    case 2: // 收入
      return +amount;
    case 3: // 转账：源账户在插入时处理，此处返回 0（占位）
      return 0;
    default:
      return 0;
  }
}

const LIST_SELECT = `
  SELECT t.*, a.name AS account_name, c.name AS category_name, c.icon AS category_icon,
         ta.name AS transfer_account_name
  FROM transactions t
  LEFT JOIN account a ON a.id = t.account_id
  LEFT JOIN category c ON c.id = t.category_id
  LEFT JOIN account ta ON ta.id = t.transfer_account_id
`;

export function listTransactions(query: TransactionQuery): PagedResult<TransactionListItem> {
  const db = getDb();
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;

  const where: string[] = ['t.ledger_id = @ledger_id'];
  const params: Record<string, unknown> = { ledger_id: query.ledger_id };

  if (query.account_id) {
    where.push('(t.account_id = @account_id OR t.transfer_account_id = @account_id)');
    params.account_id = query.account_id;
  }
  if (query.category_id) {
    where.push('t.category_id = @category_id');
    params.category_id = query.category_id;
  }
  if (query.type) {
    where.push('t.type = @type');
    params.type = query.type;
  }
  if (query.start_date) {
    where.push('t.happened_at >= @start_date');
    params.start_date = query.start_date;
  }
  if (query.end_date) {
    where.push('t.happened_at <= @end_date');
    params.end_date = query.end_date + ' 23:59:59';
  }
  if (query.keyword) {
    where.push('t.note LIKE @keyword');
    params.keyword = `%${query.keyword}%`;
  }
  if (query.tag) {
    where.push('t.tags LIKE @tag');
    params.tag = `%"${query.tag}"%`;
  }

  const whereSql = where.join(' AND ');
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM transactions t WHERE ${whereSql}`).get(params) as { c: number }
  ).c;
  const items = db
    .prepare(
      `${LIST_SELECT} WHERE ${whereSql} ORDER BY t.happened_at DESC, t.id DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as TransactionListItem[];

  return {
    total,
    page,
    page_size: pageSize,
    items: items.map(decorate),
  };
}

function decorate(t: TransactionListItem): TransactionListItem {
  try {
    t.tags = JSON.parse((t.tags as unknown as string) ?? '[]');
  } catch {
    t.tags = [];
  }
  return t;
}

export function getTransaction(id: number): TransactionListItem | null {
  const db = getDb();
  const row = db.prepare(`${LIST_SELECT} WHERE t.id = ?`).get(id) as TransactionListItem | undefined;
  return row ? decorate(row) : null;
}

/** 新增流水（事务内：插入 + 余额更新） */
export function createTransaction(input: TransactionInput): TransactionListItem {
  const db = getDb();
  const ts = now();
  const happenedAt = input.happened_at ?? ts;

  const id = db.transaction((): number => {
    // 校验
    const account = db.prepare('SELECT * FROM account WHERE id = ? AND deleted = 0').get(input.account_id);
    if (!account) throw new Error('账户不存在');

    const result = db
      .prepare(
        `INSERT INTO transactions
         (ledger_id, account_id, category_id, type, amount, currency, happened_at, note, tags, transfer_account_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.ledger_id,
        input.account_id,
        input.category_id ?? null,
        input.type,
        input.amount,
        input.currency ?? 'CNY',
        happenedAt,
        input.note ?? '',
        JSON.stringify(input.tags ?? []),
        input.transfer_account_id ?? null,
        ts,
        ts
      );
    const newId = Number(result.lastInsertRowid);

    // 余额更新
    if (input.type === 3 && input.transfer_account_id) {
      // 转账：源账户减，目标账户加
      db.prepare('UPDATE account SET balance = balance - ?, updated_at = ? WHERE id = ?').run(
        input.amount,
        ts,
        input.account_id
      );
      db.prepare('UPDATE account SET balance = balance + ?, updated_at = ? WHERE id = ?').run(
        input.amount,
        ts,
        input.transfer_account_id
      );
    } else {
      const delta = balanceDelta(input.type, input.amount);
      db.prepare('UPDATE account SET balance = balance + ?, updated_at = ? WHERE id = ?').run(
        delta,
        ts,
        input.account_id
      );
    }
    return newId;
  })();

  return getTransaction(id)!;
}

/** 修改流水（事务内：回滚旧余额影响 + 应用新余额影响） */
export function updateTransaction(id: number, input: Partial<TransactionInput>): TransactionListItem {
  const db = getDb();
  const existing = getTransaction(id);
  if (!existing) throw new Error('流水不存在');

  const ts = now();
  db.transaction(() => {
    // 回滚旧影响
    revertBalance(existing, ts);
    // 应用新值
    const next: TransactionInput = {
      ledger_id: input.ledger_id ?? existing.ledger_id,
      account_id: input.account_id ?? existing.account_id,
      category_id: input.category_id !== undefined ? input.category_id : existing.category_id,
      type: input.type ?? existing.type,
      amount: input.amount ?? existing.amount,
      currency: input.currency ?? existing.currency,
      happened_at: input.happened_at ?? existing.happened_at,
      note: input.note !== undefined ? input.note : existing.note,
      tags: input.tags !== undefined ? input.tags : existing.tags,
      transfer_account_id:
        input.transfer_account_id !== undefined ? input.transfer_account_id : existing.transfer_account_id,
    };
    db.prepare(
      `UPDATE transactions SET ledger_id=?, account_id=?, category_id=?, type=?, amount=?, currency=?, happened_at=?, note=?, tags=?, transfer_account_id=?, updated_at=? WHERE id=?`
    ).run(
      next.ledger_id,
      next.account_id,
      next.category_id,
      next.type,
      next.amount,
      next.currency,
      next.happened_at,
      next.note,
      JSON.stringify(next.tags ?? []),
      next.transfer_account_id,
      ts,
      id
    );
    // 应用新影响
    if (next.type === 3 && next.transfer_account_id) {
      db.prepare('UPDATE account SET balance = balance - ?, updated_at = ? WHERE id = ?').run(
        next.amount,
        ts,
        next.account_id
      );
      db.prepare('UPDATE account SET balance = balance + ?, updated_at = ? WHERE id = ?').run(
        next.amount,
        ts,
        next.transfer_account_id
      );
    } else {
      const delta = balanceDelta(next.type, next.amount);
      db.prepare('UPDATE account SET balance = balance + ?, updated_at = ? WHERE id = ?').run(
        delta,
        ts,
        next.account_id
      );
    }
  })();

  return getTransaction(id)!;
}

/** 删除流水（事务内：回滚余额影响） */
export function deleteTransaction(id: number): void {
  const db = getDb();
  const existing = getTransaction(id);
  if (!existing) throw new Error('流水不存在');

  db.transaction(() => {
    revertBalance(existing, now());
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  })();
}

/** 回滚某条流水对账户余额的影响 */
function revertBalance(t: Transaction, ts: string): void {
  const db = getDb();
  if (t.type === 3 && t.transfer_account_id) {
    db.prepare('UPDATE account SET balance = balance + ?, updated_at = ? WHERE id = ?').run(
      t.amount,
      ts,
      t.account_id
    );
    db.prepare('UPDATE account SET balance = balance - ?, updated_at = ? WHERE id = ?').run(
      t.amount,
      ts,
      t.transfer_account_id
    );
  } else {
    const delta = balanceDelta(t.type, t.amount);
    db.prepare('UPDATE account SET balance = balance - ?, updated_at = ? WHERE id = ?').run(
      delta,
      ts,
      t.account_id
    );
  }
}

/** 最新一条流水（用于快捷展示） */
export function recentTransactions(ledgerId: number, limit = 10): TransactionListItem[] {
  const db = getDb();
  const rows = db
    .prepare(`${LIST_SELECT} WHERE t.ledger_id = ? ORDER BY t.happened_at DESC, t.id DESC LIMIT ?`)
    .all(ledgerId, limit) as TransactionListItem[];
  return rows.map(decorate);
}
