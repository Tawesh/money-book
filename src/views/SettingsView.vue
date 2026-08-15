<template>
  <div class="page-container settings-page">
    <div class="page-header">
      <h2>设置</h2>
    </div>

    <div class="settings-layout">
      <!-- 左侧/顶部导航：宽屏为竖排，窄屏为横向滚动 -->
      <nav class="settings-nav" :class="{ compact: isCompact }">
        <button
          v-for="g in groups"
          :key="g.key"
          class="nav-item"
          :class="{ active: activeGroup === g.key }"
          @click="activeGroup = g.key"
        >
          <span class="nav-icon">{{ g.icon }}</span>
          <span class="nav-label">{{ g.label }}</span>
        </button>
      </nav>

      <!-- 内容区 -->
      <div class="settings-content">
        <!-- ===== 外观 ===== -->
        <section v-show="activeGroup === 'appearance'" class="group">
          <div class="group-title">🎨 外观</div>
          <el-form :label-position="labelPosition" label-width="90px">
            <el-form-item label="主题">
              <el-radio-group v-model="theme" class="theme-options" @change="saveTheme">
                <el-radio-button value="light">浅色</el-radio-button>
                <el-radio-button value="dark">深色</el-radio-button>
                <el-radio-button value="system">跟随系统</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </section>

        <!-- ===== 账本币种 ===== -->
        <section v-show="activeGroup === 'currency'" class="group">
          <div class="group-title">💱 账本币种</div>
          <el-form :label-position="labelPosition" label-width="90px">
            <el-form-item label="基准币种">
              <el-select
                :model-value="ledgerCurrency"
                style="width: 100%"
                :disabled="!ledgerStore.currentId"
                @change="changeLedgerCurrency"
              >
                <el-option
                  v-for="c in currencyStore.currencies"
                  :key="c.code"
                  :label="`${c.code} ${c.name} (${c.symbol})`"
                  :value="c.code"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="说明">
              <span class="tip-text">报表、预算等汇总金额将换算为账本基准币种</span>
            </el-form-item>
          </el-form>
        </section>

        <!-- ===== 系统托盘 ===== -->
        <section v-show="activeGroup === 'tray'" class="group">
          <div class="group-title">🖥️ 系统托盘</div>
          <el-form :label-position="labelPosition" label-width="90px">
            <el-form-item label="启用托盘">
              <div class="inline-group">
                <el-switch v-model="trayEnabled" @change="saveSettings" />
                <span class="tip-text">在系统托盘显示图标，方便快速记账</span>
              </div>
            </el-form-item>
            <template v-if="trayEnabled">
              <el-form-item label="关闭时">
                <div class="inline-group">
                  <el-switch v-model="closeToTray" @change="saveSettings" />
                  <span class="tip-text">点击窗口关闭按钮时最小化到托盘（而非退出）</span>
                </div>
              </el-form-item>
              <el-form-item label="最小化时">
                <div class="inline-group">
                  <el-switch v-model="minimizeToTray" @change="saveSettings" />
                  <span class="tip-text">最小化窗口时隐藏到托盘</span>
                </div>
              </el-form-item>
            </template>
          </el-form>
        </section>

        <!-- ===== 安全 ===== -->
        <section v-show="activeGroup === 'security'" class="group">
          <div class="group-title">🔐 应用锁</div>
          <el-form :label-position="labelPosition" label-width="90px">
            <el-form-item label="状态">
              <div class="inline-group">
                <el-switch v-model="lockEnabled" @change="onLockChange" />
                <span class="tip-text">{{ lockEnabled ? '已启用' : '未启用' }}</span>
              </div>
            </el-form-item>
            <template v-if="lockEnabled">
              <el-form-item label="修改密码">
                <div class="inline-group">
                  <el-input
                    v-model="newPassword"
                    type="password"
                    placeholder="新密码（至少4位）"
                    show-password
                    class="flex-item"
                  />
                  <el-button type="primary" @click="changePassword">修改</el-button>
                </div>
              </el-form-item>
              <el-form-item label="立即锁定">
                <div class="inline-group">
                  <el-button @click="lockNow">锁定应用</el-button>
                  <span class="tip-text">锁定后需输入密码才能继续使用</span>
                </div>
              </el-form-item>
            </template>
          </el-form>
        </section>

        <!-- ===== 数据 ===== -->
        <section v-show="activeGroup === 'data'" class="group">
          <div class="group-title">💾 数据管理</div>
          <el-form :label-position="labelPosition" label-width="90px">
            <el-form-item label="自动备份">
              <div class="inline-group">
                <el-switch v-model="backupEnabled" @change="saveSettings" />
                <span class="tip-text">自动备份到本地目录，保留最近 10 份</span>
              </div>
            </el-form-item>
            <el-form-item label="备份目录">
              <div class="inline-group">
                <el-input :model-value="backupDir" readonly placeholder="未设置，使用默认目录" class="flex-item" />
                <el-button @click="chooseBackupDir">选择</el-button>
              </div>
            </el-form-item>
            <el-form-item label="立即备份">
              <el-button type="primary" @click="doBackup">备份数据</el-button>
            </el-form-item>
            <el-divider />
            <el-form-item label="导出">
              <div class="btn-group">
                <el-button @click="exportData('csv')">导出 CSV</el-button>
                <el-button @click="exportData('json')">导出 JSON</el-button>
              </div>
            </el-form-item>
            <el-form-item label="导入">
              <div class="btn-group">
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
        </section>

        <!-- ===== 关于 ===== -->
        <section v-show="activeGroup === 'about'" class="group">
          <div class="group-title">ℹ️ 关于</div>
          <el-descriptions :column="1" size="small" border class="about-desc">
            <el-descriptions-item label="应用">MoneyBook 个人记账本</el-descriptions-item>
            <el-descriptions-item label="版本">v{{ version }}</el-descriptions-item>
            <el-descriptions-item label="数据存储">本地 SQLite（100% 本地）</el-descriptions-item>
          </el-descriptions>
          <div class="btn-group update-row">
            <el-button :loading="checking" @click="checkUpdate">检查更新</el-button>
            <span class="tip-text">从 GitHub Releases 检查并下载最新版本</span>
          </div>
        </section>
      </div>
    </div>

    <!-- 启用应用锁弹窗 -->
    <el-dialog v-model="showLockDialog" :title="lockDialogTitle" width="min(92vw, 400px)" @close="onLockDialogClose">
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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { useLedgerStore } from '@/stores/ledger';
import { useTransactionStore } from '@/stores/transaction';
import { useCurrencyStore } from '@/stores/currency';
import { useUpdaterStore } from '@/stores/updater';
import type { Settings } from '@shared/types';

const appStore = useAppStore();
const ledgerStore = useLedgerStore();
const transactionStore = useTransactionStore();
const currencyStore = useCurrencyStore();
const updaterStore = useUpdaterStore();

/** 导航分组 */
const groups = [
  { key: 'appearance', icon: '🎨', label: '外观' },
  { key: 'currency', icon: '💱', label: '账本币种' },
  { key: 'tray', icon: '🖥️', label: '系统托盘' },
  { key: 'security', icon: '🔐', label: '应用锁' },
  { key: 'data', icon: '💾', label: '数据管理' },
  { key: 'about', icon: 'ℹ️', label: '关于' },
] as const;

type GroupKey = (typeof groups)[number]['key'];

/** 当前选中的分组 */
const activeGroup = ref<GroupKey>('appearance');
/** 窄屏（宽度 < 720px）时导航转为横向、表单标签置顶 */
const isCompact = ref(false);

const labelPosition = computed(() => (isCompact.value ? 'top' : 'right'));

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
const version = ref('');
const trayEnabled = ref(true);
const closeToTray = ref(true);
const minimizeToTray = ref(false);
const checking = ref(false);

/** 手动检查更新 */
async function checkUpdate() {
  checking.value = true;
  try {
    await updaterStore.checkNow();
  } finally {
    checking.value = false;
  }
}

/** 当前账本基准币种 */
const ledgerCurrency = computed(() => ledgerStore.current()?.currency ?? 'CNY');

async function loadSettings() {
  settings.value = await window.moneyBook.system.getSettings();
  theme.value = settings.value.theme;
  lockEnabled.value = settings.value.app_lock_enabled;
  backupEnabled.value = settings.value.backup_enabled;
  backupDir.value = settings.value.backup_dir;
  trayEnabled.value = settings.value.tray_enabled;
  closeToTray.value = settings.value.close_to_tray;
  minimizeToTray.value = settings.value.minimize_to_tray;
  await currencyStore.load();
  // 版本号单独获取并容错，避免影响其他设置加载
  try {
    version.value = await window.moneyBook.system.getVersion();
  } catch (e) {
    console.error('获取版本失败:', e);
  }
}

function updateViewport() {
  // 内容区宽度 = 窗口宽度 - 侧边栏(220px)。内容区较窄时导航转横向、标签置顶
  const contentWidth = window.innerWidth - 220;
  isCompact.value = contentWidth < 780;
}

function saveTheme() {
  appStore.applyTheme(theme.value === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme.value);
  window.moneyBook.system.setSettings({ theme: theme.value });
  ElMessage.success('主题已更新');
}

/** 修改当前账本基准币种 */
async function changeLedgerCurrency(code: string) {
  const id = ledgerStore.currentId;
  if (!id) return;
  try {
    await window.moneyBook.ledger.update(id, { currency: code });
    await ledgerStore.load();
    ElMessage.success('账本基准币种已更新');
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
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
  window.moneyBook.system.setSettings({
    backup_enabled: backupEnabled.value,
    tray_enabled: trayEnabled.value,
    close_to_tray: closeToTray.value,
    minimize_to_tray: minimizeToTray.value,
  });
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

onMounted(() => {
  window.addEventListener('resize', updateViewport);
  updateViewport();
  loadSettings();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport);
});
</script>

<style scoped>
.settings-page {
  /* 无 max-width，布局随窗口横向延伸占满内容区 */
}

/* ===== 布局骨架：宽屏左右，窄屏上下 ===== */
.settings-layout {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-top: 16px;
}

/* 导航：宽屏竖排固定宽度 */
.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  width: 176px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px;
  position: sticky;
  top: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover {
  background: rgba(64, 158, 255, 0.08);
}
.nav-item.active {
  background: rgba(64, 158, 255, 0.15);
  color: var(--color-primary);
  font-weight: 600;
}
.nav-icon {
  font-size: 16px;
}

/* 内容区 */
.settings-content {
  flex: 1;
  min-width: 0;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
}

/* 内容区内部的表单控件限制最大宽度，避免全屏下被过度拉伸 */
.settings-content :deep(.el-form-item) {
  max-width: 680px;
}

.group-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

/* ===== 窄屏适配：导航转横向滚动 ===== */
.settings-nav.compact {
  flex-direction: row;
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.settings-nav.compact .nav-item {
  flex-shrink: 0;
  width: auto;
  padding: 8px 14px;
}

/* ===== 表单项内部布局 ===== */
.inline-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.inline-group .flex-item {
  flex: 1 1 180px;
  min-width: 0;
}
.btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.theme-options {
  flex-wrap: wrap;
}
.update-row {
  margin-top: 16px;
  align-items: center;
}
.about-desc {
  margin-bottom: 8px;
}

.tip-text {
  color: var(--color-text-secondary);
  font-size: 12px;
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
