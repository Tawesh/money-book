import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TransactionListItem, TransactionQuery } from '@shared/types';

export const useTransactionStore = defineStore('transaction', () => {
  const items = ref<TransactionListItem[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const loading = ref(false);

  async function load(query: TransactionQuery) {
    loading.value = true;
    try {
      const res = await window.moneyBook.transaction.list(query);
      items.value = res.items;
      total.value = res.total;
      page.value = res.page;
    } finally {
      loading.value = false;
    }
  }

  return { items, total, page, pageSize, loading, load };
});
