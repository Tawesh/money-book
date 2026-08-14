<template>
  <div class="page-container">
    <div class="page-header">
      <h2>货币与汇率</h2>
      <el-button type="primary" @click="openCreate">＋ 新增货币</el-button>
    </div>

    <div class="card">
      <div class="card-title">
        汇率管理
        <span class="tip-text">汇率为 1 单位外币 = 多少人民币(CNY)，报表按账本基准币种换算</span>
      </div>
      <el-table :data="currencyStore.currencies" size="small" stripe>
        <el-table-column label="代码" width="100">
          <template #default="{ row }">
            <b>{{ row.code }}</b>
          </template>
        </el-table-column>
        <el-table-column label="名称" prop="name" width="140" />
        <el-table-column label="符号" prop="symbol" width="90" />
        <el-table-column label="汇率（1 单位 = CNY）" width="220">
          <template #default="{ row }">
            <el-input-number
              v-model="row.rate"
              :precision="4"
              :step="0.1"
              :min="0.0001"
              size="small"
              :disabled="row.code === 'CNY'"
              style="width: 180px"
              @change="(v: number) => onRateChange(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="更新时间" prop="updated_at" width="180" />
        <el-table-column label="操作" align="center">
          <template #default="{ row }">
            <el-popconfirm
              v-if="row.code !== 'CNY'"
              title="确认删除该货币？"
              @confirm="removeCurrency(row.code)"
            >
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
            <span v-else class="tip-text">基准币种</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="showDialog" title="新增货币" width="420px">
      <el-form label-width="80px">
        <el-form-item label="代码">
          <el-input v-model="form.code" placeholder="如：USD（3 位字母）" maxlength="3" style="width: 200px" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如：美元" />
        </el-form-item>
        <el-form-item label="符号">
          <el-input v-model="form.symbol" placeholder="如：$" style="width: 120px" />
        </el-form-item>
        <el-form-item label="汇率">
          <el-input-number v-model="form.rate" :precision="4" :step="0.1" :min="0.0001" style="width: 200px" />
          <span class="tip-text">1 单位 = 多少 CNY</span>
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
import { useCurrencyStore } from '@/stores/currency';
import type { Currency } from '@shared/types';

const currencyStore = useCurrencyStore();

const showDialog = ref(false);
const form = reactive({ code: '', name: '', symbol: '', rate: 1 });

function openCreate() {
  form.code = '';
  form.name = '';
  form.symbol = '';
  form.rate = 1;
  showDialog.value = true;
}

async function save() {
  if (!/^[A-Za-z]{3}$/.test(form.code)) {
    ElMessage.warning('货币代码需为 3 位字母');
    return;
  }
  if (!form.rate || form.rate <= 0) {
    ElMessage.warning('汇率必须大于 0');
    return;
  }
  try {
    await currencyStore.add(
      form.code.toUpperCase(),
      form.name.trim() || form.code.toUpperCase(),
      form.symbol.trim(),
      form.rate
    );
    ElMessage.success('货币已添加');
    showDialog.value = false;
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function onRateChange(row: Currency, v: number) {
  if (!v || v <= 0) {
    ElMessage.warning('汇率必须大于 0');
    return;
  }
  try {
    await currencyStore.updateRate(row.code, v);
    ElMessage.success(`${row.code} 汇率已更新`);
  } catch (e) {
    ElMessage.error((e as Error).message);
    currencyStore.load();
  }
}

async function removeCurrency(code: string) {
  try {
    await currencyStore.remove(code);
    ElMessage.success('删除成功');
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

onMounted(currencyStore.load);
</script>

<style scoped>
.card-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.tip-text {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 400;
  margin-left: 8px;
}
</style>
