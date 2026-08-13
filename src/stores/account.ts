import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Account } from '@shared/types';

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<Account[]>([]);
  const loaded = ref(false);

  async function load(ledgerId: number) {
    accounts.value = await window.moneyBook.account.list(ledgerId);
    loaded.value = true;
  }

  async function create(data: Partial<Account>) {
    const acc = await window.moneyBook.account.create(data);
    accounts.value.push(acc);
    return acc;
  }

  async function update(id: number, data: Partial<Account>) {
    const acc = await window.moneyBook.account.update(id, data);
    const idx = accounts.value.findIndex((a) => a.id === id);
    if (idx >= 0) accounts.value[idx] = acc;
    return acc;
  }

  async function remove(id: number) {
    await window.moneyBook.account.remove(id);
    accounts.value = accounts.value.filter((a) => a.id !== id);
  }

  return { accounts, loaded, load, create, update, remove };
});
