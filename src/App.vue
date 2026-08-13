<template>
  <LockScreen v-if="appStore.locked" @unlocked="appStore.unlock()" />
  <router-view v-else />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import LockScreen from '@/components/LockScreen.vue';

const appStore = useAppStore();

onMounted(async () => {
  // 读取系统主题偏好
  const settings = await window.moneyBook.system.getSettings();
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const mode = settings.theme === 'system' ? (dark ? 'dark' : 'light') : settings.theme;
  appStore.applyTheme(mode);

  // 应用锁：启用则启动即锁定
  appStore.locked = await window.moneyBook.system.isLocked();
});
</script>
