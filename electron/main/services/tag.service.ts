/**
 * 标签服务（场景标签）
 * 标签按账本隔离；交易流水通过 tags(JSON 数组，存标签名) 关联
 */
import { getDb, now, DEFAULT_TAGS } from '../db/database';
import type { Tag } from '../../shared/types';

export interface TagInput {
  ledger_id: number;
  name: string;
  icon?: string;
}

export function listTags(ledgerId: number): Tag[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM tag WHERE ledger_id = ? AND deleted = 0 ORDER BY id ASC')
    .all(ledgerId) as Tag[];
}

export function getTag(id: number): Tag | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM tag WHERE id = ? AND deleted = 0').get(id) as Tag) ?? null;
}

/** 按名称查找账本内标签（含软删除，避免重名） */
export function findTagByName(ledgerId: number, name: string): Tag | null {
  const db = getDb();
  return (
    (db.prepare('SELECT * FROM tag WHERE ledger_id = ? AND name = ? LIMIT 1').get(ledgerId, name) as Tag) ?? null
  );
}

export function createTag(input: TagInput): Tag {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error('标签名称不能为空');
  const dup = findTagByName(input.ledger_id, name);
  if (dup) {
    if (dup.deleted) {
      // 恢复已软删除的同名标签
      db.prepare('UPDATE tag SET deleted = 0, icon = ?, updated_at = ? WHERE id = ?').run(
        input.icon ?? dup.icon,
        now(),
        dup.id
      );
      return getTag(dup.id)!;
    }
    throw new Error(`标签「${name}」已存在`);
  }
  const ts = now();
  const result = db
    .prepare('INSERT INTO tag (ledger_id, name, icon, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)')
    .run(input.ledger_id, name, input.icon ?? '🏷️', ts, ts);
  return getTag(Number(result.lastInsertRowid))!;
}

export function updateTag(id: number, data: { name?: string; icon?: string }): Tag {
  const db = getDb();
  const existing = getTag(id);
  if (!existing) throw new Error('标签不存在');
  const name = (data.name ?? existing.name).trim();
  if (!name) throw new Error('标签名称不能为空');
  const dup = findTagByName(existing.ledger_id, name);
  if (dup && dup.id !== id && !dup.deleted) throw new Error(`标签「${name}」已存在`);
  db.prepare('UPDATE tag SET name = ?, icon = ?, updated_at = ? WHERE id = ?').run(
    name,
    data.icon ?? existing.icon,
    now(),
    id
  );
  return getTag(id)!;
}

/** 软删除标签（历史流水中的标签名保留展示） */
export function removeTag(id: number): void {
  const db = getDb();
  const existing = getTag(id);
  if (!existing) throw new Error('标签不存在');
  db.prepare('UPDATE tag SET deleted = 1, updated_at = ? WHERE id = ?').run(now(), id);
}

/** 为账本预置默认场景标签（新建账本时调用） */
export function seedDefaultTags(ledgerId: number): void {
  const db = getDb();
  const ts = now();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO tag (ledger_id, name, icon, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)'
  );
  const tx = db.transaction((id: number) => {
    for (const t of DEFAULT_TAGS) {
      insert.run(id, t.name, t.icon, ts, ts);
    }
  });
  tx(ledgerId);
}
