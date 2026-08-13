<template>
  <div class="page-container">
    <div class="page-header">
      <h2>账户</h2>
      <el-button type="primary" @click="openCreate">＋ 新增账户</el-button>
    </div>

    <el-row :gutter="16">
      <el-col v-for="a in accountStore.accounts" :key="a.id" :span="8" style="margin-bottom: 16px">
        <div class="card account-card">
          <div class="account-head">
            <span class="account-icon">{{ a.icon }}</span>
            <span class="account-name">{{ a.name }}</span>
            <el-tag size="small" type="info">{{ typeText(a.type) }}</el-tag>
          </div>
          <div class="account-balance">¥{{ (a.balance ?? 0).toFixed(2) }}</div>
          <div class="account-actions">
            <el-button link type="primary" size="small" @click="openEdit(a)">编辑</el-button>
            <el-popconfirm title="确认删除该账户？" @confirm="removeAccount(a.id)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-empty v-if="!accountStore.accounts.length" description="暂无账户，点击右上角创建" />

    <el-dialog v-model="showDialog" :title="editing ? '编辑账户' : '新增账户'" width="420px">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如：招商银行卡" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="t in accountTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标">
          <EmojiPicker v-model="form.icon" placeholder="点击选择 Emoji" />
        </el-form-item>
        <el-form-item label="期初余额">
          <el-input-number v-model="form.balance" :precision="2" :step="100" style="width: 200px" />
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
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useLedgerStore } from '@/stores/ledger';
import { useAccountStore } from '@/stores/account';
import type { Account } from '@shared/types';
import EmojiPicker from '@/components/EmojiPicker.vue';

const ledgerStore = useLedgerStore();
const accountStore = useAccountStore();

const accountTypes = [
  { value: 'cash', label: '现金' },
  { value: 'bank_card', label: '银行卡' },
  { value: 'credit_card', label: '信用卡' },
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信' },
  { value: 'other', label: '其他' },
];

const showDialog = ref(false);
const editing = ref<Account | null>(null);
const form = reactive({
  name: '',
  type: 'other' as Account['type'],
  icon: '💳',
  balance: 0,
});

function typeText(t: string) {
  return accountTypes.find((x) => x.value === t)?.label ?? t;
}

function openCreate() {
  editing.value = null;
  form.name = '';
  form.type = 'other';
  form.icon = '💳';
  form.balance = 0;
  showDialog.value = true;
}

function openEdit(a: Account) {
  editing.value = a;
  form.name = a.name;
  form.type = a.type;
  form.icon = a.icon;
  form.balance = a.balance;
  showDialog.value = true;
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入账户名称');
    return;
  }
  const id = ledgerStore.currentId;
  if (!id) return;
  try {
    if (editing.value) {
      await accountStore.update(editing.value.id, { name: form.name, type: form.type, icon: form.icon });
    } else {
      await accountStore.create({
        ledger_id: id,
        name: form.name.trim(),
        type: form.type,
        icon: form.icon,
        balance: form.balance,
      });
    }
    ElMessage.success('保存成功');
    showDialog.value = false;
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function removeAccount(id: number) {
  await accountStore.remove(id);
  ElMessage.success('删除成功');
}

onMounted(async () => {
  const id = ledgerStore.currentId;
  if (id) await accountStore.load(id);
});
</script>

<style scoped>
.account-card {
  position: relative;
  padding: 20px;
  transition: box-shadow 0.2s;
}
.account-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.account-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.account-icon {
  font-size: 22px;
}
.account-name {
  font-weight: 600;
  flex: 1;
}
.account-balance {
  font-size: 26px;
  font-weight: 700;
  margin: 14px 0;
}
.account-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
