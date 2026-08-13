/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

import type { MoneyBookApi } from '@shared/types';

declare global {
  interface Window {
    moneyBook: MoneyBookApi;
  }
}
