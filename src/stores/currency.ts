import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Currency } from '@shared/types';

export const useCurrencyStore = defineStore('currency', () => {
  const currencies = ref<Currency[]>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      currencies.value = await window.moneyBook.currency.list();
    } finally {
      loading.value = false;
    }
  }

  /** 按代码取货币，找不到返回 undefined */
  function get(code: string): Currency | undefined {
    return currencies.value.find((c) => c.code === code);
  }

  async function add(code: string, name: string, symbol: string, rate: number) {
    const c = await window.moneyBook.currency.add(code, name, symbol, rate);
    currencies.value.push(c);
    currencies.value.sort((a, b) => a.code.localeCompare(b.code));
    return c;
  }

  async function updateRate(code: string, rate: number) {
    const c = await window.moneyBook.currency.updateRate(code, rate);
    const idx = currencies.value.findIndex((x) => x.code === code);
    if (idx >= 0) currencies.value[idx] = c;
    return c;
  }

  async function remove(code: string) {
    await window.moneyBook.currency.remove(code);
    currencies.value = currencies.value.filter((c) => c.code !== code);
  }

  return { currencies, loading, load, get, add, updateRate, remove };
});
