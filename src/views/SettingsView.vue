<template>
  <div class="page-container settings-page">
    <h2>设置</h2>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="card">
          <div class="card-title">外观</div>
          <el-form label-width="80px">
            <el-form-item label="主题">
              <el-radio-group v-model="theme" @change="saveTheme">
                <el-radio-button value="light">浅色</el-radio-button>
                <el-radio-button value="dark">深色</el-radio-button>
                <el-radio-button value="system">跟随系统</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="card-title">应用锁</div>
          <el-form label-width="80px">
            <el-form-item label="状态">
              <el-switch v-model="lockEnabled" @change="onLockChange" />
              <span class="tip-text">{{ lockEnabled ? '已启用' : '未启用' }}</span>
            </el-form-item>
            <template v-if="lockEnabled">
              <el-form-item label="修改密码">
                <div style="display: flex; gap: 8px; align-items: center">
                  <el-input v-model="newPassword" type="password" placeholder="新密码（至少4位）" show-password style="width: 200px" />
                  <el-button type="primary" @click="changePassword">修改</el-button>
                </div>
              </el-form-item>
              <el-form-item label="立即锁定">
                <el-button @click="lockNow">锁定应用</el-button>
                <span class="tip-text">锁定后需输入密码才能继续使用</span>
              </el-form-item>
            </template>
          </el-form>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="card-title">自动备份</div>
          <el-form label-width="80px">
            <el-form-item label="启用">
              <el-switch v-model="backupEnabled" @change="saveSettings" />
            </el-form-item>
            <el-form-item label="备份目录">
              <div style="display: flex; gap: 8px; width: 100%">
                <el-input :model-value="backupDir" readonly placeholder="未设置，使用默认目录" />
                <el-button @click="chooseBackupDir">选择</el-button>
              </div>
            </el-form-item>
            <el-form-item label="立即备份">
              <el-button type="primary" @click="doBackup">备份数据</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="card">
          <div class="card-title">数据导入导出</div>
          <el-form label-width="80px">
            <el-form-item label="导出">
              <div style="display: flex; gap: 8px">
                <el-button @click="exportData('csv')">导出 CSV</el-button>
                <el-button @click="exportData('json')">导出 JSON</el-button>
              </div>
            </el-form-item>
            <el-form-item label="导入">
              <div style="display: flex; gap: 8px">
                <el-button @click="importData">导入 CSV/JSON</el-button>
              </div>
            </el-form-item>
            <el-form-item label="备份文件">
              <div class="backup-list">
                <div v-if="!backups.length" class="tip-text">暂无备份记录</div>
                <div v-for="b in backups" :key="b" class="backup-item">{{ b }}</div>
              </div>
            </el-form-item>
          </el-form>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="card-title">关于</div>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="应用">MoneyBook 个人记账本</el-descriptions-item>
            <el-descriptions-item label="版本">v{{ version }}</el-descriptions-item>
            <el-descriptions-item label="数据存储">本地 SQLite（100% 本地）</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
    </el-row>

    <!-- 启用应用锁弹窗 -->
    <el-dialog v-model="showLockDialog" :title="lockDialogTitle" width="400px" @close="onLockDialogClose">
      <el-form label-width="80px">
        <el-form-item label="解锁密码">
          <el-input
            v-model="lockPassword"
            type="password"
            placeholder="设置解锁密码（至少4位）"
            show-password
            @keyup.enter="confirmLockSetup"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showLockDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmLockSetup">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { useLedgerStore } from '@/stores/ledger';
import { useTransactionStore } from '@/stores/transaction';
import type { Settings } from '@shared/types';

const appStore = useAppStore();
const ledgerStore = useLedgerStore();
const transactionStore = useTransactionStore();

const settings = ref<Settings | null>(null);
const theme = ref<'light' | 'dark' | 'system'>('system');
const lockEnabled = ref(false);
const newPassword = ref('');
const showLockDialog = ref(false);
const lockPassword = ref('');
const lockDialogTitle = ref('启用应用锁');
/** 标记弹窗是否通过“确认”成功关闭（用于区分取消/遮罩/ESC 关闭） */
let lockConfirmed = false;
const backupEnabled = ref(true);
const backupDir = ref('');
const backups = ref<string[]>([]);
const version = ref('1.0.2');

async function loadSettings() {
  settings.value = await window.moneyBook.system.getSettings();
  theme.value = settings.value.theme;
  lockEnabled.value = settings.value.app_lock_enabled;
  backupEnabled.value = settings.value.backup_enabled;
  backupDir.value = settings.value.backup_dir;
  version.value = await window.moneyBook.system.getVersion();
}

function saveTheme() {
  appStore.applyTheme(theme.value === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme.value);
  window.moneyBook.system.setSettings({ theme: theme.value });
  ElMessage.success('主题已更新');
}

function onLockChange(val: boolean) {
  if (val) {
    // 启用：弹窗设置初始密码（未确认前不算真正启用）
    lockConfirmed = false;
    showLockDialog.value = true;
    lockPassword.value = '';
    lockDialogTitle.value = '启用应用锁';
  } else {
    window.moneyBook.system.setSettings({ app_lock_enabled: false });
    ElMessage.success('应用锁已关闭');
  }
}

async function confirmLockSetup() {
  if (lockPassword.value.length < 4) {
    ElMessage.warning('密码至少 4 位');
    return;
  }
  await window.moneyBook.system.setAppLock(lockPassword.value);
  lockConfirmed = true;
  showLockDialog.value = false;
  lockPassword.value = '';
  ElMessage.success('应用锁已启用');
}

/** 弹窗关闭（取消按钮 / 点遮罩 / ESC）：未成功确认则回退开关状态 */
function onLockDialogClose() {
  if (!lockConfirmed) {
    lockEnabled.value = false;
  }
  lockConfirmed = false;
}

async function changePassword() {
  if (newPassword.value.length < 4) {
    ElMessage.warning('密码至少 4 位');
    return;
  }
  await window.moneyBook.system.setAppLock(newPassword.value);
  newPassword.value = '';
  ElMessage.success('密码已修改');
}

/** 立即锁定应用 */
function lockNow() {
  appStore.lock();
}

function saveSettings() {
  window.moneyBook.system.setSettings({ backup_enabled: backupEnabled.value });
}

async function chooseBackupDir() {
  const dir = await window.moneyBook.system.selectDirectory();
  if (!dir) return;
  backupDir.value = dir;
  await window.moneyBook.system.setSettings({ backup_dir: dir });
  ElMessage.success('备份目录已设置');
}

async function doBackup() {
  const res = await window.moneyBook.system.backup();
  ElMessage.success(`备份成功：${res.file_path}`);
  refreshBackups();
}

async function refreshBackups() {
  backups.value = [];
  // 备份目录列表可通过后续接口扩展，此处展示最近一次路径
  if (settings.value?.backup_dir) {
    // placeholder
  }
}

async function exportData(format: 'csv' | 'json') {
  const id = ledgerStore.currentId;
  if (!id) return;
  const res = await window.moneyBook.system.export(id, format);
  ElMessage.success(`已导出 ${res.count} 条流水：${res.file_path}`);
}

async function importData() {
  const id = ledgerStore.currentId;
  if (!id) return;
  const file = await window.moneyBook.system.selectFile([
    { name: '数据文件', extensions: ['csv', 'json'] },
  ]);
  if (!file) return;
  try {
    const res = await window.moneyBook.system.import(file, id);
    ElMessage.success(`导入完成：成功 ${res.imported} 条，跳过 ${res.skipped} 条`);
    await transactionStore.load({ ledger_id: id, page: 1, page_size: 20 });
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

onMounted(loadSettings);
</script>

<style scoped>
.settings-page {
  max-width: 1200px;
}
.card-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.tip-text {
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-left: 8px;
}
.backup-list {
  width: 100%;
}
.backup-item {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 2px 0;
}
</style>
