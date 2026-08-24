# Sidor UI 开发指南（面向 Sidor 附属插件开发者）

本文档沉淀了 SIDOR 控制台皮肤在 DeepSeek Harness 官方 Web 界面上改造的**全部经验**，
包括官方插槽（Slot）系统、设置页（Settings）结构配置、导航图标替换技巧、官方 CSS
变量、DOM 选择器、自研粒子引擎 API、Host RPC 约定，以及"未来附属插件如何扩展"的
标准做法。开发附属插件前请通读本文。

---

## 1. 架构总览

SIDOR 以 **动态 Cordis 插件**（pluginId `sidf-4`）运行，分两端：

| 端 | 代码 | 职责 |
|----|------|------|
| Client（浏览器） | `src/sidor-fx-client.js` | 开屏动画、星野、侧边栏余额、设置页、各种 DOM 注入特效、文档路径附加（静态/动态通用） |
| Host（Node 进程） | `src/sidor-fx-host.js` | `harness.handle` RPC：余额读写/查询、文档上传（仅动态形态） |

插件通过 **官方插槽（Slots）** 向官方 UI 注册自己的 React 组件，并通过 **DOM 注入 +
MutationObserver** 对官方私有区域做补充特效。动态插件在 DSH 进程重启后丢失，需手动
重新运行（当前 currentPackageId 见 README）。

---

## 2. 官方插槽系统（Slots）

### 2.1 查询插槽（开发前必做）

动态插件里通过 `slots` 服务注入插槽。开发前用 Cordis Inspect 查询精确契约：

```
cordis_inspect_list            → 找 Slots Provider
cordis_inspect_query           → Slots.listSubTree（无 root，看精简树）
                                 Slots.list 精确 root（完整注册契约与 props）
```

### 2.2 注册模板

```js
slots.inject('settings.section', () => slots.register(
  {
    name: 'settings.section',
    id: 'my-plugin-section',     // 必须全局唯一；同 id 会互相覆盖
    order: 25,                   // 决定左侧导航排序（数字小在上）
    label: '我的设置',           // 导航文字，官方自动渲染
  },
  (props) => React.createElement(MySettingsPage, props),
))
```

`order` 参考值（官方默认）：`general 0`、`models 10`、`plugins 15`、`agent-presets 20`。
SIDOR 余额页用 `25`（在 Agent 预设之后）。

### 2.3 已使用插槽清单

| 插槽 | 作用域 | id | order | 说明 |
|------|--------|----|-------|------|
| `shell.overlay` | root（list） | `sidor-fx` | 100 | 全屏覆盖层：开屏动画 → 常驻星野。`pointer-events:none`，仅 intro 期间捕获点击 |
| `shell.overlay` | root（list） | `sidor-plugin-manage` | 200 | 插件管理（见 §12）：向官方"设置→插件列表"卡片注入 关闭/启用/卸载 按钮 + 红色流光二次确认 |
| `settings.section` | root（list） | `sidor-balance` | 25 | 设置页新增一个左侧导航分区 |
| `sidebar.footer.action` | root（list） | `sidor-balance` | -10 | 侧边栏底部动作（余额徽章）；`props.wide` 表示宽/窄轨态 |
| `conversation.input.left` | session（list） | `sidor-filepick` | 10 | 输入框左侧工具（文档路径附加按钮）；props 含 `inputActions`/`sessionId`/`input` |
| `conversation.composer.dock` | session（list） | `sidor-cmp-resize` | 100 | 输入框底部的拖拽把手 |

**要点**：
- 同名插槽是 list 型，多个插件可共存，按 `order` 自动排序——这就是附属插件能"自然并排"的机制。
- `sidebar.footer.action` 官方 cordis 面板占 order 0，SIDOR 用 `-10` 排在其上。
- 设置导航 `label` 由官方自动渲染成 nav 行；`id` 决定官方 `navIcon()` 的回退图标。

---

## 3. 设置页（Settings）结构配置

### 3.1 官方 DOM 结构

```
[class*="settingsArea"]          ← 侧边栏底部的设置入口区域（常驻）
└── [class*="_trigger"]          ← 齿轮触发按钮
[class*="settingsArea"] [class*="_panel"]   ← 点击后弹出的设置面板容器
    ├── [class*="_mask"]         ← 遮罩
    ├── [class*="_panel"]        ← 主面板（含圆角，是特效挂载点）
    │   ├── [class*="_nav"]      ← 左侧导航列
    │   │   └── [class*="navCell"]    ← 每个导航项
    │   │       ├── svg[class*="navIcon"]  ← 官方图标（class 在 svg 自身）
    │   │       └── [class*="navLabel"]    ← 导航文字
    │   └── [class*="_content"]  ← 右侧内容区（渲染各 section 的组件）
```

### 3.2 关键机制：navIcon 对未知 id 回退齿轮

官方 `navIcon(id)` 只认识 `models` / `agent-presets` / `plugins` 等内置 id，
**未知 id 一律回退成齿轮图标**。SIDOR 的"余额"id 未知，所以官方渲染齿轮。

### 3.3 钱包图标替换（DOM 注入 + 即时化）

替换三原则：

1. **插到 svg 前面，隐藏 svg，绝不 append 进 svg 内部**
   ```js
   const wrapper = document.createElement('span')
   wrapper.className = 'sid-nav-wallet'      // 我们的图标容器
   wrapper.innerHTML = ICON_WALLET            // 钱包 svg
   cell.insertBefore(wrapper, svg)           // 必须插在官方 svg 之前
   svg.style.display = 'none'                // 隐藏官方齿轮
   ```

2. **官方 navIcon 的 class 就在 svg 上**——选择器写 `svg[class*="navIcon"]`，
   不要再往 svg 内部塞东西（第一次做错：append 进 svg，无效）。

3. **即时替换：全局 MutationObserver，从插件启动就挂载**
   ```js
   const rootMo = new MutationObserver((muts) => {
     // 快速过滤：只有 settingsArea 内的变更才处理
     let hit = false
     for (const m of muts) {
       const t = m.target
       if (t && t.nodeType === 1 && typeof t.closest === 'function' &&
           t.closest('[class*="settingsArea"]')) { hit = true; break }
     }
     if (hit) fixNavIcon()
   })
   rootMo.observe(document.body, { childList: true, subtree: true })
   ```
   **为什么必须全局 observer**：React 渲染 nav 是异步的。若等 500ms 定时器发现面板再挂
   observer，nav 早已绘制成齿轮（闪烁），且 observer 无法回放挂载前的变更。全局 observer
   在官方 nav 插入的同一微任务内替换，浏览器绘制前完成，用户永远看不到齿轮。
   500ms tick 只作为 React 重建 nav 的兜底。

### 3.4 设置面板背景特效（星野 + 旋转流光边框）

- 面板是 `[class*="settingsArea"] [class*="_panel"]`，500ms tick 检测到"新的面板元素"时
  注入两个子元素：
  - `<canvas class="sid-settings-star">`：`position:absolute; inset:0; z-index:0`，
    自研粒子引擎容器模式（`getSize` 回调读面板尺寸 + `rehome:false` 防抖动）。
  - `<div class="sid-settings-glow">`：conic-gradient 旋转流光边框（见 §4.2）。
- **rehome 陷阱**：引擎 `resize()` 默认会把粒子重新撒满全屏。容器模式必须传
  `rehome:false`，且只在面板尺寸真正变化时才 `resize()`，否则每 500ms tick 粒子全抖。

---

## 4. 流光边框（Flowing Border）技术

这是"设置页流光"的通用实现，已复用于 session log 按钮。

### 4.1 原理

一个覆盖层元素，`padding: 1.5px` + `conic-gradient` 渐变背景 + **mask 环形裁切**
（只留边缘 1.5px 的环），再用 `@property` 注册 `--sid-glow-angle` 自定义属性做
`to { --sid-glow-angle: 360deg }` 旋转动画。

```css
@property --sid-glow-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes sid-glow-flow { to { --sid-glow-angle: 360deg; } }

.sid-settings-glow {
  position: absolute !important; inset: 0 !important;
  pointer-events: none !important; z-index: 3 !important;
  border-radius: inherit;                 /* 继承宿主圆角 */
  padding: 1.5px;                         /* 边框粗细 */
  background: conic-gradient(
    from var(--sid-glow-angle, 0deg),
    transparent 0deg,
    transparent 240deg,
    color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent) 285deg,
    color-mix(in srgb, var(--dsw-alias-brand-primary) 52%, transparent) 330deg,
    color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent) 375deg,
    transparent 420deg, transparent 360deg
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
  animation: sid-glow-flow 7s linear infinite;
}
```

### 4.2 用 CSS 变量做"白色 ⇄ 红色"双态

为同一元素做多态颜色，用 `--sid-glow-color` 变量，避免复制整段 gradient：

```css
.sid-sessionlog-glow {
  --sid-glow-color: var(--dsw-alias-label-primary, #eeeeee);   /* 白 */
  background: conic-gradient(... color-mix(in srgb, var(--sid-glow-color) 16%, transparent) ...);
}
.sid-sessionlog-glow.low { --sid-glow-color: var(--dsw-alias-state-error-primary, #e5534b); } /* 红 */
```

JS 侧每 500ms 检查余额：`glow.classList.toggle('low', sidBalanceLow())`。

---

## 5. 侧边栏（Sidebar）

### 5.1 官方底部结构

```
[class*="sidebarCol"]            ← 侧边栏列（左缘=窗口边，右缘=工作区分隔线）
└── [class*="footArea"]          ← 底部区域（column 布局）
    ├── [class*="footerActions"] ← 动作区：余额徽章 + cordis 徽章
    └── [class*="settingsArea"]  ← 官方设置入口（宽度 auto、居中）
```

### 5.2 布局规则（SIDOR 已固化）

- `footerActions` 改成 `flex-direction: column`，余额徽章 order -10 在 cordis 之上；
  `settingsArea` 保持官方原生（**不要**整体重排，否则三行错位）。
- 宽轨动作行：`width:100%!important; justify-content:flex-start!important; gap:8px`。
- 折叠轨（collapsed）：`[class*="collapsed"]` 下动作全部 `width:36px!important` 圆形居中，
  官方 `settingsArea` 自带 36px 圆形触发。
- 余额徽章本体遵循官方 cordis 徽章规范：宽轨 42px 高、圆角 12px、`margin:0 -2px`、
  `padding:0 10px 0 8px`、`gap:8px`；窄轨 36px 圆形。
- 设置触发器 `.VOzbGW_trigger`（官方）gap 8px——**图标与文字贴紧的官方原生值就是 8px**，
  不要去改 label 隐藏之类的 hack。

### 5.3 低余额警告体系（SIDOR 统一红色语言）

余额 ≤ 阈值时同时触发：
1. **侧边栏双缘红色流光**：`.sid-divider-flow` 左右两条（left=窗口边，right=分隔线），
   4px 宽、`::after` 光斑 `transform: translateY(-100%→400%)` 5s linear 单向循环
   （**循环点在视野外，无跳变**；不要用 background-position 百分比动画，会闪断）。
2. **钱包图标红色呼吸辉光**：9.2s ease-in-out drop-shadow 呼吸。
3. **背景星野变红 + 红色粒子辉光**（见 §7）。
4. **session log 按钮流光变红**（§4.2）。

---

## 6. 官方 CSS 变量（--dsw-alias-*）

主题系统通过 `--dsw-alias-*` 变量暴露官方语义色，**所有 SIDOR 样式都引用它们**，
跟随用户主题明暗：

| 变量 | 语义 |
|------|------|
| `--dsw-alias-bg-base` | 页面底色（深色主题近黑） |
| `--dsw-alias-bg-overlay` | 浮层底色 |
| `--dsw-alias-bg-l1` | 卡片/分组底色 |
| `--dsw-alias-label-primary` | 主文字（白/浅色） |
| `--dsw-alias-label-secondary` | 次要文字 |
| `--dsw-alias-label-caption` | 说明文字（更暗） |
| `--dsw-alias-label-dimmed` | 禁用/极暗文字 |
| `--dsw-alias-brand-primary` | 品牌色（青/蓝） |
| `--dsw-alias-state-error-primary` | 错误红（≈#e5534b） |
| `--dsw-alias-border-l1/l2/l3` | 边框层级 |
| `--dsw-alias-interactive-bg-hover` | 悬停底色 |
| `--dsw-alias-input-bg` | 输入框底色 |

未知变量一律给 fallback，保证升级后优雅降级：
`color: var(--dsw-alias-label-primary, #fff)`。

---

## 7. 自研粒子引擎（createParticleEngine）

`createParticleEngine(canvas, opts)` 返回链式 API。核心概念：

### 7.1 状态 API

| 方法 | 作用 |
|------|------|
| `setInkVar('--dsw-alias-label-primary')` | 绑定主题变量为粒子色（跟随主题） |
| `setInk('rgba(...)')` | 固定粒子色（覆盖变量；低余额红色用它） |
| `setSize(k)` / `setSpeedScale(k)` / `setDriftScale(k)` / `setAmbientAlpha(a)` | 尺寸/速度/漂移/环境亮度 |
| `setDisturb(r, f)` | 鼠标扰动（半径/力度）；`disturbOff()` 关闭 |
| `setFlow(x, y, speed)` | **方向流**：全部粒子沿 (x,y) 匀速流动（太阳风暴粒子流的关键） |
| `setGlow({size, alpha})` | 粒子光晕（lighter 混合的径向渐变 sprite）；`setGlow(null)` 关闭 |
| `scatter()` / `showStar()` / `showText()` / `showTextLines()` | 聚集模式：随机/四芒星/文字粒子 |
| `resize()` / `start()` / `stop()` / `dissipate()` | 生命周期 |

### 7.2 关键经验

- **`setInk` 是持久覆盖**，直到再调 `setInkVar` 才恢复变量色（低余额红色切回用 setInkVar）。
- **辉光颜色取自当前 ink**，`setGlow` 会重绘 sprite；换色后需 `setGlow` 重新调用。
- **容器模式**：`opts.getSize` 返回 `{w,h}` 时引擎按容器尺寸渲染（设置面板用）；
  必须配 `rehome:false`，否则 resize 会重新撒粒子。
- **出界重生**：ambient 粒子离开视口后在随机位置重生（`a` 淡入）。方向流模式下把重生
  粒子直接设高 alpha（`state.flow ? Math.max(0.3, ambient*0.75) : 0`），风暴"生成速度"感
  更强。
- 粒子颜色读主题：`readInk()` 每 150 帧刷新一次。

### 7.3 开屏彩蛋（1/50 概率）

`IntroScene` 用 `useState(() => Math.random() < 1/50)` 掷一次彩蛋。触发时：
- 背景星野：5700 粒、size 3.0、ambient 0.9、speed 10.8、drift 2.2、
  `setFlow(0.707, -0.707, 21.6)`（45° 右上高速粒子流）、`setGlow({5.5, 0.4})`、
  扰动极小 `setDisturb(90, 1.0)`——太阳电磁风暴。
- 文字粒子：15000 粒红色（`rgba(229,83,75,0.62)`）、speed 2.4。
- 未触发时与默认完全一致（1400/6800 粒、无 flow、无辉光）。

---

## 8. Host RPC 约定（附属插件可复用）

Host 端用 `harness.handle('sidor/...')` 暴露，Client 用 `host.call('sidor/...')` 调用。
**Package-private RPC 在同一个 DSH 进程内可跨动态插件复用**（只要插件在运行）。

| RPC | 入参 | 返回 | 用途 |
|-----|------|------|------|
| `sidor/balance-get` | `{}` | `{ok, visible, apiKey, balance:{usd,cny}, alerts:{usd,cny}}` | 读持久化余额配置 |
| `sidor/balance-set` | `{visible?, apiKey?, alertUsd?, alertCny?}` | `{ok}` | 写配置（`.sidor-balance.json`） |
| `sidor/balance-query` | `{}` | `{ok, balance:{usd,cny}}` | 用配置的 API Key 调 DeepSeek 官方余额接口（subprocess curl） |
| `sidor/upload-doc` | `{sessionId, name, dataBase64}` | `{ok, path, binary}` | 文档上传到 `.sidor-uploads/`（文本直存，二进制 .b64）。**仅动态形态可用**（静态无 host 通道） |

> 「文档」按钮行为：静态与动态形态都把**路径**贴入输入框，由 agent 工具读取。
> 动态形态额外保留 `sidor/upload-doc` 落盘上传（文件入 `.sidor-uploads/` 后贴相对路径）。
> 静态形态无法落盘，改为路径选择（见 §11.2）。

持久化位置：**第一个 session 的 cwd** 下 `.sidor-balance.json`。

**Host 侧关键 API**（与官方类型对齐）：
- `sessions.list()` / `sessions.get(id)` → `s.header.cwd`
- `fs.resolve / stat / readText / writeText`（writeText 自动建父目录）
- `subprocess.resolveExecutable('curl')` + `spawn({argv, cwd, stdio:{stdin:'ignore',
  stdout:{maxBytes}, stderr:{maxBytes}}, graceMs})`；读输出：
  `handle.collected.stdout.readFrom(0)`（在 `await handle.done` 之后）。
- **不能用 `web.WebFetchRequest` 带 header**（官方只支持 `{url}`），带鉴权头必须走 curl。

---

## 9. 附属插件开发指南（标准做法）

> 首个附属插件已按本指南落地：**Sidor_box**（独立目录，与 Sidor_UI 分开维护，
> 包名 `sidor-box`，设置页「工具箱」分区）。它复用同一条构建管线
> （`scripts/build-client.ps1` + `client-wrapper.template.js`）与安装通道
> （`scripts/install.ps1`），是本节各模式的**可运行参考实现**。

### 9.1 设置页加新分区

```js
slots.inject('settings.section', () => slots.register(
  { name: 'settings.section', id: 'sidor-theme', order: 26, label: '主题' },
  () => React.createElement(MyPage),
))
```
- `id` 唯一（`sidor-balance` 已被占用）；order 控制位置（25 之后 → 26）。
- 左侧导航位置由官方按 order **自动排序**，无需任何手工布局。
- 内容区样式请复用 SIDOR 的 `.sid-balance-page / .sid-balance-row / .sid-balance-input`
  一族（在 `src/sidor-fx-client.js` 的 styles 块里），保持官方观感。

### 9.2 侧边栏加新底部动作

```js
slots.inject('sidebar.footer.action', () => slots.register(
  { name: 'sidebar.footer.action', id: 'sidor-xxx', order: -5, label: 'Xxx' },
  (props) => React.createElement(MyBadge, { wide: props.wide }),
))
```
- `props.wide`：宽轨 true / 窄轨 false，按 §5.2 尺寸规则做两态。
- 多个 action 自动纵向排列（footerActions 已是 column）。

### 9.3 自定义设置导航图标

官方对未知 id 回退齿轮。按 §3.3 的"插到 svg 前 + 隐藏 svg + 全局 MutationObserver 即时
替换"模式做自己的图标。**注意**：`fixNavIcon` 里按 `navLabel` 文字（如"余额"）匹配，
你的分区要匹配你自己的 label。

### 9.4 复用余额数据 / 配置

- 直接 `host.call('sidor/balance-get', {})` 读余额与阈值；`sidor/balance-query` 刷新。
- 若想订阅余额实时变化：把 `sidBalance` store + `sidBalanceSubscribe` 从
  `src/sidor-fx-client.js` 拷贝到你的插件（动态插件间无共享内存；数据由 RPC/配置文件中转）。

### 9.5 生命周期与兼容性红线

- 动态插件**进程重启即失效**，须在 DSH 内重新 run。
- **不要直接修改官方包源码**；只允许 DOM 注入 + CSS 覆盖。
- 选择器一律用 **class 片段模糊匹配**（`[class*="..."]`），官方升级改名后优雅降级，
  不会崩溃。
- 所有定时器/observer/事件监听必须随插件停止清理（`ctx.timeout/interval` 或 effect cleanup）。
- Client 代码是 **纯 JavaScript**（无 TS/JSX/import），React 用 `React.createElement`。

---

## 10. 踩坑记录（高频坑）

1. **设置图标替换慢**：等 tick 才发现面板 → 先画齿轮。**必须全局 MutationObserver**（§3.3）。
2. **流光循环闪断**：`background-position` 百分比动画在循环点出现空白/突跳。
   改用 `::after` 光斑 + `transform: translateY`（循环点在视野外）或 conic+mask（§4）。
3. **设置面板星野抖动**：容器模式没传 `rehome:false`，每次 tick resize 重撒粒子（§3.4）。
4. **侧边栏三行错位**：把官方 `settingsArea` 改成 flex-start 会让 余额/cordis/设置 对齐乱。
   正确做法：只改 `footerActions` 为 column，`settingsArea` 保持原生。
5. **图标塞进 svg 无效**：官方 navIcon 的 class 在 svg 自身，必须 `insertBefore(wrapper, svg)`
   再 `svg.style.display='none'`（§3.3）。
6. **`setInk` 颜色不回退**：它是持久覆盖，切回主题色必须 `setInkVar`（§7.2）。
7. **host 发请求带不了 header**：`web.WebFetchRequest` 只有 `{url}`；带 `Authorization` 走
   subprocess curl（§8）。
8. **cordis_define 解析失败**：CSS 模板字符串注释里别用反引号；JS 注释里的反引号会打断
   解析。注释里写代码示例用单引号或去掉反引号。
9. **定时器泄漏**：Client 闭包会遮蔽 `setTimeout/setInterval`，统一用 `ctx.timeout/ctx.interval`
   （插件 `inject: ['timer']`）。

---

## 11. 持久化（静态化）形态说明

### 11.1 为什么动态插件不能自动持久化

动态插件（`sidf-4`）的 define/run 生命周期**深度绑定会话（agent）与客户端协调**：
`dynamicCordisRunner` 是 TypertRemoteService，其 define/run 的 agent 来自远程调用上下文；
client 半需要 Cordis 面板的 approval 协调 + `dsh-cordis-client-runner` 的
`DynamicCordisPackageRunner` 加载。宿主静态插件没有这些上下文，**无法在启动时自动
define+run 动态插件**（这是当前 DSH 版本的架构限制，不是配置问题）。

### 11.2 静态化的正统路径（Sidor_UI 已实现）

Sidor_UI 升级为标准 Cordis 插件包（`package.json` 的 `dsh.client` 声明 + `exports["./client"]`），
由 `@deepseek-ai/dsh-client-modules` 扫描 loader 树并加载到 web 客户端。要点：

- **Client 半 = ModuleLoader bundle**：`window.__ModuleLoader__.load({id, factory})`。
  由 `scripts/build-client.ps1` 把 `src/sidor-fx-client.js` 内联进
  `scripts/client-wrapper.template.js` 生成 `lib/client.js`。
- **闭包注入与动态 runner 一致**：wrapper 提供 `React`（`require("react")`，web bundle
  staticModules 种子含 react/slots）、`styles`（自实现 style 标签记账）、`host`（静态降级）、
  `harness`（host 专属 trap）。
- **inject 提升（必须）**：Cordis 只读取**顶层插件对象**的 `inject` 来装配 ctx。
  构建脚本从源码提取 `inject: [...]` 填入 `exports.inject`；**不可省略、更不可移除
  `'timer'`** —— 否则内层 `ctx.timeout/ctx.interval` 抛
  `cannot get property "timer" without inject`。详见 [PACKAGING.md §2](./PACKAGING.md)。
- **timer 兜底**：静态环境若无官方 timer 服务，wrapper 在 apply 时用浏览器
  `setTimeout/setInterval` 为 `ctx.timeout/ctx.interval` 提供 polyfill。注意 Cordis 的 ctx
  是 Proxy，探测未注入服务会**抛错而非返回 undefined**，故探测与赋值均需 `try/catch`
  （[PACKAGING.md §3](./PACKAGING.md)）。
- **host 降级**：静态插件没有 harness/host RPC 通道（api-proxy 是封闭网关，无公开的
  自定义端点注册 API）。因此静态形态下：
  - 余额配置 → 浏览器 **localStorage**（键 `sidor.balance.config`）；
  - 余额查询 → 浏览器 **fetch 直连** `api.deepseek.com/user/balance`
    （若浏览器 CORS 拒绝，UI 显示错误）；
  - 文档附件 → **无法落盘**。「文档」按钮降级为**路径选择**：路径输入框 +
    原生文件夹选择器 + 工作区路径提示，把路径贴入输入框，由 agent 工具直接读取。
    路径选择走**同源 `/api` RPC 直连官方端点**（`host.pickDirectory` /
    `workspace.list` / `session.list`），信封格式与官方 WebApiClient 一致
    （`POST /api/<method>`，body `{type:'client-request', rpcId, method, payload}`）。
    注意动态闭包会把裸 `fetch` 遮蔽成教学错误，客户端统一用 `window.fetch`。
    静态 wrapper 在 `host` 上盖 `runtime:'static'` 戳，客户端据此区分静态/动态
    形态（`SIDOR_STATIC`），动态形态下才显示 `sidor/upload-doc` 落盘上传。
- **Host 半 = `lib/index.js`**：标准 ESM 空壳（依赖 sessions/fs/subprocess 为宿主服务，
  待官方提供静态 RPC 通道后迁入 `src/sidor-fx-host.js` 逻辑）。

### 11.3 安装

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1            # 安装
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Remove    # 卸载
```
或官方命令（需 pnpm）：`dsh plugin --profile web install <Sidor_UI 路径>`。
安装 = 复制包到 `%USERPROFILE%\.dsh\profiles\web\node_modules\sidor-ui` + 在 profile 的
`cordis.patch.yml` 写入 `- insert: {id: sidor-ui, name: sidor-ui}`。

### 11.4 源码更新流程

改 `src/sidor-fx-client.js` → 跑 `scripts/build-client.ps1` → 重跑 `install.ps1`
（或重复制 lib/）→ 重启 DSH → 浏览器 `Ctrl+Shift+R`。

> **打包前请过一遍 [PACKAGING.md](./PACKAGING.md) 的检查清单。**
> 打包层的报错（`loaded without registering` / `cannot get property ... without inject`）
> 一律不指向真正的原因，该文档记录了症状 → 根因的对照表。

---

## 12. 插件管理（设置 → 插件列表：关闭 / 启用 / 卸载）

### 12.1 能力边界（架构事实）

官方"设置 → 插件"列表（`dsh-client-ui-settings-plugin-inventory`）是**只读**的：
`pluginInventory.list()` 只有读接口，客户端 `ctx.remote` 无任何插件管理接口，官方
cordis 面板只管理动态插件。静态皮肤**没有写宿主文件的通道**（官方 `/api` 白名单
无文件写入端点）。因此"改 `cordis.patch.yml` / 删包"必须由宿主侧执行——本功能
采用**委托当前会话 agent 执行**：确认后经官方 `session.prompt` RPC 发送一条精确
指令，agent 用其工具完成文件操作（越界写文件时 DSH 会弹授权）。操作需**重启 DSH**
生效。

### 12.2 补丁语法（agent 指令的依据）

profile 补丁文件 `cordis.patch.yml` 是顶层 YAML 数组，每条补丁按顺序应用：

- **插入插件**（install.ps1 写入）：`- insert: [- id: X, name: X]`
- **关闭**：追加 `- id: X` + `disabled: true`（entry 不再运行）
- **启用**：追加 `- id: X` + `disabled: false`（后者覆盖前者）
- **卸载**：删除该插件的 `insert` 补丁块 + 删除 `node_modules/<包名>` 目录

> **id 必须是行内裸 id，不能带 Loader 前缀**：官方插件列表的 `data-plugin-entry`
> 是 Loader 完整条目 id（`Entry.id` getter 会拼接父树前缀，如 `include:sidor-ui`），
> 但 `applyEntryPatches` 的 id 索引只认配置行内的裸 `options.id`（`sidor-ui`）。
> 带前缀的补丁会以 `patch: entry X not found` 被**静默跳过**，关闭/启用不生效。
> 皮肤已内置此转换（取 `:` 后末段）。

### 12.3 实现要点（`src/sidor-fx-client.js`）

- 组件 `PluginManageFx` 注册进 `shell.overlay`（order 200），常驻但不渲染内容；
- 每 600ms + MutationObserver 扫描官方插件卡片 `li[data-plugin-entry]`，注入
  `.sid-plugin-actions`（关闭/启用/卸载按钮）；`data-plugin-entry`/`cardTitle[title]`/
  `[data-enabled]` 分别给出 entry id、模块名、启用态；其中 entry id 是 Loader
  完整 id，需取 `:` 末段得到补丁用的裸 id（见 12.2）；
- 点击按钮弹出 `.sid-plugin-dialog`（官方菜单风）二次确认，确认键 `.sid-plugin-danger`
  带**红色流光**（conic-gradient 旋转描边，复用 `sid-glow-flow`/`--sid-glow-angle`，
  色值 `--dsw-alias-state-error-primary`）；
- 确认后构造 `pluginManageInstruction()` 文本，经 `sidorHostRpc('session.prompt',
  {sessionId, mode:'queue', content:[{type:'text', text}]})` 发送（sessionId 由
  FilePickButton 渲染时捕获到模块级 `sidorActiveSessionId`）。

### 12.4 红线提醒

- 该功能会**发送一次模型请求**（agent 执行），属于对"纯展示层"约定的有意扩展
  （用户显式要求）；文档与 README 均已标注。
- 非 Sidor 系列插件（含 DSH 官方内置）同样会出现按钮，确认面板会追加红色警示，
  请用户谨慎操作。
