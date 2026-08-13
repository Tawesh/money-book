<template>
  <el-dialog
    :model-value="true"
    :title="editing ? '编辑流水' : '记一笔'"
    width="480px"
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <div class="type-tabs">
      <el-radio-group v-model="form.type" size="large" :disabled="editing">
        <el-radio-button :value="1">支出</el-radio-button>
        <el-radio-button :value="2">收入</el-radio-button>
        <el-radio-button :value="3">转账</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 金额 -->
    <div class="amount-row">
      <el-input
        v-model="amountText"
        size="large"
        class="amount-input"
        placeholder="0.00"
        @keyup.enter="submit"
      />
      <span class="currency">{{ form.currency }}</span>
    </div>

    <!-- 分类（转账时隐藏） -->
    <div v-if="form.type !== 3 && !categoryOptions.length" class="empty-hint">
      暂无{{ form.type === 2 ? '收入' : '支出' }}分类，请先到「分类」页创建
    </div>
    <div v-if="form.type !== 3" class="category-grid">
      <div
        v-for="cat in categoryOptions"
        :key="cat.id"
        class="category-item"
        :class="{ active: form.category_id === cat.id }"
        @click="form.category_id = cat.id"
      >
        <span class="cat-icon">{{ cat.icon }}</span>
        <span class="cat-name">{{ cat.name }}</span>
      </div>
    </div>

    <!-- 账户 -->
    <el-form label-width="70px" class="form-fields">
      <el-form-item v-if="form.type !== 3" label="账户">
        <el-select v-model="form.account_id" placeholder="选择账户" style="width: 100%">
          <el-option v-for="a in accounts" :key="a.id" :label="`${a.icon} ${a.name}`" :value="a.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.type === 3" label="转出账户">
        <el-select v-model="form.account_id" placeholder="选择转出账户" style="width: 100%">
          <el-option v-for="a in accounts" :key="a.id" :label="`${a.icon} ${a.name}`" :value="a.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.type === 3" label="转入账户">
        <el-select v-model="form.transfer_account_id" placeholder="选择转入账户" style="width: 100%">
          <el-option v-for="a in accounts.filter((x) => x.id !== form.account_id)" :key="a.id" :label="`${a.icon} ${a.name}`" :value="a.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="日期">
        <el-date-picker
          v-model="form.happened_at"
          type="datetime"
          placeholder="选择时间"
          style="width: 100%"
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.note" placeholder="选填" maxlength="100" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ editing ? '保存修改' : '保存' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useLedgerStore } from '@/stores/ledger';
import { useAccountStore } from '@/stores/account';
import { useCategoryStore } from '@/stores/category';
import type { TransactionListItem, TransactionType } from '@shared/types';

const props = defineProps<{
  /** 传入则为编辑模式，否则为新增 */
  transaction?: TransactionListItem | null;
}>();
const emit = defineEmits<{ close: [] }>();

const ledgerStore = useLedgerStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();

const accounts = computed(() => accountStore.accounts);
const categories = computed(() => categoryStore.categories);

const editing = computed(() => !!props.transaction);

const amountText = ref('');
const saving = ref(false);

const form = reactive({
  type: 1 as TransactionType,
  account_id: null as number | null,
  transfer_account_id: null as number | null,
  category_id: null as number | null,
  happened_at: '',
  note: '',
  currency: 'CNY',
});

const categoryOptions = computed(() => {
  const kind = form.type === 2 ? 'income' : 'expense';
  return categories.value.filter((c) => c.kind === kind && !c.parent_id);
});

function nowStr(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

onMounted(() => {
  if (props.transaction) {
    // 编辑模式：回填数据
    form.type = props.transaction.type;
    form.account_id = props.transaction.account_id;
    form.transfer_account_id = props.transaction.transfer_account_id;
    form.category_id = props.transaction.category_id;
    form.happened_at = props.transaction.happened_at;
    form.note = props.transaction.note;
    form.currency = props.transaction.currency;
    amountText.value = String(props.transaction.amount);
  } else {
    // 新增模式：默认值
    form.type = 1;
    form.happened_at = nowStr();
    if (accounts.value.length) form.account_id = accounts.value[0].id;
    if (categoryOptions.value.length) form.category_id = categoryOptions.value[0].id;
  }
});

async function submit() {
  const amount = parseFloat(amountText.value);
  if (!amount || amount <= 0) {
    ElMessage.warning('请输入有效金额');
    return;
  }
  if (!accounts.value.length) {
    ElMessage.warning('请先在「账户」页创建账户');
    return;
  }
  if (!form.account_id) {
    ElMessage.warning('请选择账户');
    return;
  }
  if (form.type === 3) {
    if (!form.transfer_account_id) {
      ElMessage.warning('请选择转入账户');
      return;
    }
    if (form.transfer_account_id === form.account_id) {
      ElMessage.warning('转出与转入账户不能相同');
      return;
    }
  } else if (!form.category_id) {
    ElMessage.warning('请选择分类');
    return;
  }

  const payload = {
    ledger_id: ledgerStore.currentId!,
    account_id: form.account_id,
    transfer_account_id: form.type === 3 ? form.transfer_account_id : null,
    category_id: form.type === 3 ? null : form.category_id,
    type: form.type,
    amount,
    currency: form.currency,
    happened_at: form.happened_at,
    note: form.note,
  };

  saving.value = true;
  try {
    if (editing.value) {
      await window.moneyBook.transaction.update(props.transaction!.id, payload);
      ElMessage.success('修改成功');
    } else {
      await window.moneyBook.transaction.create(payload);
      ElMessage.success('记账成功');
    }
    // 刷新账户余额
    await accountStore.load(ledgerStore.currentId!);
    emit('close');
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.type-tabs {
  text-align: center;
  margin-bottom: 12px;
}
.amount-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.amount-input :deep(.el-input__wrapper) {
  height: 56px;
}
.amount-input :deep(input) {
  font-size: 28px;
  text-align: right;
}
.currency {
  font-size: 16px;
  color: var(--color-text-secondary);
  padding-right: 4px;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 16px;
  max-height: 160px;
  overflow-y: auto;
}
.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.category-item:hover {
  border-color: var(--color-primary);
}
.category-item.active {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.1);
}
.cat-icon {
  font-size: 22px;
}
.cat-name {
  font-size: 12px;
  margin-top: 4px;
}
.form-fields {
  margin-top: 8px;
}
.empty-hint {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
  padding: 16px 0;
}
</style>
