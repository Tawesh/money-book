import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UpdaterState, UpdaterStatus } from '@shared/types';

/**
 * 自动更新状态管理
 * - 由 UpdateChecker 组件在挂载时调用 init() 订阅主进程推送的状态事件
 * - 设置页等入口通过 checkNow() 触发手动检查
 */
export const useUpdaterStore = defineStore('updater', () => {
  const state = ref<UpdaterState>('idle');
  const version = ref('');
  const currentVersion = ref('');
  const percent = ref(0);
  const message = ref('');
  /** 更新弹窗是否可见 */
  const dialogVisible = ref(false);
  /** 弹窗展示模式：'available' 询问下载 / 'downloading' 下载中 / 'downloaded' 重启安装 / 'error' 出错 */
  const mode = ref<'available' | 'downloading' | 'downloaded' | 'error'>('available');

  let unsubscribe: (() => void) | null = null;
  /** 是否由用户手动触发检查（用于“已是最新”提示） */
  let manualCheck = false;

  /** 根据主进程推送的状态更新 UI */
  function applyStatus(status: UpdaterStatus) {
    state.value = status.state;
    if (status.version) version.value = status.version;
    if (status.currentVersion) currentVersion.value = status.currentVersion;
    if (status.percent !== undefined) percent.value = status.percent;
    if (status.message) message.value = status.message;

    switch (status.state) {
      case 'available':
        mode.value = 'available';
        dialogVisible.value = true;
        manualCheck = false;
        break;
      case 'downloading':
        mode.value = 'downloading';
        dialogVisible.value = true;
        break;
      case 'downloaded':
        mode.value = 'downloaded';
        dialogVisible.value = true;
        break;
      case 'not-available':
        dialogVisible.value = false;
        if (manualCheck) {
          manualCheck = false;
          ElMessage.success('当前已是最新版本');
        }
        break;
      case 'error':
        // 自动检查失败时静默，手动检查失败时提示
        if (manualCheck) {
          manualCheck = false;
          ElMessage.error(status.message || '检查更新失败，请稍后重试');
        }
        dialogVisible.value = false;
        break;
      default:
        break;
    }
  }

  /** 订阅主进程更新状态事件（只订阅一次） */
  function init() {
    if (unsubscribe) return;
    unsubscribe = window.moneyBook?.updater?.onStatus?.(applyStatus) ?? null;
    // 获取初始状态，同步弹窗
    window.moneyBook?.updater?.getStatus?.().then(applyStatus).catch(() => {});
  }

  function dispose() {
    unsubscribe?.();
    unsubscribe = null;
  }

  /** 手动检查更新 */
  async function checkNow(): Promise<void> {
    manualCheck = true;
    state.value = 'checking';
    try {
      await window.moneyBook.updater.check();
    } catch (e) {
      manualCheck = false;
      ElMessage.error((e as Error).message || '检查更新失败');
    }
  }

  /** 开始下载更新 */
  async function download(): Promise<void> {
    try {
      await window.moneyBook.updater.download();
    } catch (e) {
      ElMessage.error((e as Error).message || '下载更新失败');
    }
  }

  /** 退出并安装更新 */
  function quitAndInstall(): void {
    window.moneyBook.updater.quitAndInstall();
  }

  /** 关闭弹窗（稍后再说） */
  function dismiss(): void {
    dialogVisible.value = false;
  }

  return {
    state,
    version,
    currentVersion,
    percent,
    message,
    dialogVisible,
    mode,
    init,
    dispose,
    checkNow,
    download,
    quitAndInstall,
    dismiss,
  };
});
