import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Ledger } from '@shared/types';

export const useLedgerStore = defineStore('ledger', () => {
  const ledgers = ref<Ledger[]>([]);
  const currentId = ref<number | null>(null);

  const current = (): Ledger | null => ledgers.value.find((l) => l.id === currentId.value) ?? null;

  async function load() {
    ledgers.value = await window.moneyBook.ledger.list();
    const settings = await window.moneyBook.system.getSettings();
    // 优先恢复上次使用的账本
    if (settings.last_ledger_id && ledgers.value.some((l) => l.id === settings.last_ledger_id)) {
      currentId.value = settings.last_ledger_id;
    } else {
      currentId.value = ledgers.value[0]?.id ?? null;
    }
    if (currentId.value) {
      await window.moneyBook.system.setSettings({ last_ledger_id: currentId.value });
    }
  }

  async function switchLedger(id: number) {
    currentId.value = id;
    await window.moneyBook.system.setSettings({ last_ledger_id: id });
  }

  async function create(name: string, icon?: string, currency?: string) {
    const ledger = await window.moneyBook.ledger.create(name, icon, currency);
    ledgers.value.push(ledger);
    await switchLedger(ledger.id);
    return ledger;
  }

  /** 删除账本（软删除）。若删除的是当前账本，自动切换到剩余第一个；返回新的当前账本 id（可能为 null） */
  async function remove(id: number): Promise<number | null> {
    await window.moneyBook.ledger.remove(id);
    ledgers.value = ledgers.value.filter((l) => l.id !== id);
    if (currentId.value === id) {
      currentId.value = ledgers.value[0]?.id ?? null;
      await window.moneyBook.system.setSettings({ last_ledger_id: currentId.value });
    }
    return currentId.value;
  }

  return { ledgers, currentId, current, load, switchLedger, create, remove };
});
