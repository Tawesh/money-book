<template>
  <div class="page-container">
    <div class="page-header">
      <h2>统计报表</h2>
      <div class="month-nav">
        <el-button size="small" @click="shiftMonth(-1)">‹ 上月</el-button>
        <span class="month-label">{{ year }} 年 {{ month }} 月</span>
        <el-button size="small" @click="shiftMonth(1)">下月 ›</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="8">
        <div class="card stat-card">
          <div class="stat-label">收入</div>
          <div class="stat-value money-income">+{{ baseSymbol }}{{ (summary?.income_total ?? 0).toFixed(2) }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="card stat-card">
          <div class="stat-label">支出</div>
          <div class="stat-value money-expense">-{{ baseSymbol }}{{ (summary?.expense_total ?? 0).toFixed(2) }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="card stat-card">
          <div class="stat-label">结余</div>
          <div class="stat-value" :class="balanceClass">{{ baseSymbol }}{{ (summary?.balance ?? 0).toFixed(2) }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="14">
        <div class="card">
          <div class="card-title">收支趋势（{{ month }}月）</div>
          <div ref="trendEl" class="chart" />
        </div>
      </el-col>
      <el-col :span="10">
        <div class="card">
          <div class="card-title">支出分类占比</div>
          <div v-if="!summary?.by_category.length" class="empty-tip">本月暂无支出</div>
          <div ref="pieEl" v-show="summary?.by_category.length" class="chart" />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="card">
          <div class="card-title">支出分类排行</div>
          <el-table :data="summary?.by_category ?? []" size="small" stripe>
            <el-table-column label="分类">
              <template #default="{ row }">{{ row.icon }} {{ row.name }}</template>
            </el-table-column>
            <el-table-column label="金额" align="right">
              <template #default="{ row }">{{ baseSymbol }}{{ row.amount.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="占比" width="140">
              <template #default="{ row }">
                <el-progress :percentage="row.percent" :stroke-width="8" :show-text="false" />
                <span class="percent-text">{{ row.percent }}%</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card">
          <div class="card-title">支出账户排行</div>
          <el-table :data="summary?.top_accounts ?? []" size="small" stripe>
            <el-table-column prop="name" label="账户" />
            <el-table-column label="金额" align="right">
              <template #default="{ row }">{{ baseSymbol }}{{ row.amount.toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import * as echarts from 'echarts';
import { useLedgerStore } from '@/stores/ledger';
import { useCurrencyStore } from '@/stores/currency';
import type { ReportSummary } from '@shared/types';

const ledgerStore = useLedgerStore();
const currencyStore = useCurrencyStore();
const summary = ref<ReportSummary | null>(null);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const trendEl = ref<HTMLElement>();
const pieEl = ref<HTMLElement>();
let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;

const balanceClass = computed(() => (summary.value && summary.value.balance >= 0 ? 'money-income' : 'money-expense'));
/** 报表基准币种符号（账本币种） */
const baseSymbol = computed(() => {
  const code = summary.value?.base_currency ?? 'CNY';
  return currencyStore.get(code)?.symbol || code;
});

async function refresh() {
  const id = ledgerStore.currentId;
  if (!id) return;
  if (!currencyStore.currencies.length) await currencyStore.load();
  summary.value = await window.moneyBook.report.summary(id, year.value, month.value);
  render();
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

function render() {
  if (!summary.value) return;
  if (trendEl.value) {
    trendChart ??= echarts.init(trendEl.value);
    trendChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['收入', '支出'] },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: summary.value.daily_trend.map((d) => d.date.slice(5)) },
      yAxis: { type: 'value' },
      series: [
        { name: '收入', type: 'bar', data: summary.value.daily_trend.map((d) => d.income), itemStyle: { color: '#67c23a' } },
        { name: '支出', type: 'bar', data: summary.value.daily_trend.map((d) => d.expense), itemStyle: { color: '#f56c6c' } },
      ],
    });
  }
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
  trendChart?.resize();
  pieChart?.resize();
}

onMounted(() => {
  window.addEventListener('resize', onResize);
  refresh();
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  trendChart?.dispose();
  pieChart?.dispose();
});
</script>

<style scoped>
.month-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}
.month-label {
  font-size: 15px;
  font-weight: 600;
  min-width: 110px;
  text-align: center;
}
.stat-card {
  text-align: center;
  padding: 20px;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  margin-top: 6px;
}
.card-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.chart {
  height: 300px;
}
.empty-tip {
  color: var(--color-text-secondary);
  text-align: center;
  padding: 60px 0;
}
.percent-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 8px;
}
</style>
