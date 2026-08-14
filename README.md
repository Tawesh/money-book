# 💰 MoneyBook 个人记账本

一款基于 **Electron + Vue 3** 的本地记账桌面应用。数据 **100% 存储在本地 SQLite**，无广告、无云依赖、隐私可控。

![tech](https://img.shields.io/badge/Electron-33-blue) ![tech](https://img.shields.io/badge/Vue-3.5-green) ![tech](https://img.shields.io/badge/TypeScript-5.9-blue) ![tech](https://img.shields.io/badge/SQLite-better--sqlite3-orange)

---

## ✨ 功能特性

| 模块 | 说明 |
| --- | --- |
| 📒 多账本 | 创建/切换多本账本（生活账、旅行账…），自动预置分类与场景标签 |
| 💱 多币种 + 汇率 | 内置 15+ 主流货币，支持自定义汇率；账户可设独立币种；报表/预算按账本基准币种自动换算 |
| 🏷️ 标签 / 场景 | 通勤/聚餐/旅行/家庭… 场景标签，记账多选、流水页按标签筛选 |
| 💳 账户管理 | 现金/银行卡/信用卡/支付宝/微信等账户，余额自动联动，支持币种 |
| ✍️ 快速记账 | 支出/收入/转账，支持分类、账户、币种、日期、备注、标签，**Ctrl+N 或一键记一笔** |
| 📋 流水管理 | 多条件筛选（类型/账户/分类/标签/日期/关键词）、分页、编辑、删除 |
| 📊 统计报表 | 月度收支汇总、分类占比饼图、每日趋势、账户排行（多币种统一换算） |
| 🎯 预算管理 | 按月/按分类设置预算，进度条与超支提醒（按基准币种统计） |
| 🔁 周期账单 | 房租/会员等自动生成（日/周/月/年频率），启动自动执行 |
| 🔐 应用锁 | 启动锁定 + 立即锁定，PBKDF2 加盐口令 |
| 💾 数据安全 | 自动备份（保留 10 份）、手动备份、CSV/JSON 导入导出 |
| 🖥️ 系统托盘 | 托盘图标、显示/隐藏窗口、快速记账、本月收支概览、关闭/最小化到托盘 |
| 🌗 主题 | 浅色 / 深色 / 跟随系统 |

## 🛠 技术栈

- **桌面壳**：Electron 33（contextIsolation + preload 白名单 API）
- **前端**：Vue 3 (Composition API) + TypeScript + Vite
- **UI**：Element Plus + ECharts
- **状态**：Pinia，路由：Vue Router 4
- **存储**：better-sqlite3（WAL 模式，事务保证记账一致性）
- **打包**：electron-builder（NSIS 安装包）

## 📁 目录结构

```
application-money/
├── electron/
│   ├── main/                 # 主进程
│   │   ├── index.ts          # 入口：窗口/数据库初始化/周期账单/托盘
│   │   ├── db/database.ts    # SQLite 连接与迁移（user_version 管理）
│   │   ├── ipc/index.ts      # IPC 路由（统一 {code,message,data} 协议）
│   │   ├── services/         # 业务服务层
│   │   │   ├── transaction.service.ts  # 流水（事务性记账+余额联动）
│   │   │   ├── report.service.ts       # 报表聚合（多币种换算）
│   │   │   ├── budget.service.ts       # 预算
│   │   │   ├── recurring.service.ts    # 周期账单
│   │   │   ├── currency.service.ts     # 货币与汇率
│   │   │   ├── tag.service.ts          # 标签/场景
│   │   │   ├── tray.service.ts         # 系统托盘
│   │   │   ├── system.service.ts       # 备份/导入导出/应用锁/设置
│   │   │   └── ledger|account|category.service.ts
│   │   └── smoke.ts          # 冒烟测试（核心业务断言）
│   ├── preload/index.ts      # contextBridge 暴露 window.moneyBook.*
│   └── shared/types.ts       # 前后端共享类型契约
├── src/                      # 渲染进程（Vue 3 SPA）
│   ├── views/                # 页面：概览/流水/报表/预算/账户/分类/标签/货币汇率/周期账单/设置
│   ├── components/           # 布局、快捷记账弹窗、锁屏
│   ├── stores/               # Pinia：账本/账户/分类/标签/货币/流水/应用
│   ├── router/               # 路由
│   └── styles/               # 全局样式与主题变量
├── resources/                # 应用图标
└── release/                  # 打包产物
```

## 🚀 快速开始

### 环境要求
- Node.js ≥ 18
- 已安装依赖（含 Electron 二进制与 better-sqlite3 预编译模块）

### 开发模式
```bash
npm install          # 安装依赖（postinstall 会自动 rebuild 原生模块）
npm run dev          # Vite HMR + Electron 开发调试
```

### 生产构建
```bash
npm run build        # 编译主进程 + 构建渲染进程
npm start            # 运行生产构建产物
```

### 打包安装程序
```bash
npm run dist         # electron-builder 生成 NSIS 安装包（release/ 目录）
```

> **网络提示**：国内环境 Electron 二进制下载慢，可配置镜像：
> ```bash
> set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> ```

## 🧪 测试

内置冒烟测试，覆盖核心业务逻辑（记账事务、余额联动、转账、修改/删除回滚、报表、预算、周期账单、导入导出、备份、货币汇率、标签）：

```bash
# 使用独立数据目录运行，不污染真实数据
set MONEYBOOK_SMOKE=1
set MONEYBOOK_USER_DATA=D:\path\to\test-data
electron .
```

输出示例：`=== ✅ 全部冒烟测试通过 ===`

## 🗄 数据存储位置

| 平台 | 路径 |
| --- | --- |
| Windows | `%APPDATA%\MoneyBook\moneybook.db` |
| macOS | `~/Library/Application Support/MoneyBook/moneybook.db` |
| Linux | `~/.config/MoneyBook/moneybook.db` |

备份目录：`<userData>/backups/`，导出目录：`<userData>/exports/`

## 🎨 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+N` | 快速记一笔 |
| `Ctrl+F` | 流水页搜索（定位） |
| `Esc` | 关闭弹窗/返回 |

## 🖥️ 系统托盘

- 托盘图标：左键单击切换窗口显示/隐藏，双击显示窗口
- 右键菜单：显示/隐藏主窗口、✏️ 快速记账、本月收入/支出概览（每 60s 自动刷新）、退出
- 设置项：启用托盘、关闭窗口时最小化到托盘、最小化时隐藏到托盘

## 💱 多币种说明

- 汇率定义：**1 单位外币 = rate 单位人民币（CNY）**，CNY 为基准锚点
- 账本可设置基准币种（默认 CNY），报表/预算汇总自动换算为基准币种
- 账户可设置独立币种，记账时币种默认跟随账户
- 货币与汇率可在「货币汇率」页管理（增删改）

## 📄 文档

详细设计文档见 [docs/design/个人记账本-软件开发设计文档.md](docs/design/个人记账本-软件开发设计文档.md)，包含：
- 核心功能清单（MoSCoW 优先级）
- 数据库 ER 图与字段说明
- RESTful API 设计（12 个接口）
- 前端路由与组件划分
- 非功能性需求（性能/安全/可靠性）
- 未来扩展路线图

## 🔒 安全设计

- `contextIsolation: true` + `sandbox`，渲染进程无法直接访问 Node API
- IPC 白名单通信（`window.moneyBook.*`），主进程统一校验
- 应用锁口令 PBKDF2（100k 迭代）加盐哈希存储
- 本地 SQLite WAL 模式，事务保证记账一致性

## 📌 Roadmap

- [x] v1.0：本地记账核心（记账/流水/报表/导入导出/多账本）
- [x] v1.1：应用锁、预算、周期账单、备份、深色主题
- [x] v1.2：多币种+汇率、标签/场景、系统托盘快捷记账
- [ ] v2.0：银行/支付宝账单智能导入、数据可视化大屏
- [ ] v3.0：端到端加密云同步、Web/Mobile 端

## 📝 License

MIT
