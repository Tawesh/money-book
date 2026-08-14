<template>
  <div class="page-container">
    <div class="page-header">
      <h2>周期账单</h2>
      <div class="header-actions">
        <el-button @click="runDue">立即执行到期账单</el-button>
        <el-button type="primary" @click="openCreate">＋ 新增规则</el-button>
      </div>
    </div>

    <div class="card">
      <el-table :data="rules" size="small" stripe>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 2 ? 'success' : 'danger'" size="small">
              {{ row.type === 2 ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">{{ baseSymbol }}{{ row.amount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="账户" width="120">
          <template #default="{ row }">{{ accountName(row.account_id) }}</template>
        </el-table-column>
        <el-table-column label="分类" width="120">
          <template #default="{ row }">{{ categoryName(row.category_id) }}</template>
        </el-table-column>
        <el-table-column label="频率" width="100">
          <template #default="{ row }">{{ freqText(row.frequency) }}</template>
        </el-table-column>
        <el-table-column prop="next_run_date" label="下次执行" width="120" />
        <el-table-column prop="note" label="备注" show-overflow-tooltip />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-popconfirm title="确认删除该规则？" @confirm="removeRule(row.id)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!rules.length" description="暂无周期账单规则" />
    </div>

    <el-dialog v-model="showDialog" :title="editing ? '编辑规则' : '新增周期规则'" width="460px">
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio-button :value="1">支出</el-radio-button>
            <el-radio-button :value="2">收入</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" style="width: 180px" />
        </el-form-item>
        <el-form-item label="账户">
          <el-select v-model="form.account_id" style="width: 100%">
            <el-option v-for="a in accountStore.accounts" :key="a.id" :label="`${a.icon} ${a.name}`" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category_id" style="width: 100%">
            <el-option v-for="c in kindCategories" :key="c.id" :label="`${c.icon} ${c.name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="频率">
          <el-select v-model="form.frequency" style="width: 100%">
            <el-option label="每天" value="daily" />
            <el-option label="每周" value="weekly" />
            <el-option label="每月" value="monthly" />
            <el-option label="每年" value="yearly" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.frequency === 'monthly'" label="每月的几号">
          <el-input-number v-model="form.day_of_month" :min="1" :max="31" style="width: 120px" />
        </el-form-item>
        <el-form-item label="下次执行">
          <el-date-picker v-model="form.next_run_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useLedgerStore } from '@/stores/ledger';
import { useAccountStore } from '@/stores/account';
import { useCategoryStore } from '@/stores/category';
import { useCurrencyStore } from '@/stores/currency';
import type { RecurringRule, RecurringFrequency } from '@shared/types';

const ledgerStore = useLedgerStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const currencyStore = useCurrencyStore();

const rules = ref<RecurringRule[]>([]);
const showDialog = ref(false);
const editing = ref<RecurringRule | null>(null);

const form = reactive({
  type: 1 as 1 | 2,
  amount: 100,
  account_id: null as number | null,
  category_id: null as number | null,
  frequency: 'monthly' as RecurringFrequency,
  day_of_month: 1,
  next_run_date: '',
  note: '',
});

const kindCategories = computed(() =>
  categoryStore.categories.filter((c) => c.kind === (form.type === 2 ? 'income' : 'expense') && !c.parent_id)
);

/** 账本基准币种 */
const baseCode = computed(() => ledgerStore.current()?.currency ?? 'CNY');
const baseSymbol = computed(() => currencyStore.get(baseCode.value)?.symbol || baseCode.value);

function accountName(id: number) {
  return accountStore.accounts.find((a) => a.id === id)?.name ?? '-';
}
function categoryName(id: number | null) {
  return categoryStore.categories.find((c) => c.id === id)?.name ?? '-';
}
function freqText(f: string) {
  return { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }[f] ?? f;
}

async function refresh() {
  const id = ledgerStore.currentId;
  if (!id) return;
  if (!currencyStore.currencies.length) await currencyStore.load();
  rules.value = await window.moneyBook.recurring.list(id);
}

function openCreate() {
  editing.value = null;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  form.type = 1;
  form.amount = 100;
  form.account_id = accountStore.accounts[0]?.id ?? null;
  form.category_id = null;
  form.frequency = 'monthly';
  form.day_of_month = 1;
  form.next_run_date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  form.note = '';
  showDialog.value = true;
}

function openEdit(r: RecurringRule) {
  editing.value = r;
  form.type = r.type as 1 | 2;
  form.amount = r.amount;
  form.account_id = r.account_id;
  form.category_id = r.category_id;
  form.frequency = r.frequency;
  form.day_of_month = r.day_of_month ?? 1;
  form.next_run_date = r.next_run_date;
  form.note = r.note;
  showDialog.value = true;
}

async function save() {
  const id = ledgerStore.currentId;
  if (!id) return;
  if (!form.account_id || !form.category_id || form.amount <= 0) {
    ElMessage.warning('请完整填写规则');
    return;
  }
  try {
    const payload = {
      ledger_id: id,
      account_id: form.account_id,
      category_id: form.category_id,
      type: form.type,
      amount: form.amount,
      frequency: form.frequency,
      day_of_month: form.frequency === 'monthly' ? form.day_of_month : null,
      next_run_date: form.next_run_date,
      note: form.note,
    };
    if (editing.value) {
      await window.moneyBook.recurring.update(editing.value.id, payload);
    } else {
      await window.moneyBook.recurring.create(payload);
    }
    ElMessage.success('保存成功');
    showDialog.value = false;
    refresh();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function removeRule(id: number) {
  await window.moneyBook.recurring.remove(id);
  ElMessage.success('删除成功');
  refresh();
}

async function runDue() {
  const count = await window.moneyBook.recurring.runDue();
  ElMessage.success(`已生成 ${count} 条周期账单流水`);
  refresh();
}

onMounted(refresh);
</script>

<style scoped>
.header-actions {
  display: flex;
  gap: 8px;
}
</style>
