# MoneyBook 发布指南（Release & 自动更新）

本项目采用 **GitHub Releases + electron-builder + electron-updater + GitHub Actions** 实现自动发布与客户端自动更新：

```text
开发者修改版本号
      ↓
git tag v1.1.0
      ↓
GitHub Actions（tag 触发）
      ↓
electron-builder 多平台构建
      ↓
GitHub Release
 ├── MoneyBook Setup 1.1.0.exe
 ├── MoneyBook-1.1.0.dmg
 ├── latest.yml / latest-mac.yml / latest-linux.yml（更新元数据）
      ↓
用户启动 MoneyBook
      ↓
electron-updater 检查 GitHub Release
      ↓
发现新版本 → 提示下载 → 重启安装
```

---

## 一、一键发布（推荐）

> 前置条件：已登录 GitHub 且本地仓库能直接 `git push`。

```bash
# 发布一个小版本（1.0.2 -> 1.0.3），提交 + 打 tag + 推送
npm run release:version -- patch --push

# 发布次版本（1.0.3 -> 1.1.0）
npm run release:version -- minor --push

# 发布主版本（1.1.0 -> 2.0.0）
npm run release:version -- major --push

# 指定版本号
npm run release:version -- 1.2.0 --push

# 只更新版本号与 tag，不推送（确认后再手动推送）
npm run release:version -- minor

# 预演：只看将要执行的操作，不做任何修改
npm run release:version -- minor --dry-run
```

脚本执行流程：

1. 校验 git 工作区干净（有未提交改动会中止）；
2. `npm version` 更新 `package.json` / `package-lock.json`，自动生成 commit 与 tag（`release: vX.Y.Z`）；
3. `--push` 时推送分支与 tag；
4. 推送 tag 后，GitHub Actions 自动构建并发布到 GitHub Releases。

> ⚠️ 一键脚本假设 tag 与代码版本号一致（`v1.1.0` 对应 `1.1.0`）。
> electron-updater 通过 `latest.yml` 中的版本号判断更新，必须保证一致。

---

## 二、手动发布

```bash
# 1. 修改 package.json 中的 version（如 1.1.0）
# 2. 提交并打 tag
git add .
git commit -m "release: v1.1.0"
git tag v1.1.0
git push origin main
git push origin v1.1.0
```

GitHub Actions（`.github/workflows/release.yml`）检测到 `v*` 标签后会自动：

- Windows / macOS / Linux 三平台构建；
- 将安装包与 `latest*.yml` 元数据上传到 GitHub Release。

---

## 三、本地构建

```bash
npm run dist          # 构建当前平台安装包（不发布）
npm run release       # 构建并发布到 GitHub（需要 GH_TOKEN 或已登录 gh）
npm run release:win   # 仅 Windows
npm run release:mac   # 仅 macOS
npm run release:linux # 仅 Linux
```

发布到 GitHub 需要令牌，本地可用：

```bash
# 方式一：环境变量（GitHub 上创建 repo 权限的 token）
# Windows PowerShell
$env:GH_TOKEN="ghp_xxxx"; npm run release
# macOS / Linux
GH_TOKEN=ghp_xxxx npm run release

# 方式二：GitHub CLI（推荐，自动携带令牌）
gh auth login
npm run release
```

---

## 四、客户端自动更新逻辑

主进程 `electron/main/services/updater.service.ts`：

- **仅打包后的正式版本**启用（`app.isPackaged`），开发环境不检查；
- 应用启动 5 秒后静默检查 GitHub Releases；
- 发现新版本 → 渲染进程弹窗询问 → 确认后后台下载（显示进度）→ 下载完成提示"立即重启"；
- 应用退出时若有已下载更新会自动安装（`autoInstallOnAppQuit`）。

渲染进程入口：

- `src/components/UpdateChecker.vue`：更新弹窗（发现/下载/重启/错误）；
- `src/stores/updater.ts`：更新状态管理；
- 设置页"关于"卡片提供"检查更新"按钮（手动触发）。

---

## 五、更新元数据（latest.yml）

electron-builder 发布时会生成：

```text
latest.yml          # Windows NSIS 更新元数据
latest-mac.yml      # macOS 更新元数据
latest-linux.yml    # Linux AppImage 更新元数据
```

这些文件记录了最新版本号、安装包下载地址与 SHA-512 校验值，`electron-updater` 据此判断并安全下载更新。**务必随安装包一起上传到同一个 GitHub Release。**

---

## 六、常见问题

| 问题 | 说明 |
| --- | --- |
| 检查更新无反应 | 确认是打包后的正式版（`npm start` 不触发）；确认 GitHub 仓库是 public，且 Release 中存在 `latest.yml` |
| 提示"无法找到 v1.1.0 的更新" | 检查 tag 版本与 `package.json` version 是否一致 |
| Windows 更新后被杀软拦截 | 正式发布建议配置代码签名证书（`CSC_LINK` / `CSC_KEY_PASSWORD`） |
| macOS 提示"已损坏/无法验证" | 需要 Apple Developer 证书签名与 notarization，未签名时用户需右键打开 |
| 私有仓库 | electron-updater 访问私有仓库需额外配置 token，建议将仓库设为 public，或自建更新服务 |

---

## 七、代码签名（正式发布前建议完成）

| 平台 | 方案 |
| --- | --- |
| Windows | 购买代码签名证书，配置 `CSC_LINK`、`CSC_KEY_PASSWORD` 到 GitHub Secrets |
| macOS | Apple Developer 账号，配置 `CSC_LINK`、`CSC_KEY_PASSWORD`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` |

GitHub Actions 工作流已设置 `CSC_IDENTITY_AUTO_DISCOVERY: false`，未配置证书时跳过签名，保证 CI 不因签名失败中断。
