# 打包注意点（静态化 / ModuleLoader bundle）

> 面向 `scripts/build-client.ps1` + `scripts/install.ps1` 这条静态化通道。
> 每次改完 `src/sidor-fx-client.js` 重新打包前，先扫一遍本文档末尾的检查清单。
> 架构背景见 [DEVELOPER.md §11](./DEVELOPER.md)。

打包层的错误有个共同特征：**报错信息不指向真正的原因**。DSH 只能告诉你"没注册"或
"缺 inject"，而真凶在构建脚本里。以下是已经踩爆过的坑，附判别方法。

---

## 1. 占位符替换必须产出**合法 JS**，不是"看起来对的文本"

### 症状

```
failed to import loader entry xxxx (sidor-ui): client-modules:
bundle /plugins/sidor-ui/client.js?rev=xxxx loaded without registering
"sidor-ui" via __ModuleLoader__.load
```

### 根因

`build-client.ps1` 是纯文本替换。早期模板写的是：

```js
var __src = __SIDOR_CLIENT_SRC__;                 // ❌
```

而 `src/sidor-fx-client.js` 以 `return { ... }` 开头（它是**函数体**，不是字符串），
替换后变成：

```js
var __src = return {                              // ← SyntaxError
```

整个 bundle 解析失败 → 第 5 行的 `__ModuleLoader__.load` 从未执行。

### 为什么报错这么难懂

**语法错误的 script，浏览器照样触发 `load` 事件**（资源确实下载成功了，解析失败走的是
`window.onerror`）。所以 client-modules 认为"bundle 已加载"，只是没人注册 —— 它没有任何
办法告诉你真正的原因是语法错误。

> 看到 `loaded without registering`，**第一反应永远是 `node --check lib/client.js`**，
> 而不是去查 id 拼写或 loader 配置。

### 现在的做法

模板把源码作为 **async 函数体直接内联**，不再走 `new Function(字符串)`：

```js
var __makePlugin = async function (React, console, styles, host, harness, process, Buffer) {
	/* === BEGIN src/sidor-fx-client.js === */
__SIDOR_CLIENT_SRC__
	/* === END src/sidor-fx-client.js === */
};
```

形参列表 = 动态 runner 的闭包注入面，语义不变。附带两个好处：绕开 Electron CSP 对 `eval`
的拦截；devtools 里能看到真实源码行号（`new Function` 的栈是 `<anonymous>`）。

**约束**：源码必须是纯函数体 —— 不能出现顶层 `import` / `export`。

### 防护

`build-client.ps1` 已内置 `node --check` 门禁，语法不过就**删除产物并 throw**。
不要因为嫌慢删掉它 —— 这个 bug 就是从"构建阶段零校验"的缝里溜进运行时的。

---

## 2. Cordis 只读取**顶层插件对象**的 `inject`

### 症状

```
failed to apply loader entry xxxx (sidor-ui): cannot get property "timer" without inject
```

### 根因

分两层：内层 `src/sidor-fx-client.js` 返回 `{ inject: ['timer'], apply }`，外层 wrapper 交给
Cordis 的却是 `module.exports = { apply }`。

**Cordis 只看它拿到的那个对象上的 `inject` 来装配 ctx**，内层写了什么它无从得知。于是
timer 没被注入，内层任何一处 `ctx.timeout()` / `ctx.interval()`（源码里有 8 处）一碰即抛。

### 现在的做法

构建时从源码提取 `inject`，提升到 bundle 的顶层导出：

```js
exports.inject = __SIDOR_CLIENT_INJECT__;   // 构建期填入，如 ['timer']
```

提取用正则锚定行首缩进 + 冒号，**不会误命中** `slots.inject('shell.overlay', ...)` 这类调用：

```powershell
[regex]::Match($src, '(?m)^\s*inject\s*:\s*(\[[^\]]*\])')
```

**提取失败直接 throw，绝不静默填 `[]`** —— 静默降级等于把这个 bug 重新种回去。
如果插件确实无依赖，在源码里显式写 `inject: [],`。

### 红线

> 内层新增依赖（`inject: ['timer', 'foo']`）后**必须重新打包**。
> 只复制 `src/` 不跑 build，`exports.inject` 还停在旧值，运行时才炸。

---

## 3. Cordis 的 `ctx` 是 Proxy —— 探测不存在的服务会**抛错**，不是返回 `undefined`

这是上面那条的连带坑，单独列出来因为它足够反直觉。

早期 wrapper 里那段"timer 兜底 polyfill"：

```js
if (typeof innerCtx.timeout !== "function") { ... }   // ❌ 这一行自己就会抛
```

未注入的服务在**属性访问那一刻**就抛 `cannot get property "timer" without inject`。
所以这段本该兜底的代码，反而抢在插件之前先引爆 —— 它不但没兜住，还制造了故障。

正确写法（探测和赋值都要包）：

```js
var fallback = function (name, impl) {
	var present = false;
	try { present = typeof innerCtx[name] === "function"; } catch (e) { present = false; }
	if (present) return;
	try { innerCtx[name] = impl; } catch (e) { /* Proxy 拒写：留给 Cordis 报原始错误 */ }
};
```

**注意区分两种访问方式**，行为不一样：

| 写法 | 未注入时 |
|---|---|
| `ctx.timeout` / `ctx.foo`（属性访问） | **抛错** |
| `ctx.get('slots')`（方法调用） | 返回 `undefined` |

源码 `apply()` 开头用的是 `ctx.get('slots')` / `ctx.get('conversation')` —— 那是**可选依赖
探测**，故意不放进 `inject`（放进去会让 Cordis 等待服务、改变加载时机）。改 `inject` 时
别顺手把它们加进去。

---

## 4. `.ps1` 必须带 UTF-8 BOM

### 症状

```
所在位置 ...\build-client.ps1:4 字符: 1
表达式或语句中包含意外的标记")"。
```

行号还指向一个完全正常的 `)`。

### 根因

脚本含中文注释。**Windows PowerShell 5.1 对无 BOM 文件按系统 ANSI（GBK）解码**，
中文字节被误读后直接破坏语法解析。PowerShell 7（`pwsh`）默认 UTF-8，所以同一个文件
`pwsh` 能跑、`powershell` 炸 —— 极容易误判成"脚本本身有 bug"。

### 防护

`scripts/*.ps1` 一律保存为 **UTF-8 with BOM**。检查：

```bash
head -c 3 scripts/build-client.ps1 | od -An -tx1    # 期望 ef bb bf
```

补 BOM：

```bash
node -e 'const fs=require("fs"),f=process.argv[1],b=fs.readFileSync(f);
if(b[0]!==0xEF)fs.writeFileSync(f,Buffer.concat([Buffer.from([0xEF,0xBB,0xBF]),b]))' scripts/build-client.ps1
```

---

## 5. 改完源码要**重装**，装的是 `lib/` 不是 `src/`

`install.ps1` 只复制 `package.json` + `lib/`。DSH 实际加载的是
`%USERPROFILE%\.dsh\profiles\web\node_modules\sidor-ui\lib\client.js`。

只跑 build 不跑 install，DSH 里跑的还是旧 bundle —— 你会对着一个已经修好的 bug 反复重启。

**确认装的是新版**：

```bash
D="$USERPROFILE/.dsh/profiles/web/node_modules/sidor-ui/lib/client.js"
node --check "$D" && wc -c "$D" lib/client.js    # 字节数必须一致
```

浏览器侧还要 **Ctrl+Shift+R** 硬刷新（`client.js?rev=` 的 rev 会变，但缓存该清还是得清）。

---

## 打包前检查清单

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-client.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

构建输出应包含 `inject: [...]` 和 `syntax check: ok`。然后逐项确认：

- [ ] `node --check lib/client.js` 通过（build 已内置，勿删该门禁）
- [ ] `grep -n "__ModuleLoader__.load" lib/client.js` 命中，且 `id` 与 `package.json` 的
      `name` 一致（均为 `sidor-ui`）
- [ ] `grep -n "exports.inject" lib/client.js` 的值 == 源码 `inject:` 声明
- [ ] `grep -n 'runtime: "static"' lib/client.js` 命中（wrapper 在静态 host 上盖的形态戳，
      客户端据此区分静态/动态；改了 `client-wrapper.template.js` 必须重打）
- [ ] 源码无顶层 `import` / `export`
- [ ] 已安装副本与 `lib/client.js` **字节数一致**
- [ ] 重启 DSH + 硬刷新

### 冒烟测试（可选，但改 wrapper 后强烈建议）

在 Node 里 mock `window.__ModuleLoader__` 跑一遍 bundle，能在装机前抓到绝大多数问题：

1. `load()` 确实被调用，且 `id === "sidor-ui"`
2. `factory(require)` 返回含 `apply` 的对象（`require('react')` 喂个假 React 即可）
3. `exports.inject` 与源码一致
4. 用 **严格 Proxy ctx**（访问未 inject 的属性即抛）调 `apply()` 不崩

第 4 项要正反两测：注入 timer / 完全不注入 —— 后者验证 §3 的 `try/catch` 兜底真的生效，
而不是碰巧绕过。

---

## 报错速查

| 报错 | 去看 |
|---|---|
| `loaded without registering "sidor-ui"` | §1 —— 先 `node --check`，八成是语法错误 |
| `cannot get property "X" without inject` | §2 / §3 —— `exports.inject` 漏了 X，或裸属性探测 |
| `.ps1` 报意外标记、行号指向正常字符 | §4 —— BOM 缺失 |
| 改完代码没生效 | §5 —— 忘了 install 或硬刷新 |
