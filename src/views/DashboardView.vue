<template>
  <div class="page-container">
    <div class="page-header">
      <h2>概览</h2>
      <div class="header-actions">
        <el-button type="primary" @click="showQuickAdd = true">＋ 记一笔</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <div class="card stat-card">
          <div class="stat-label">本月收入</div>
          <div class="stat-value money-income">+{{ summary?.income_total.toFixed(2) ?? '0.00' }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="card stat-card">
          <div class="stat-label">本月支出</div>
          <div class="stat-value money-expense">-{{ summary?.expense_total.toFixed(2) ?? '0.00' }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="card stat-card">
          <div class="stat-label">本月结余</div>
          <div class="stat-value" :class="balanceClass">{{ (summary?.balance ?? 0).toFixed(2) }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="card stat-card">
          <div class="stat-label">账户总数</div>
          <div class="stat-value">{{ accountStore.accounts.length }}</div>
          <div class="stat-sub">总余额 ¥{{ totalBalance.toFixed(2) }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="14">
        <div class="card">
          <div class="card-title">本月支出趋势</div>
          <div ref="chartEl" class="chart" />
        </div>
      </el-col>
      <el-col :span="10">
        <div class="card">
          <div class="card-title">支出分类占比</div>
          <div v-if="!summary?.by_category.length" class="empty-tip">本月暂无支出记录</div>
          <div ref="pieEl" v-show="summary?.by_category.length" class="chart" />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="24">
        <div class="card">
          <div class="card-title">最近流水</div>
          <el-table :data="recent" size="small" stripe>
            <el-table-column prop="happened_at" label="时间" width="160" />
            <el-table-column label="类型" width="80">
              <template #default="{ row }">
                <el-tag :type="row.type === 2 ? 'success' : row.type === 1 ? 'danger' : 'info'" size="small">
                  {{ typeText(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="分类" width="120">
              <template #default="{ row }">
                {{ row.category_icon }} {{ row.category_name ?? '-' }}
              </template>
            </el-table-column>
            <el-table-column label="账户" prop="account_name" width="120" />
            <el-table-column prop="note" label="备注" show-overflow-tooltip />
            <el-table-column label="金额" width="120" align="right">
              <template #default="{ row }">
                <span :class="row.type === 2 ? 'money-income' : 'money-expense'">
                  {{ row.type === 2 ? '+' : '-' }}{{ row.amount.toFixed(2) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <QuickAddDialog v-if="showQuickAdd" @close="showQuickAdd = false; refresh()" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import * as echarts from 'echarts';
import { useLedgerStore } from '@/stores/ledger';
import { useAccountStore } from '@/stores/account';
import { useCategoryStore } from '@/stores/category';
import type { ReportSummary, TransactionListItem } from '@shared/types';
import QuickAddDialog from '@/components/transaction/QuickAddDialog.vue';

const ledgerStore = useLedgerStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();

const summary = ref<ReportSummary | null>(null);
const recent = ref<TransactionListItem[]>([]);
const showQuickAdd = ref(false);
const chartEl = ref<HTMLElement>();
const pieEl = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;

const totalBalance = computed(() => accountStore.accounts.reduce((s, a) => s + (a.balance ?? 0), 0));
const balanceClass = computed(() => (summary.value && summary.value.balance >= 0 ? 'money-income' : 'money-expense'));

function typeText(t: number) {
  return { 1: '支出', 2: '收入', 3: '转账', 4: '调账' }[t] ?? '-';
}

async function refresh() {
  const id = ledgerStore.currentId;
  if (!id) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [summaryData, listRes] = await Promise.all([
    window.moneyBook.report.summary(id, year, month),
    window.moneyBook.transaction.list({ ledger_id: id, page: 1, page_size: 8 }),
  ]);
  summary.value = summaryData;
  recent.value = listRes.items;
  renderCharts();
}

function renderCharts() {
  if (!summary.value) return;
  // 趋势图
  if (chartEl.value) {
    chart ??= echarts.init(chartEl.value);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['收入', '支出'] },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: summary.value.daily_trend.map((d) => d.date.slice(5)) },
      yAxis: { type: 'value' },
      series: [
        { name: '收入', type: 'line', smooth: true, data: summary.value.daily_trend.map((d) => d.income), itemStyle: { color: '#67c23a' } },
        { name: '支出', type: 'line', smooth: true, data: summary.value.daily_trend.map((d) => d.expense), itemStyle: { color: '#f56c6c' } },
      ],
    });
  }
  // 饼图
  if (pieEl.value && summary.value.by_category.length) {
    pieChart ??= echarts.init(pieEl.value);
    pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [
        {
          type: 'pie',
          radius: ['35%', '65%'],
          data: summary.value.by_category.map((c) => ({ name: `${c.icon} ${c.name}`, value: c.amount })),
        },
      ],
    });
  }
}

function onResize() {
  chart?.resize();
  pieChart?.resize();
}

onMounted(() => {
  window.addEventListener('resize', onResize);
  refresh();
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  chart?.dispose();
  pieChart?.dispose();
});
</script>

<style scoped>
.stat-card {
  text-align: center;
  padding: 20px 16px;
}
.stat-label {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  margin-top: 8px;
}
.stat-sub {
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-top: 6px;
}
.card-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.chart {
  height: 280px;
}
.empty-tip {
  color: var(--color-text-secondary);
  text-align: center;
  padding: 60px 0;
}
</style>
