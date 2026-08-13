/**
 * 冒烟测试：验证服务层核心业务逻辑（仅 MONEYBOOK_SMOKE=1 时运行）
 * 使用独立 userData 目录，不影响真实数据
 */
import { initDatabase, getDb } from './db/database';
import * as ledgerService from './services/ledger.service';
import * as accountService from './services/account.service';
import * as transactionService from './services/transaction.service';
import * as reportService from './services/report.service';
import * as budgetService from './services/budget.service';
import * as recurringService from './services/recurring.service';

let failed = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`, detail ?? '');
  }
}

export function runSmokeTest(): void {
  console.log('=== MoneyBook 冒烟测试 ===');
  initDatabase();

  // 1. 创建账本（应自动预置默认分类）
  const ledger = ledgerService.createLedger({ name: '冒烟测试账本', icon: '🧪' });
  check('创建账本', ledger.id > 0 && ledger.name === '冒烟测试账本');
  const cats = require('./services/category.service').listCategories(ledger.id);
  check('预置默认分类', cats.length === 14, `分类数=${cats.length}`);
  const expenseCat = cats.find((c: { kind: string }) => c.kind === 'expense');
  const incomeCat = cats.find((c: { kind: string }) => c.kind === 'income');

  // 2. 创建账户
  const cash = accountService.createAccount({ ledger_id: ledger.id, name: '现金', type: 'cash', balance: 1000 });
  const bank = accountService.createAccount({ ledger_id: ledger.id, name: '银行卡', type: 'bank_card', balance: 5000 });
  check('创建账户', cash.id > 0 && bank.id > 0);

  // 3. 记一笔支出 100（现金余额应减为 900）
  const t1 = transactionService.createTransaction({
    ledger_id: ledger.id,
    account_id: cash.id,
    category_id: expenseCat.id,
    type: 1,
    amount: 100,
    note: '午饭',
  });
  check('记支出', t1.id > 0);
  const cashAfter = accountService.getAccount(cash.id)!;
  check('支出后余额 900', cashAfter.balance === 900, `余额=${cashAfter.balance}`);

  // 4. 记一笔收入 500（现金余额应变为 1400）
  transactionService.createTransaction({
    ledger_id: ledger.id,
    account_id: cash.id,
    category_id: incomeCat.id,
    type: 2,
    amount: 500,
    note: '工资',
  });
  const cashAfter2 = accountService.getAccount(cash.id)!;
  check('收入后余额 1400', cashAfter2.balance === 1400, `余额=${cashAfter2.balance}`);

  // 5. 转账 300 现金→银行卡
  transactionService.createTransaction({
    ledger_id: ledger.id,
    account_id: cash.id,
    transfer_account_id: bank.id,
    category_id: null,
    type: 3,
    amount: 300,
  });
  const cashAfter3 = accountService.getAccount(cash.id)!;
  const bankAfter = accountService.getAccount(bank.id)!;
  check('转账后现金 1100', cashAfter3.balance === 1100, `现金=${cashAfter3.balance}`);
  check('转账后银行卡 5300', bankAfter.balance === 5300, `银行卡=${bankAfter.balance}`);

  // 6. 修改流水：把 100 支出改为 200
  const t1Updated = transactionService.updateTransaction(t1.id, { amount: 200 });
  check('修改流水金额', t1Updated.amount === 200);
  const cashAfter4 = accountService.getAccount(cash.id)!;
  check('修改后余额 1000', cashAfter4.balance === 1000, `余额=${cashAfter4.balance}`);

  // 7. 删除该流水（余额应回滚到 1200）
  transactionService.deleteTransaction(t1.id);
  const cashAfter5 = accountService.getAccount(cash.id)!;
  check('删除后余额 1200', cashAfter5.balance === 1200, `余额=${cashAfter5.balance}`);

  // 8. 报表汇总
  const now = new Date();
  const summary = reportService.reportSummary(ledger.id, now.getFullYear(), now.getMonth() + 1);
  check('报表收入 500', summary.income_total === 500, `收入=${summary.income_total}`);
  check('报表支出 0', summary.expense_total === 0, `支出=${summary.expense_total}`);
  check('报表结余 500', summary.balance === 500, `结余=${summary.balance}`);

  // 9. 预算保存与查询
  const budget = budgetService.saveBudget({
    ledger_id: ledger.id,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    total_amount: 2000,
    items: [{ category_id: expenseCat.id, amount: 800 }],
  });
  check('保存预算', budget.total_amount === 2000);
  const budgetQ = budgetService.getBudgetWithUsage(ledger.id, now.getFullYear(), now.getMonth() + 1);
  check('预算使用额 0', budgetQ?.used_amount === 0, `used=${budgetQ?.used_amount}`);

  // 10. 周期账单：创建规则并执行到期
  const rule = recurringService.createRecurringRule({
    ledger_id: ledger.id,
    account_id: cash.id,
    category_id: expenseCat.id,
    type: 1,
    amount: 100,
    frequency: 'monthly',
    day_of_month: 1,
    next_run_date: '2000-01-01', // 过去日期，应触发
  });
  check('创建周期规则', rule.id > 0);
  const runCount = recurringService.runDueRecurring();
  check('执行到期周期账单 1 条', runCount === 1, `生成=${runCount}`);
  const cashAfter6 = accountService.getAccount(cash.id)!;
  check('周期账单后余额 1100', cashAfter6.balance === 1100, `余额=${cashAfter6.balance}`);

  // 11. 流水分页查询
  const list = transactionService.listTransactions({ ledger_id: ledger.id, page: 1, page_size: 10 });
  check('流水列表查询', list.total >= 2 && list.items.length >= 2, `total=${list.total}`);

  // 12. 设置保存
  const systemService = require('./services/system.service');
  systemService.setSettings({ theme: 'dark' });
  const settings = systemService.getSettings();
  check('设置保存读取', settings.theme === 'dark');

  // 13. 数据导出（CSV/JSON）
  const expCsv = systemService.exportData(ledger.id, 'csv');
  check('导出 CSV', expCsv.count >= 2);
  const expJson = systemService.exportData(ledger.id, 'json');
  check('导出 JSON', expJson.count >= 2);

  // 14. 数据导入（导出文件再导入新账本）
  const ledger2 = ledgerService.createLedger({ name: '导入目标账本' });
  const imp = systemService.importData(expJson.file_path, ledger2.id);
  check('导入 JSON', imp.imported >= 2, `imported=${imp.imported}`);

  // 15. 备份
  const backup = systemService.createBackup();
  check('创建备份', backup.size > 0);

  console.log(failed === 0 ? '=== ✅ 全部冒烟测试通过 ===' : `=== ❌ ${failed} 项测试失败 ===`);
  // eslint-disable-next-line no-process-exit
  process.exit(failed === 0 ? 0 : 1);
}
