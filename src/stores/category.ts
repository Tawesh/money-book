import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Category, CategoryKind } from '@shared/types';

export const useCategoryStore = defineStore('category', () => {
  const categories = ref<Category[]>([]);
  const loaded = ref(false);

  async function load(ledgerId: number) {
    categories.value = await window.moneyBook.category.list(ledgerId);
    loaded.value = true;
  }

  function byKind(kind: CategoryKind): Category[] {
    return categories.value.filter((c) => c.kind === kind && !c.parent_id);
  }

  async function create(data: Partial<Category>) {
    const cat = await window.moneyBook.category.create(data);
    categories.value.push(cat);
    return cat;
  }

  async function update(id: number, data: Partial<Category>) {
    const cat = await window.moneyBook.category.update(id, data);
    const idx = categories.value.findIndex((c) => c.id === id);
    if (idx >= 0) categories.value[idx] = cat;
    return cat;
  }

  async function remove(id: number) {
    await window.moneyBook.category.remove(id);
    categories.value = categories.value.filter((c) => c.id !== id);
  }

  return { categories, loaded, load, byKind, create, update, remove };
});
