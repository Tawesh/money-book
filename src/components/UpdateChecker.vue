<template>
  <el-dialog
    v-model="updaterStore.dialogVisible"
    :title="dialogTitle"
    width="440px"
    :close-on-click-modal="false"
    :show-close="updaterStore.mode !== 'downloading'"
    @close="onClose"
  >
    <!-- 发现新版本：询问是否下载 -->
    <template v-if="updaterStore.mode === 'available'">
      <div class="update-info">
        <div class="update-version">
          发现新版本 <b>v{{ updaterStore.version }}</b>
          <span v-if="updaterStore.currentVersion" class="current">（当前 v{{ updaterStore.currentVersion }}）</span>
        </div>
        <div class="update-desc">新版本已发布到 GitHub，是否立即下载更新？</div>
      </div>
    </template>

    <!-- 下载中：显示进度 -->
    <template v-else-if="updaterStore.mode === 'downloading'">
      <div class="update-info">
        <div class="update-version">正在下载 v{{ updaterStore.version }}</div>
        <el-progress
          :percentage="updaterStore.percent"
          :stroke-width="10"
          :text-inside="true"
          striped
          striped-flow
          style="margin-top: 14px"
        />
        <div class="update-desc">{{ updaterStore.percent.toFixed(1) }}% · 下载完成后即可安装</div>
      </div>
    </template>

    <!-- 下载完成：重启安装 -->
    <template v-else-if="updaterStore.mode === 'downloaded'">
      <div class="update-info">
        <div class="update-version">v{{ updaterStore.version }} 已下载完成</div>
        <div class="update-desc">重启应用即可完成安装，重启后自动进入新版本。</div>
      </div>
    </template>

    <!-- 错误 -->
    <template v-else>
      <div class="update-info">
        <div class="update-version">更新失败</div>
        <div class="update-desc error-text">{{ updaterStore.message || '发生未知错误，请稍后重试' }}</div>
      </div>
    </template>

    <template #footer>
      <template v-if="updaterStore.mode === 'available'">
        <el-button @click="updaterStore.dismiss()">稍后</el-button>
        <el-button type="primary" @click="startDownload">立即下载</el-button>
      </template>
      <template v-else-if="updaterStore.mode === 'downloading'">
        <el-button disabled>正在下载…</el-button>
      </template>
      <template v-else-if="updaterStore.mode === 'downloaded'">
        <el-button @click="updaterStore.dismiss()">稍后</el-button>
        <el-button type="primary" @click="updaterStore.quitAndInstall()">立即重启</el-button>
      </template>
      <template v-else>
        <el-button type="primary" @click="updaterStore.dismiss()">知道了</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useUpdaterStore } from '@/stores/updater';

const updaterStore = useUpdaterStore();

const dialogTitle = computed(() => {
  switch (updaterStore.mode) {
    case 'available':
      return '发现新版本';
    case 'downloading':
      return '下载更新';
    case 'downloaded':
      return '更新就绪';
    case 'error':
      return '更新失败';
    default:
      return '软件更新';
  }
});

function startDownload() {
  updaterStore.download();
}

function onClose() {
  // 下载中不允许关闭弹窗（show-close=false，但仍可能触发），此处兜底
  if (updaterStore.mode === 'downloading') {
    updaterStore.dialogVisible = true;
  }
}

onMounted(() => {
  updaterStore.init();
});

onUnmounted(() => {
  updaterStore.dispose();
});
</script>

<style scoped>
.update-info {
  padding: 4px 0;
}
.update-version {
  font-size: 15px;
  color: var(--color-text);
}
.update-version .current {
  font-weight: normal;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-left: 4px;
}
.update-desc {
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.error-text {
  color: var(--el-color-danger);
}
</style>
