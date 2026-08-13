import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const theme = ref<'light' | 'dark'>('light');
  const locked = ref(false);

  function applyTheme(mode: 'light' | 'dark') {
    theme.value = mode;
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    // Element Plus 暗黑模式依赖 html.dark 选择器
    root.classList.toggle('dark', mode === 'dark');
  }

  function lock() {
    locked.value = true;
  }

  function unlock() {
    locked.value = false;
  }

  return { theme, locked, applyTheme, lock, unlock };
});
