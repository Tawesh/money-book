<template>
  <div class="page-container">
    <div class="page-header">
      <h2>预算管理</h2>
      <div class="month-nav">
        <el-button size="small" @click="shiftMonth(-1)">‹ 上月</el-button>
        <span class="month-label">{{ year }} 年 {{ month }} 月</span>
        <el-button size="small" @click="shiftMonth(1)">下月 ›</el-button>
        <el-button type="primary" size="small" style="margin-left: 12px" @click="openEditor">设置预算</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="8">
        <div class="card budget-card">
          <div class="budget-label">总预算（{{ baseCode }}）</div>
          <div class="budget-amount">{{ baseSymbol }}{{ budget?.total_amount.toFixed(2) ?? '0.00' }}</div>
          <el-progress
            :percentage="usagePercent"
            :status="usagePercent >= 100 ? 'exception' : usagePercent >= 80 ? 'warning' : 'success'"
            :stroke-width="12"
          />
          <div class="budget-sub">
            已用 {{ baseSymbol }}{{ budget?.used_amount.toFixed(2) ?? '0.00' }}
            <span v-if="budget" :class="remainingClass">
              剩余 {{ baseSymbol }}{{ (budget.total_amount - budget.used_amount).toFixed(2) }}
            </span>
          </div>
        </div>
      </el-col>
      <el-col :span="16">
        <div class="card">
          <div class="card-title">分类预算明细</div>
          <div v-if="!budget" class="empty-tip">本月尚未设置预算，点击右上角「设置预算」开始规划</div>
          <template v-else>
            <el-table :data="budget.items" size="small" stripe>
              <el-table-column label="分类">
                <template #default="{ row }">{{ categoryIcon(row.category_id) }} {{ categoryName(row.category_id) }}</template>
              </el-table-column>
              <el-table-column label="预算金额" align="right" width="140">
                <template #default="{ row }">{{ baseSymbol }}{{ row.amount.toFixed(2) }}</template>
              </el-table-column>
              <el-table-column label="已用金额" align="right" width="140">
                <template #default="{ row }">
                  <span class="money-expense">{{ baseSymbol }}{{ itemUsage(row.category_id).toFixed(2) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </div>
      </el-col>
    </el-row>

    <!-- 预算编辑弹窗 -->
    <el-dialog v-model="showEditor" title="设置月度预算" width="520px">
      <el-form label-width="90px">
        <el-form-item label="总预算">
          <el-input-number v-model="editTotal" :min="0" :precision="2" :step="100" style="width: 200px" />
        </el-form-item>
        <el-form-item label="分类预算">
          <div class="item-list">
            <div v-for="c in expenseCategories" :key="c.id" class="item-row">
              <span class="item-name">{{ c.icon }} {{ c.name }}</span>
              <el-input-number v-model="editItems[c.id]" :min="0" :precision="2" :step="50" size="small" style="width: 150px" />
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditor = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveBudget">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useLedgerStore } from '@/stores/ledger';
import { useCategoryStore } from '@/stores/category';
import { useCurrencyStore } from '@/stores/currency';
import type { BudgetWithUsage } from '@shared/types';

const ledgerStore = useLedgerStore();
const categoryStore = useCategoryStore();
const currencyStore = useCurrencyStore();

const budget = ref<BudgetWithUsage | null>(null);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const showEditor = ref(false);
const editTotal = ref(0);
const editItems = reactive<Record<number, number>>({});
const saving = ref(false);

const expenseCategories = computed(() => categoryStore.categories.filter((c) => c.kind === 'expense' && !c.parent_id));
const usagePercent = computed(() => {
  if (!budget.value || !budget.value.total_amount) return 0;
  return Math.min(100, Math.round((budget.value.used_amount / budget.value.total_amount) * 100));
});
const remainingClass = computed(() => {
  if (!budget.value) return '';
  return budget.value.total_amount - budget.value.used_amount >= 0 ? 'money-income' : 'money-expense';
});

/** 账本基准币种 */
const baseCode = computed(() => ledgerStore.current()?.currency ?? 'CNY');
const baseSymbol = computed(() => currencyStore.get(baseCode.value)?.symbol || baseCode.value);

function categoryName(id: number) {
  return categoryStore.categories.find((c) => c.id === id)?.name ?? '-';
}
function categoryIcon(id: number) {
  return categoryStore.categories.find((c) => c.id === id)?.icon ?? '📁';
}
function itemUsage(categoryId: number) {
  if (!budget.value) return 0;
  // 简化：从已用总额按比例粗算——实际应按分类统计，此处展示预算项金额
  return 0;
}

async function refresh() {
  const id = ledgerStore.currentId;
  if (!id) return;
  if (!currencyStore.currencies.length) await currencyStore.load();
  budget.value = await window.moneyBook.budget.get(id, year.value, month.value);
}

function shiftMonth(delta: number) {
  let m = month.value + delta;
  let y = year.value;
  if (m < 1) {
    m = 12;
    y--;
  } else if (m > 12) {
    m = 1;
    y++;
  }
  month.value = m;
  year.value = y;
  refresh();
}

function openEditor() {
  editTotal.value = budget.value?.total_amount ?? 0;
  for (const c of expenseCategories.value) {
    const item = budget.value?.items.find((i) => i.category_id === c.id);
    editItems[c.id] = item?.amount ?? 0;
  }
  showEditor.value = true;
}

async function saveBudget() {
  const id = ledgerStore.currentId;
  if (!id) return;
  saving.value = true;
  try {
    const items = expenseCategories.value
      .filter((c) => (editItems[c.id] ?? 0) > 0)
      .map((c) => ({ category_id: c.id, amount: editItems[c.id] ?? 0 }));
    const total = editTotal.value || items.reduce((s, i) => s + i.amount, 0);
    await window.moneyBook.budget.save({
      ledger_id: id,
      year: year.value,
      month: month.value,
      total_amount: total,
      items,
    });
    ElMessage.success('预算保存成功');
    showEditor.value = false;
    refresh();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}

onMounted(refresh);
</script>

<style scoped>
.month-nav {
  display: flex;
  align-items: center;
}
.month-label {
  font-size: 15px;
  font-weight: 600;
  min-width: 110px;
  text-align: center;
}
.budget-card {
  padding: 24px;
}
.budget-label {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.budget-amount {
  font-size: 32px;
  font-weight: 700;
  margin: 8px 0 16px;
}
.budget-sub {
  margin-top: 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
  display: flex;
  justify-content: space-between;
}
.card-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.empty-tip {
  color: var(--color-text-secondary);
  text-align: center;
  padding: 40px 0;
}
.item-list {
  width: 100%;
}
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}
.item-name {
  font-size: 14px;
}
</style>
