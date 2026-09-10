# DSH 0.1.5 兼容修复与人设卡迁移计划

> 适用对象：Sidor_UI 皮肤（`Sidor_UI` 仓库）与本地 agent preset（`%USERPROFILE%\.dsh\.agent-presets\`）。
> 基线：DSH `0.1.5-rc.1-183f08e`（`dsh web` 从源码启动）。

---

## 1. 背景：0.1.5 带来的破坏性变更

| # | 变更 | 影响面 |
|---|---|---|
| 1 | `dsh web` 新增浏览器认证：终端打印带 `?token=` 的 URL，交换持久签名 cookie 后才可访问 | 用旧 URL/旧标签页会得到 401；页面需重开一次 |
| 2 | Web RPC 网关信封变更：`POST /api/<a>/<b>`、`method` 必须等于 endpoint（斜杠式）、`payload` 必须为 `{ args: {...} }` | 所有自建 RPC 调用（含本皮肤）在旧写法下全部失败 |
| 3 | `workspace/list` 远端方法**移除**（改为流式 `workspace/follow`）；会话摘要 `session/list` 自带 `cwd` | 依赖工作区清单解析路径的代码失效 |
| 4 | 目录选择改为 `directoryPicker` 命名空间：`pick` / `list` / `createDirectory`，`pick` 返回 `string \| null` | 旧的 `host.pickDirectory` 失效 |
| 5 | `session/prompt` 请求体新增必填 `requestId`，参数经 `args.request` 传递 | 旧的裸 payload 调用失效 |
| 6 | `@deepseek-ai/dsh-persona` 配置字段 `text` → **`prefix`（必填）**，新增 `suffix` / `complete` / `includeRuntimeContext` | 旧格式的 agent preset **挂载失败**，新会话创建失败 |
| 7 | 官方 `standard` preset 新增两行：`@deepseek-ai/dsh-command-goal`、`@deepseek-ai/dsh-tool-present` | 旧 preset 缺少 goal 命令与 present 工具 |

---

## 2. 已完成（本次）

### 2.1 人设卡挂载失败 → 已修复

**症状**：点击侧边栏「新会话」无任何反应（界面不跳转、无报错提示）。

**根因链**：`session/create` 返回 `ok:false, code=agent-preset/invalid`，前端对创建失败静默处理。

```
agent-presets: preset "yuki-tsundere-sister" failed to mount:
  failed to apply loader entry persona (@deepseek-ai/dsh-persona):
  invalid config: $.prefix ...
```

**修复**：`%USERPROFILE%\.dsh\.agent-presets\yuki-tsundere-sister\agent.cordis.yml`

```diff
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: |-
+    prefix: |-
       You are a coding agent powered by the {{model}} model. ...
```

备份：同目录 `agent.cordis.yml.bak`（确认无误后可删）。

**验证**（直接调 RPC）：

```
POST /api/session/create  {args:{request:{agentPreset:"yuki-tsundere-sister"}}}
→ ok:true   session-7c20ad89-…
POST /api/session/create  {args:{request:{agentPreset:"standard"}}}
→ ok:true   session-31802d11-…
```

preset 在每次创建会话时重新挂载，**改完无需重启服务**，刷新页面即可。

### 2.2 皮肤 RPC 适配 0.1.5 网关 → 已完成

改动文件：`src/sidor-fx-client.js`、`scripts/client-wrapper.template.js`（注释）、`lib/client.js`（重建）。

**A. `sidorHostRpc` 重写为新信封**

```js
// 旧（0.1.4-）
POST /api/session.prompt        body { type, rpcId, method:'session.prompt', payload:{…} }
// 新（0.1.5+）
POST /api/session/prompt        body { type, rpcId, method:'session/prompt', payload:{ args:{…} } }
```

**B. 端点迁移表（皮肤用到的）**

| 用途 | 旧 | 新 | args 字段名 |
|---|---|---|---|
| 解析会话工作区路径 | `workspace.list` | `session/list`（取 `items[].cwd`） | `{ _request: {} }` |
| 委托 agent 执行插件操作 | `session.prompt` | `session/prompt` | `{ request: { requestId, sessionId, mode, content } }` |
| 选择文件夹 | `host.pickDirectory` | `directoryPicker/pick` | `{}`，返回 `string \| null` |

> **关键细节**：`args` 的字段名是官方远端方法的**形参名**，网关按 descriptor 严格校验。
> 例如 `session/list(_request, signal)` 必须传 `{ _request: {} }`；`session/prompt(request, signal)` 必须传 `{ request: {…} }`。
> 字段名不符会返回 `gateway/arguments-invalid: args fields do not match the descriptor`。

**C. 验证结果**（headless Edge + CDP，对真实服务）

| 检查项 | 结果 |
|---|---|
| 皮肤加载（`.sid-fx` / `.sid-plugin-manage`） | ✅ 32 个 `sid-` 节点，无异常、无 404 |
| 开屏遮罩 `.sid-intro` 已退场 | ✅ 不遮挡点击 |
| `session/list` 新信封 | ✅ `ok=true` |
| `directoryPicker/list` 新信封 | ✅ 信封被接受（返回业务错误 `needs the browse capability`，因宿主为 native 选择器） |
| 文档按钮 → 面板 | ✅ 四个动作齐全 |
| 文档按钮 →「填入工作区路径」 | ✅ 填入 `E:\DeepSeek Harness`（走修复后的 `session/list`） |

---

## 3. 人设卡（agent preset）格式规范

> 本节是 `%USERPROFILE%\.dsh\.agent-presets\` 下用户预设的**格式基线**（以 DSH 0.1.5 为准）。
> 依据实现：`packages/preset/persona/src/index.ts`（Config 与默认值）、
> `packages/preset/agent-presets/presets/standard/agent.cordis.yml`（官方模板）。

### 3.1 目录结构

```
%USERPROFILE%\.dsh\.agent-presets\<preset-id>\
  preset.yml          # 元数据：name（界面显示名）、description
  agent.cordis.yml    # agent 平面组合：插件行数组（含 persona）
```

`preset.yml` 字段未变：

```yaml
name: SIDOR 人设 · Yuki 傲娇妹妹
description: 青梅竹马的傲娇毒舌妹妹：嘴上从不饶人，心里却全是你
```

### 3.2 persona 行（0.1.5 变更点）

**字段表**（来源：`packages/preset/persona/src/index.ts`）：

| 字段 | 必填 | 默认 | 语义 |
|---|---|---|---|
| `prefix` | ✅ **必填** | — | 人设正文，渲染为 `deployment:persona-prefix` 段；`{{…}}` 严格插值；空文本在渲染时丢弃该段。**0.1.4 及更早该字段名为 `text`** |
| `suffix` | — | `''` | 渲染在第一方指引之后；**省略或留空即遮蔽部署级后缀** |
| `complete` | — | `false` | `true`：`prefix` 直接作为完整系统提示词，抑制 suffix 与其余所有段 |
| `includeRuntimeContext` | — | `true` | `false`：该人设作用域不注入动态 runtime-context |

**完整示例**（0.1.5；未列出的可选字段取默认值即可）：

```yaml
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: |-                      # 必填：人设正文（模板变量 {{model}} {{cwd}} 可用）
      You are a coding agent powered by the {{model}} model.

      【人设卡】
      你是「Yuki」……
    suffix: Your working directory is {{cwd}}.
    complete: false
    includeRuntimeContext: true
```

**旧 → 新迁移对照**：

```diff
 - id: persona
   name: '@deepseek-ai/dsh-persona'
   config:
-    text: |-
-      You are a coding agent powered by the {{model}} model.
+    prefix: |-
+      You are a coding agent powered by the {{model}} model.
```

**硬性要点**：

1. `prefix` 必填：缺失报 `invalid config: $.prefix`，**整行挂载失败 → 该预设创建会话失败**；
2. `{{…}}` 按注册表严格插值，未知变量报错——不要写自定义占位符；
3. YAML 缩进：`prefix:` 同级 4 空格，正文每行 ≥6 空格且相对缩进保持一致；
4. 官方 `standard` 的写法是身份句放 `prefix`、工作目录句放 `suffix`——追加人设时**只改 `prefix`，保留 `suffix`**。

### 3.3 人设卡能否正常使用？

**能**。字段名修正后已实测 `session/create` 返回 `ok:true`，人设卡正常挂载；
本次故障是「格式不兼容 → 挂载失败 → 前端静默」，不是人设内容或插件能力问题。

### 3.4 与官方模板的其余差异（已补齐）

对比 `<DSH 安装目录>\packages\preset\agent-presets\presets\standard\agent.cordis.yml`：

原 `yuki-tsundere-sister` 缺少 2 行（id / name 已与官方模板逐字核对）：

```yaml
# ── goals ──（位置：tool-skill 之后、tool-goal 之前；属于该分组语义，勿移出或另起分组）
- id: command-goal
  name: '@deepseek-ai/dsh-command-goal'
```

```yaml
# 位置：文件末尾、tool-web 之后（注意行的 id 是 present，包名才是 dsh-tool-present）
- id: present
  name: '@deepseek-ai/dsh-tool-present'
```

- 这两行都没有 `config`；preset 里没有多余的旧行（无需删除）。
- `command-goal` 提供 `/goal` 命令、`present` 提供 `present` 工具，缺失不影响挂载，只少能力。
- **状态**：两行已写入 `%USERPROFILE%\.dsh\.agent-presets\yuki-tsundere-sister\agent.cordis.yml`
  （同时把 goals 分组的过时注释更新为官方 0.1.5 版本）；
  校验通过——YAML 解析无错，顶层行数 **18 = 官方模板 18**，persona 行为 `prefix`，`present` 位于末行。

---

### 3.5 常见错误对照

| 报错 | 根因 | 处理 |
|---|---|---|
| `invalid config: $.prefix` | persona 行仍用旧字段 `text`，或缺 `prefix` | 按 §3.2 迁移对照改名/补上 `prefix` |
| `preset "…" failed to mount` | 上一类 config 错误、未知模板变量、YAML 缩进错 | 按报错字段逐项修正后重试 |
| `gateway/arguments-invalid: args fields do not match the descriptor` | RPC `args` 字段名与远端形参不符 | 见 §2.2 B 的 args 字段名表 |
| 点「新会话」无反应 | 预设挂载失败被前端静默 | 直接调 `session/create` 看 `ok:false` 的 code/message（§2.1 验证片段） |

### 3.6 与 Sidor_Character 人设卡（`.persona.md`）的映射

DSH 侧没有「人设卡」概念——人设卡是 Sidor_Character 插件在浏览器侧维护的 `.persona.md`
（front matter 元信息 + 正文即人设指令）。两条生效通道最终都落到本节格式：

| 通道 | 落点 | 是否写 preset 文件 |
|---|---|---|
| A 应用到当前会话 | 官方 `/api session/prompt`（0.1.4- 为 `session.prompt`）发送一次性指令 | 否（消息级，仅当前会话） |
| B 安装为 Agent 预设 | 用户预设 `…\<id>\agent.cordis.yml` 的 `persona.prefix` 追加人设正文 | 是（必须是 0.1.5 的 `prefix` 字段） |

→ 因此**安装预设的自动化文本必须产出 `prefix`**。插件侧提示词已按本节修正：
`Sidor_Character/src/sidor-character-client.js` 的 `sidCharaPresetInstruction`
（静态形态经 agent 代执行生效；同时更新了官方预设的新旧两条查找路径）。

## 4. 待完善清单（建议由你执行）

- [x] **P1 补齐 preset**：`dsh-command-goal`、`dsh-tool-present` 两行已同步进 `yuki-tsundere-sister/agent.cordis.yml`，与官方模板核对（顶层行数 18=18，见 §3.4）。
- [x] **P1 插件格式提示词适配**：`Sidor_Character` 的安装预设提示词已由旧 `text` 改为 `prefix`，并更新官方预设新旧查找路径（见 §3.6）。
- [ ] **P1 建立同步习惯**：DSH 升级后，用官方 `presets/standard/agent.cordis.yml` 做基线 diff（行 id/name/config 键），只保留 persona 正文差异。
- [ ] **P2 皮肤版本适配层**：把 RPC 信封做成可降级的能力探测（先试新信封；若返回 `gateway/bad-request`/`does not match endpoint` 再退回旧点号写法），使皮肤同时兼容 0.1.4 与 0.1.5。
- [ ] **P2 端点名收敛**：把散落的 endpoint 字符串集中为常量表（如 `SIDOR_RPC = { sessionList: 'session/list', … }`），DSH 再次改名时只改一处。
- [ ] **P3 失败可见化**：皮肤侧对 RPC 失败一律弹 toast（当前插件管理已如此），避免"点击无反应"这类静默失败再次出现。
- [ ] **P3 文档**：`docs/DEVELOPER.md` 增补"DSH 版本兼容矩阵"小节，记录已验证的 DSH 版本与端点。

---

## 5. 复现与验证方法

**启动带认证的调试浏览器**（headless Edge + CDP，需先由服务签名 cookie）：

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
Start-Process $edge -ArgumentList "--headless=new","--remote-debugging-port=9334",
  "--user-data-dir=$env:TEMP\sidor-cdp","--window-size=1600,1000","about:blank"
```

cookie 名/值构造（与 `packages/client/connection/src/browser-auth.ts` 一致）：

```
authority   = "127.0.0.1:3080"
cookie 名    = "dsh-auth-" + base64url(sha256(authority))
cookie 值    = "v1." + base64url(JSON{version:1,authority,issuedAt,expiresAt})
                    + "." + base64url(hmacSha256(secret, body))
secret       = %USERPROFILE%\.dsh\.credentials.yaml → client-connection/browser-session.payload.secret
```

**直接验证一次 RPC**（在页面上下文执行）：

```js
fetch('/api/session/list', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    type: 'client-request', rpcId: crypto.randomUUID(),
    method: 'session/list', payload: { args: { _request: {} } },
  }),
}).then(r => r.json())
```

**皮肤侧重建链路**：

```powershell
cd <Sidor_UI>
powershell -ExecutionPolicy Bypass -File .\scripts\build-client.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
# 服务按请求读盘，浏览器 Ctrl+Shift+R 即可
```
