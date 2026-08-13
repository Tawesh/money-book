<template>
  <div class="page-container">
    <div class="page-header">
      <h2>流水</h2>
      <el-button type="primary" @click="showQuickAdd = true">＋ 记一笔</el-button>
    </div>

    <!-- 筛选栏 -->
    <div class="card filter-bar">
      <el-form inline size="small">
        <el-form-item label="类型">
          <el-select v-model="filters.type" placeholder="全部" clearable style="width: 100px">
            <el-option label="支出" :value="1" />
            <el-option label="收入" :value="2" />
            <el-option label="转账" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="账户">
          <el-select v-model="filters.account_id" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="a in accountStore.accounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="filters.category_id" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="c in categoryStore.categories" :key="c.id" :label="`${c.icon} ${c.name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="备注搜索" clearable style="width: 140px" @keyup.enter="load(1)" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 流水表格 -->
    <div class="card" style="margin-top: 12px">
      <el-table :data="store.items" v-loading="store.loading" size="small" stripe>
        <el-table-column prop="happened_at" label="时间" width="160" />
        <el-table-column label="类型" width="70">
          <template #default="{ row }">
            <el-tag :type="row.type === 2 ? 'success' : row.type === 1 ? 'danger' : 'info'" size="small">
              {{ typeText(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="130">
          <template #default="{ row }">
            {{ row.category_icon }} {{ row.category_name ?? '转账' }}
          </template>
        </el-table-column>
        <el-table-column label="账户" width="130">
          <template #default="{ row }">
            {{ row.account_name }}
            <span v-if="row.transfer_account_name" class="transfer-to">→ {{ row.transfer_account_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="note" label="备注" show-overflow-tooltip />
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">
            <span :class="row.type === 2 ? 'money-income' : row.type === 1 ? 'money-expense' : ''">
              {{ row.type === 2 ? '+' : row.type === 1 ? '-' : '' }}{{ row.amount.toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editRow(row)">编辑</el-button>
            <el-popconfirm title="确认删除这条流水？" @confirm="removeRow(row.id)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="store.page"
          :page-size="store.pageSize"
          :total="store.total"
          layout="total, prev, pager, next"
          @current-change="load"
        />
      </div>
    </div>

    <QuickAddDialog v-if="showQuickAdd" @close="showQuickAdd = false; load()" />
    <QuickAddDialog
      v-if="editingRow"
      :transaction="editingRow"
      @close="editingRow = null; load()"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useLedgerStore } from '@/stores/ledger';
import { useAccountStore } from '@/stores/account';
import { useCategoryStore } from '@/stores/category';
import { useTransactionStore } from '@/stores/transaction';
import type { TransactionListItem } from '@shared/types';
import QuickAddDialog from '@/components/transaction/QuickAddDialog.vue';

const ledgerStore = useLedgerStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const store = useTransactionStore();

const filters = reactive<{
  type?: number;
  account_id?: number;
  category_id?: number;
  keyword?: string;
}>({});
const dateRange = ref<[string, string] | null>(null);
const showQuickAdd = ref(false);
const editingRow = ref<TransactionListItem | null>(null);

function typeText(t: number) {
  return { 1: '支出', 2: '收入', 3: '转账', 4: '调账' }[t] ?? '-';
}

async function load(page = store.page) {
  const id = ledgerStore.currentId;
  if (!id) return;
  await store.load({
    ledger_id: id,
    page,
    page_size: store.pageSize,
    type: filters.type as never,
    account_id: filters.account_id,
    category_id: filters.category_id,
    keyword: filters.keyword || undefined,
    start_date: dateRange.value?.[0],
    end_date: dateRange.value?.[1],
  });
}

function resetFilters() {
  filters.type = undefined;
  filters.account_id = undefined;
  filters.category_id = undefined;
  filters.keyword = '';
  dateRange.value = null;
  load(1);
}

function editRow(row: TransactionListItem) {
  editingRow.value = row;
}

async function removeRow(id: number) {
  try {
    await window.moneyBook.transaction.remove(id);
    ElMessage.success('删除成功');
    await accountStore.load(ledgerStore.currentId!);
    load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

onMounted(() => load(1));
</script>

<style scoped>
.filter-bar {
  padding: 8px 16px 0;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
.transfer-to {
  color: var(--color-text-secondary);
}
</style>
