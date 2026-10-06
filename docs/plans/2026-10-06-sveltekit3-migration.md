# SvelteKit 3 迁移（等价合并 PR #15/#17/#18）实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在分支 `dependency-5-6` 上一次性完成 cookie 2.0.1（安全修复）+ @sveltejs/kit 3.0.1 + @sveltejs/adapter-static 4.0.0 升级迁移，使全部 CI 门禁通过。

**Architecture:** dependabot 把这次迁移拆成了三个单独都过不了 CI 的 PR（#17/#18 在 npm ci 阶段 ERESOLVE 互斥，#15 组合后卡在运行时 `config_file_unsupported`）。本计划在单一分支合并三者的升级内容，并补上它们都没做的代码层迁移：`svelte.config.js` → `sveltekit()` 插件参数、`tsconfig.json` extends 路径、release.yml node 20 → 22。

**Tech Stack:** SvelteKit 3.0.1 / adapter-static 4.0.0 / Vite 8 / Svelte 5.57+ / TypeScript 6 / Tauri 2 / npm（pnpm 不可用）

---

## 可行性结论：可行，改动面小

代码库与 kit 3 破坏性变更逐条比对结果（依据：sveltejs/kit v3.0.0 release notes + 代码检索）：

| kit 3 破坏性变更                                                                                     | 本仓库影响                                | 证据                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 移除 `svelte.config.js`，配置走 `sveltekit()` 插件 (#16007)                                          | **需迁移**（唯一硬性代码变更）            | `svelte.config.js:1` 存在；`vite.config.js:9` 已调用 `sveltekit()`                                                                               |
| tsconfig 改为 `extends: "$app/tsconfig"` (#16458)                                                    | **需迁移**                                | `tsconfig.json:1` 现为 `./.svelte-kit/tsconfig.json`                                                                                             |
| Node ≥ 22.17 (#12548, #16597)                                                                        | **release.yml 需改** node 20 → 22         | `release.yml:39` node-version: 20；quality/platform/format-pr 均已是 22                                                                          |
| Vite ≥ 8.0.12 (#16134)                                                                               | 已满足                                    | `package.json:53` vite ^8.3.1                                                                                                                    |
| vite-plugin-svelte v7 (#15371)                                                                       | 已满足                                    | `package.json:34` ^7.3.1                                                                                                                         |
| TypeScript ≥ 6 (#15930)                                                                              | 已满足                                    | `package.json:52` ~6.0.3                                                                                                                         |
| Svelte ≥ 5.57.1（kit 3 peer）                                                                        | 需小版本上浮                              | `package.json:48` ^5.56.3                                                                                                                        |
| cookie v2 (#13386)                                                                                   | 经 kit 3 传递引入，即 PR #15 的目标       | PR #15 diff：kit 3 deps `cookie: ^2.0.1`                                                                                                         |
| `$app/stores` 移除、`$lib`→`#lib`、`goto` 拒绝外部 URL、cookie path 默认值、表单/CSP/Server 相关变更 | **不受影响**                              | `src/` 无任何 `$app/*`、`$lib/*` 导入（Grep 0 命中）；无 server 端文件；`goto` 命中均为项目本地方法 `timer.goto`（`src/lib/timer.svelte.ts:81`） |
| `data-sveltekit-*` 'off'→'false' (#15907)                                                            | 不受影响                                  | 仅 `src/app.html:10` 用 `preload-data="hover"`，合法                                                                                             |
| adapter-static 4.0.0                                                                                 | 仅 peer 要求 kit 3，API（`fallback`）不变 | adapter-static@4.0.0 release notes                                                                                                               |

**主要风险（执行中验证）：** vitest 5 在 kit 3 下的启动（正是 #15 CI 的失败点，`npm run test` 是第一道门禁）；svelte-check 与新生成类型的兼容性（`npm run check`）。两者都在 Task 4 的门禁序列里自然覆盖。

---

### Task 1: 创建并切换分支

**Step 1:** 从当前 `dependency`（= origin/main ab15cfa）创建分支

```bash
git checkout -b dependency-5-6
```

说明：`dependency-5-6` 本地/远程均不存在（已用 `git branch -a` + `git ls-remote` 确认），需新建。

### Task 2: 升级依赖

**Files:**

- Modify: `package.json:32-34,48`（devDependencies）

**Step 1:** 修改三个版本号

```json
"@sveltejs/adapter-static": "^4.0.0",
"@sveltejs/kit": "^3.0.1",
"svelte": "^5.57.1",
```

**Step 2:** 安装并核对解析结果

```bash
npm install
npm ls @sveltejs/kit @sveltejs/adapter-static cookie svelte
```

Expected: kit 3.0.1 / adapter-static 4.0.0 / cookie 2.x / svelte ≥5.57.1；无 ERESOLVE。

### Task 3: 配置迁移（核心）

> **实施记录（已按此执行，含两处计划外补充，勿"清理"）：**
>
> 1. tsconfig.json 必须显式声明 `"include": ["src", "test", "*"]`——kit 3 生成的 `$app/tsconfig` 本身**不含 include/exclude**，缺失该行时 TypeScript 退化为全仓扫描（checkJs 会把 `build/`、`src-tauri/target/` 产物卷入检查，数千 errors）。此写法出自 kit 3 自带 sync 源码的官方示例（`node_modules/@sveltejs/kit/src/core/sync/write_tsconfig/index.js`）。本项目无 service-worker，故省略 `exclude: ["src/service-worker"]`。
> 2. 原 svelte.config.js 头部的 Tauri SPA 说明注释未随迁——同样内容已存在于 `src/routes/+layout.ts:1-4`，无需重复。

**Files:**

- Modify: `vite.config.js:1-9`
- Delete: `svelte.config.js`
- Modify: `tsconfig.json:1`

**Step 1:** `vite.config.js` 插件部分改为：

```js
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
// ... 其余 import 不变

plugins: [
  sveltekit({
    preprocess: vitePreprocess(),
    adapter: adapter({ fallback: "index.html" }),
  }),
  tailwindcss(),
],
```

（语法依据：svelte.dev/e/kit/config_file_unsupported + kit 3.0.1 类型定义 `Config extends VitePluginSvelteOptions`，原 `config.kit.*` 顶层平铺，`preprocess` 直接作为插件选项。其余 vite 配置不动。）

**Step 2:** 删除 `svelte.config.js`（内容已全部迁入）。

**Step 3:** `tsconfig.json` 首行改为：

```json
{
  "extends": "$app/tsconfig",
  "compilerOptions": { ...现有内容不变... }
}
```

### Task 4: CI 修复与全量门禁验证

**Files:**

- Modify: `.github/workflows/release.yml:39`

**Step 1:** `node-version: 20` → `node-version: 22`（kit 3 engines ≥ 22.17，node 20 的 release 构建必挂）。

**Step 2:** 本地全量门禁（与 CI `npm run verify` 同序，快失败优先）：

```bash
npm run verify
```

Expected: format:check ✓ → cargo fmt ✓ → vitest ✓（kit 3 下能启动）→ svelte-check ✓ → vite build ✓（不再报 config_file_unsupported）→ clippy ✓ → cargo test ✓。
若本地无 Rust 工具链，则跑前端四道（format/test/check/build），Rust 门禁交给 CI。

**Step 3:** 平台等价构建（platform 工作流同款）：

```bash
npm run build:e2e
npm run tauri -- build --no-bundle
```

Expected: 构建产物位于 `build/`（tauri.conf.json frontendDist 不变）。

**Step 4:** 冒烟：`npm run dev` 手动确认页面渲染正常。

### Task 5: 提交

```bash
git add -A && git status   # 核对：package.json / package-lock.json / vite.config.js / tsconfig.json / svelte.config.js(删) / release.yml
git commit -m "chore(deps)!: migrate to SvelteKit 3 + adapter-static 4 (cookie 2)

Equivalent to merging dependabot PRs #15/#17/#18 plus required code migration:
- svelte.config.js folded into sveltekit() vite plugin options
- tsconfig extends \$app/tsconfig (kit 3 #16458)
- release workflow node 20 -> 22 (kit 3 requires >= 22.17)"
git push -u origin dependency-5-6 && gh pr create --fill
```

（push / 建 PR 属于对外可见操作，执行前需用户确认。）

---

## 明确不做

- 不合并/不处理 PR #17、#18（单独永远无法通过 CI，建议关闭）；#15 在本分支合入后由维护者关闭。
- 不动 PR #16（vite 8.3.2 小版本，全绿，独立可合）。
- 不升级 TypeScript 主版本（main 已配置 ignore TS 7，kit 3 peer 只需 ^6.0.0）。
