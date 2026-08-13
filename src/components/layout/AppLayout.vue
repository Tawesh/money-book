<template>
  <el-container class="app-layout">
    <el-aside :width="'var(--sidebar-width)'" class="app-aside">
      <div class="brand">
        <span class="brand-icon">💰</span>
        <span class="brand-name">MoneyBook</span>
      </div>
      <div class="ledger-switch">
        <div class="ledger-row">
          <el-select
            v-model="ledgerId"
            size="small"
            style="width: 100%"
            placeholder="暂无账本，请新建"
            :disabled="!ledgerStore.ledgers.length"
            @change="onSwitchLedger"
          >
            <el-option v-for="l in ledgerStore.ledgers" :key="l.id" :label="`${l.icon} ${l.name}`" :value="l.id" />
          </el-select>
          <el-tooltip content="删除当前账本" placement="top" :show-after="300">
            <el-button
              size="small"
              class="ledger-delete-btn"
              :disabled="!ledgerStore.currentId"
              @click="onRemoveLedger"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <el-button size="small" style="margin-top: 6px; width: 100%" @click="showCreateLedger = true">
          ＋ 新建账本
        </el-button>
      </div>
      <el-menu :default-active="route.path" router class="side-menu">
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon><span>概览</span>
        </el-menu-item>
        <el-menu-item index="/transactions">
          <el-icon><List /></el-icon><span>流水</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><PieChart /></el-icon><span>报表</span>
        </el-menu-item>
        <el-menu-item index="/budgets">
          <el-icon><Wallet /></el-icon><span>预算</span>
        </el-menu-item>
        <el-menu-item index="/accounts">
          <el-icon><CreditCard /></el-icon><span>账户</span>
        </el-menu-item>
        <el-menu-item index="/categories">
          <el-icon><Menu /></el-icon><span>分类</span>
        </el-menu-item>
        <el-menu-item index="/recurring">
          <el-icon><Refresh /></el-icon><span>周期账单</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon><span>设置</span>
        </el-menu-item>
      </el-menu>
      <div class="quick-add">
        <el-button
          type="primary"
          size="large"
          style="width: 100%"
          :disabled="!ledgerStore.currentId"
          @click="openQuickAdd"
        >
          ＋ 记一笔
        </el-button>
        <div v-if="!ledgerStore.currentId" class="quick-add-tip">请先创建账本</div>
      </div>
    </el-aside>

    <el-container>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <!-- 新建账本弹窗 -->
  <el-dialog v-model="showCreateLedger" title="新建账本" width="400px">
    <el-form label-width="80px">
      <el-form-item label="账本名称">
        <el-input v-model="newLedgerName" placeholder="如：生活账" />
      </el-form-item>
      <el-form-item label="图标">
        <EmojiPicker v-model="newLedgerIcon" placeholder="点击选择 Emoji" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showCreateLedger = false">取消</el-button>
      <el-button type="primary" @click="onCreateLedger">创建</el-button>
    </template>
  </el-dialog>

  <!-- 快捷记账弹窗 -->
  <QuickAddDialog v-if="showQuickAdd" @close="showQuickAdd = false" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  HomeFilled,
  List,
  PieChart,
  Wallet,
  CreditCard,
  Menu,
  Refresh,
  Setting,
  Delete,
} from '@element-plus/icons-vue';
import { useLedgerStore } from '@/stores/ledger';
import { useAccountStore } from '@/stores/account';
import { useCategoryStore } from '@/stores/category';
import QuickAddDialog from '@/components/transaction/QuickAddDialog.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';

const route = useRoute();
const ledgerStore = useLedgerStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();

const ledgerId = computed({
  get: () => ledgerStore.currentId ?? 0,
  set: (v: number) => v,
});
const showCreateLedger = ref(false);
const newLedgerName = ref('');
const newLedgerIcon = ref('📒');
const showQuickAdd = ref(false);

async function onSwitchLedger(id: number) {
  await ledgerStore.switchLedger(id);
  await refreshStores();
}

async function refreshStores() {
  const id = ledgerStore.currentId;
  if (!id) return;
  await Promise.all([accountStore.load(id), categoryStore.load(id)]);
}

async function onCreateLedger() {
  if (!newLedgerName.value.trim()) {
    ElMessage.warning('请输入账本名称');
    return;
  }
  await ledgerStore.create(newLedgerName.value.trim(), newLedgerIcon.value);
  newLedgerName.value = '';
  ElMessage.success('账本创建成功');
  showCreateLedger.value = false;
  await refreshStores();
}

async function onRemoveLedger() {
  const id = ledgerStore.currentId;
  if (!id) return;
  const ledger = ledgerStore.ledgers.find((l) => l.id === id);
  const name = ledger ? `${ledger.icon ?? ''} ${ledger.name}`.trim() : `#${id}`;
  try {
    await ElMessageBox.confirm(
      `确定删除账本「${name}」吗？\n其下的账户、分类、流水等数据将一并隐藏，此操作不可恢复。`,
      '删除账本',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      }
    );
  } catch {
    return; // 用户取消
  }
  await ledgerStore.remove(id);
  await refreshStores();
  ElMessage.success('账本已删除');
}

function openQuickAdd() {
  showQuickAdd.value = true;
}

onMounted(async () => {
  await ledgerStore.load();
  if (ledgerStore.currentId) {
    await refreshStores();
  }
});
</script>

<style scoped>
.app-layout {
  height: 100vh;
}
.app-aside {
  background: var(--color-card);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 16px;
  font-size: 18px;
  font-weight: 700;
}
.brand-icon {
  font-size: 24px;
}
.ledger-switch {
  padding: 0 12px 12px;
  border-bottom: 1px solid var(--color-border);
}
.ledger-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ledger-delete-btn {
  flex-shrink: 0;
  padding: 5px 8px;
}
.side-menu {
  flex: 1;
  border-right: none;
  padding-top: 8px;
  overflow-y: auto;
}
.quick-add {
  padding: 12px;
}
.quick-add-tip {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-top: 6px;
}
.app-main {
  padding: 0;
  overflow: hidden;
}
</style>
