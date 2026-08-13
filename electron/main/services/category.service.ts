/**
 * 分类服务
 */
import { getDb } from '../db/database';
import type { Category, CategoryKind } from '../../shared/types';

export interface CategoryInput {
  ledger_id: number;
  parent_id?: number | null;
  name: string;
  icon?: string;
  kind: CategoryKind;
}

export function listCategories(ledgerId: number, kind?: CategoryKind): Category[] {
  const db = getDb();
  if (kind) {
    return db
      .prepare(
        'SELECT * FROM category WHERE ledger_id = ? AND kind = ? AND deleted = 0 ORDER BY sort_order ASC, id ASC'
      )
      .all(ledgerId, kind) as Category[];
  }
  return db
    .prepare('SELECT * FROM category WHERE ledger_id = ? AND deleted = 0 ORDER BY sort_order ASC, id ASC')
    .all(ledgerId) as Category[];
}

export function getCategory(id: number): Category | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM category WHERE id = ? AND deleted = 0').get(id) as Category) ?? null;
}

export function createCategory(input: CategoryInput): Category {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO category (ledger_id, parent_id, name, icon, kind, sort_order, deleted)
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM category WHERE ledger_id = ?), 0)`
    )
    .run(input.ledger_id, input.parent_id ?? null, input.name, input.icon ?? '📁', input.kind, input.ledger_id);
  return getCategory(Number(result.lastInsertRowid))!;
}

export function updateCategory(id: number, data: Partial<Category>): Category {
  const db = getDb();
  const existing = getCategory(id);
  if (!existing) throw new Error('分类不存在');
  db.prepare('UPDATE category SET name = ?, icon = ? WHERE id = ?').run(
    data.name ?? existing.name,
    data.icon ?? existing.icon,
    id
  );
  return getCategory(id)!;
}

export function removeCategory(id: number): void {
  const db = getDb();
  db.prepare('UPDATE category SET deleted = 1 WHERE id = ?').run(id);
}
