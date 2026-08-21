---
name: sidor-install
description: 从 Sidor_UI 仓库安装或切换 SIDOR 皮肤：定位并同步仓库、读取皮肤元数据、询问用户确认、交代许可与署名、按持久化插件（install.ps1 / dsh plugin add）或动态插件路径安装并验证。当用户要求安装/切换 SIDOR 皮肤（星野控制台皮肤、sidor-ui）或"安装皮肤包"时使用。
---

# Sidor_UI 安装

目标：帮用户从本仓库（Sidor_UI，SIDOR 星野控制台皮肤）安装/启用皮肤，一次说清
"这是什么、怎么装、能干什么不能干什么"，然后让皮肤生效。

**本技能只给流程指导，具体事实以现场读取为准**：仓库会更新，不要依赖记忆中的清单，
每一步都实时读取仓库文件（`skin.json`、`README.md`、`NOTICE`、`scripts/install.ps1`）。

## 流程

### 1. 定位仓库并同步

- 优先在当前工作目录找 `skin.json`（仓库根）；找不到就问用户仓库路径，或
  `git clone <GitHub URL>` 到临时目录（懒人版场景）。
- 确认最新：`git fetch origin` + `git status -sb`（落后时 `git pull --ff-only`）。

### 2. 读取皮肤元数据（实时）

读取仓库根 `skin.json`：
- `id` / `name` / `nameEn` / `tagline`（一句话介绍）
- `package`（npm 包名 `sidor-ui`）、`wiring.id`（patch 层控制的插件 id `sidor-ui`）
- `preview`（如有亮/暗预览图可展示）

### 3. 与用户交互：确认安装（必做）

用交互工具（如 `ask_user_question`）向用户确认：安装 SIDOR 星野皮肤（描述 tagline），
并提供"保持现状/不安装"选项。**不要跳过确认擅自安装。**

### 4. 向用户交代许可（安装前必做）

- 以 `LICENSE` / `NOTICE` 实际内容为准。当前为 **MIT**（SIDOR 品牌标识归项目所有）。
- 说明：SIDOR 是纯展示层 client 插件，不注入服务、不发 Cordis 事件、不触达模型请求；
  余额 API Key 仅保存在本机（动态形态 `.sidor-balance.json` / 静态形态 localStorage）。

### 5. 安装（两种形态，先查环境）

先查当前 dsh 环境：`dsh plugin --profile web list`（或实际 profile 名）看是否已安装：

- **已安装 → 直接验证**（无需重复安装）。
- **未安装 → 按序尝试**：
  1. **持久化静态插件**（推荐）：运行 `powershell -ExecutionPolicy Bypass -File
     <仓库>\scripts\install.ps1`（把包装进 `~/.dsh/profiles/web/node_modules/sidor-ui` +
     写入 `~/.dsh/profiles/web/cordis.patch.yml`）。**需要重启 dsh 生效**。
  2. 或官方命令（需 pnpm）：`dsh plugin --profile web add <仓库路径>`。
  3. **动态插件**（用户要求全功能/懒人版手动）时：按 README"全功能版"指引，用
     `src/sidor-fx-client.js` 与 `src/sidor-fx-host.js` 在 Cordis 面板定义并运行。

### 6. 验证生效

- `dsh --profile web --dump-config` 核对 `sidor-ui` 行存在且 patch 来源正确。
- 浏览器硬刷新（Ctrl+Shift+R）；开屏动画出现即生效。
- 皮肤异常（控制台报错、布局问题）时收集现象再排查，优先检查
  `lib/client.js` 是否为最新（改过 `src/` 需先跑 `scripts/build-client.ps1`）。

## 已知要点（判断用，非写死事实）

- SIDOR 是叠加式 client 插件（不是互斥皮肤开关），通过官方 Slot 注册
  （`shell.overlay` / `settings.section` / `sidebar.footer.action` 等）。
- 静态形态无 host RPC 通道：余额配置走 localStorage、余额查询走浏览器 fetch
  （CORS 被拒时 UI 显示错误）、文档上传不支持落盘——「文档」按钮降级为路径选择
  （原生文件夹选择器 / 手动填路径，贴入输入框由 agent 工具读取）。
- 源码唯一真源是 `src/sidor-fx-client.js`；`lib/client.js` 由
  `scripts/build-client.ps1` 从 src 生成（ModuleLoader bundle）。
- 反馈问题走仓库 issue。
