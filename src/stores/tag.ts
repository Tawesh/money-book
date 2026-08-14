import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Tag } from '@shared/types';

export const useTagStore = defineStore('tag', () => {
  const tags = ref<Tag[]>([]);
  const loading = ref(false);

  async function load(ledgerId: number) {
    loading.value = true;
    try {
      tags.value = await window.moneyBook.tag.list(ledgerId);
    } finally {
      loading.value = false;
    }
  }

  async function create(data: { ledger_id: number; name: string; icon?: string }) {
    const tag = await window.moneyBook.tag.create(data);
    tags.value.push(tag);
    return tag;
  }

  async function update(id: number, data: { name?: string; icon?: string }) {
    const tag = await window.moneyBook.tag.update(id, data);
    const idx = tags.value.findIndex((t) => t.id === id);
    if (idx >= 0) tags.value[idx] = tag;
    return tag;
  }

  async function remove(id: number) {
    await window.moneyBook.tag.remove(id);
    tags.value = tags.value.filter((t) => t.id !== id);
  }

  return { tags, loading, load, create, update, remove };
});
