import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '概览' } },
        { path: 'transactions', name: 'transactions', component: () => import('@/views/TransactionsView.vue'), meta: { title: '流水' } },
        { path: 'reports', name: 'reports', component: () => import('@/views/ReportsView.vue'), meta: { title: '报表' } },
        { path: 'budgets', name: 'budgets', component: () => import('@/views/BudgetsView.vue'), meta: { title: '预算' } },
        { path: 'accounts', name: 'accounts', component: () => import('@/views/AccountsView.vue'), meta: { title: '账户' } },
        { path: 'categories', name: 'categories', component: () => import('@/views/CategoriesView.vue'), meta: { title: '分类' } },
        { path: 'tags', name: 'tags', component: () => import('@/views/TagsView.vue'), meta: { title: '标签' } },
        { path: 'currencies', name: 'currencies', component: () => import('@/views/CurrenciesView.vue'), meta: { title: '货币汇率' } },
        { path: 'recurring', name: 'recurring', component: () => import('@/views/RecurringView.vue'), meta: { title: '周期账单' } },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '设置' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});

export default router;
