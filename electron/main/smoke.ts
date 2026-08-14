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

  // 16. 货币与汇率：列表/换算/新增/更新/删除
  const currencyService = require('./services/currency.service');
  const currencies = currencyService.listCurrencies();
  check('货币列表含 CNY/USD', currencies.some((c: { code: string }) => c.code === 'CNY') && currencies.some((c: { code: string }) => c.code === 'USD'));
  const conv = currencyService.convert(100, 'USD', 'CNY');
  check('汇率换算 100 USD = 720 CNY', Math.abs(conv - 720) < 0.01, `got=${conv}`);
  const conv2 = currencyService.convert(720, 'CNY', 'USD');
  check('反向换算 720 CNY = 100 USD', Math.abs(conv2 - 100) < 0.01, `got=${conv2}`);
  currencyService.addCurrency('TST', '测试币', 'T', 2);
  const convTest = currencyService.convert(10, 'TST', 'CNY');
  check('新增货币换算 10 TST = 20 CNY', Math.abs(convTest - 20) < 0.01, `got=${convTest}`);
  currencyService.updateRate('TST', 3);
  const convTest2 = currencyService.convert(10, 'TST', 'CNY');
  check('更新汇率后 10 TST = 30 CNY', Math.abs(convTest2 - 30) < 0.01, `got=${convTest2}`);
  currencyService.removeCurrency('TST');
  const testGone = currencyService.listCurrencies().some((c: { code: string }) => c.code === 'TST');
  check('删除测试货币', !testGone);

  // 17. 标签：预置/创建/更新/删除
  const tagService = require('./services/tag.service');
  const seededTags = tagService.listTags(ledger.id);
  check('新账本预置默认标签', seededTags.length >= 8, `count=${seededTags.length}`);
  const tag = tagService.createTag({ ledger_id: ledger.id, name: '出差', icon: '🏢' });
  check('创建标签', tag.id > 0 && tag.name === '出差');
  const tagUpdated = tagService.updateTag(tag.id, { name: '商务出差' });
  check('更新标签', tagUpdated.name === '商务出差');
  const txnWithTag = transactionService.createTransaction({
    ledger_id: ledger.id,
    account_id: cash.id,
    category_id: expenseCat.id,
    type: 1,
    amount: 66,
    note: '机票',
    tags: ['商务出差'],
  });
  check('流水携带标签', (txnWithTag.tags ?? []).includes('商务出差'));
  const tagFiltered = transactionService.listTransactions({ ledger_id: ledger.id, tag: '商务出差', page: 1, page_size: 20 });
  check('按标签筛选流水', tagFiltered.total >= 1 && tagFiltered.items[0]?.note === '机票', `total=${tagFiltered.total}`);
  tagService.removeTag(tag.id);
  check('删除标签', !tagService.listTags(ledger.id).some((t: { id: number }) => t.id === tag.id));

  console.log(failed === 0 ? '=== ✅ 全部冒烟测试通过 ===' : `=== ❌ ${failed} 项测试失败 ===`);
  // eslint-disable-next-line no-process-exit
  process.exit(failed === 0 ? 0 : 1);
}
