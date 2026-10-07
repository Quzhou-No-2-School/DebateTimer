# windows-11-arm e2e 提升为阻塞行 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `windows-11-arm · build+e2e`（字面 Windows 11，arm64）从非阻塞探测行提升为 platform 矩阵的阻塞行，使每个 PR 必跑真 Win11 e2e。

**Architecture:** 仅改 `.github/workflows/platform.yml` 的矩阵归属：`windows-11-arm` 从 `platform-probe` job 的 matrix 移入主 `platform` job 的 matrix（`e2e: true`）。同步更新 README 平台表与原实施计划文档的未决项。不需要改 e2e 脚本——探测行与阻塞行跑的是完全相同的步骤。

**Tech Stack:** GitHub Actions（platform workflow）· WebdriverIO embedded provider（`@wdio/tauri-service` 1.4，已实测支持 win32-arm64）· npm

---

## 0. 背景与证据（2026-10-06 查证）

**要解决的两个现象（同一根源）：**

1. **PR 的 action 里根本没有 windows-11-arm**：它只存在于 `platform-probe` job 的矩阵，而该 job 的 job 级 `if`（platform.yml:102，`workflow_dispatch || github.ref == 'refs/heads/main'`）排除了 pull_request 事件 → PR 上整个探测 job skipped、矩阵不展开（PR run 37473092731 实测：4 个阻塞 job + `Probe · ${{ matrix.label }}: skipped`）。**当前 PR 的 e2e 覆盖没有任何 Win11**。
2. **main 的 action 里它常显示"已取消"**：platform.yml:27-29 的 concurrency `cancel-in-progress` 在新 push 时取消上一个运行；windows-11-arm 最慢（~14-15 分钟），push 间隔（dependabot ~8 分钟）短于其时长 → 总是它被挤掉（runs 37471796664 / 37472850186 两度复现，其余 6 job 全绿）。

根源：windows-11-arm e2e 只是 main-only 非阻塞探测。移入阻塞矩阵后两个现象同时消失。

**为什么要提升（探测证据充分）：**

- 探测行已连续 4+ 次跑绿：runs [37180146401](https://github.com/Quzhou-No-2-School/DebateTimer/actions/runs/37180146401)、37191190787、37191815146、37316659457，全部 `Probe · windows-11-arm · build+e2e: success`。
- `@wdio/tauri-service` 的 win32-arm64 支持疑虑已消除（e2e 在该 runner 上真实跑通）。
- 满足原计划 docs/plans/2026-09-22-20-测试与CI实施计划.md §2 的"跑绿若干次后再提升"标准。

**代价（如实告知）：**

- 该 job 实测单次 **约 14-15 分钟**（13:25:24→13:40:17、05:31:40→05:46:04 两次实测），是矩阵里最慢的行。加入阻塞组后，PR 的关键路径时长由 ~6 分钟变为 ~15 分钟。
- main 上的取消现象不会消失：platform.yml 的 concurrency（`platform-${{ github.ref }}` + `cancel-in-progress: true`）会在新 push 时取消上一个运行；windows-11-arm 因最慢，**仍会是最常显示"已取消"的 job**。缓解手段是合并 dependabot bump 时攒批（当前 main 上 ~8 分钟一个 bump，间隔短于 15 分钟运行时长）。

**前置事实：**

- main 分支当前**没有**分支保护规则（API 返回 "Branch not protected"），无需同步 required checks。
- 本地 main（b71f766）落后远端，实施前基于 `origin/main` 拉新分支。

---

### Task 1: 修改 platform.yml——矩阵行迁移

**Files:**
- Modify: `.github/workflows/platform.yml:5-13`（头注释）、`:37-42`（阻塞 matrix）、`:107-111`（探测 matrix）

**Step 1: 从 origin/main 创建实施分支**

当前在 `dependency-5-6`，不要在上面混入。

```bash
git fetch origin main
git checkout -b ci/promote-win11-arm-e2e origin/main
```

**Step 2: 更新头注释（platform.yml:5-13）**

把：

```yaml
# 阻塞行（每个 PR 都跑）：
#   ubuntu-24.04  → 编译 + e2e
#   windows-2022  → 编译 + e2e   （Windows 10 世代内核，Server 2022）
#   macos-15      → 编译 + e2e   （arm64）
#   windows-2025  → 仅编译        （Windows 11 世代内核，Server 2025）
#
# 探测行（非阻塞，只在 main 或手动触发时跑）：windows-2025 的 e2e、
# windows-11-arm（字面 Windows 11，arm64）、macos-26。
```

改为：

```yaml
# 阻塞行（每个 PR 都跑）：
#   ubuntu-24.04    → 编译 + e2e
#   windows-2022    → 编译 + e2e   （Windows 10 世代内核，Server 2022）
#   macos-15        → 编译 + e2e   （arm64）
#   windows-2025    → 仅编译        （Windows 11 世代内核，Server 2025）
#   windows-11-arm  → 编译 + e2e   （字面 Windows 11，arm64；2026-10-06 提升为阻塞）
#
# 探测行（非阻塞，只在 main 或手动触发时跑）：windows-2025 的 e2e、macos-26。
```

**Step 3: 阻塞 matrix 加入一行（platform.yml:42 之后）**

```yaml
          - { label: "windows-11-arm · build+e2e", os: windows-11-arm, e2e: true }
```

阻塞 matrix 最终为 5 行（ubuntu-24.04 / windows-2022 / macos-15 / windows-2025 build / windows-11-arm）。

**Step 4: 从探测 matrix 删除 windows-11-arm 行（platform.yml:110）**

删除：

```yaml
          - { label: "windows-11-arm · build+e2e", os: windows-11-arm }
```

探测 matrix 最终剩 2 行（windows-2025 e2e / macos-26）。不需要其他改动：主 `platform` job 没有 `continue-on-error`，进入阻塞组自动获得阻塞语义；步骤（checkout → 依赖 → toolchain → cache → build → e2e）与探测行完全一致，由 `matrix.e2e` 与 `startsWith(matrix.os, 'ubuntu')` 条件正确路由到 "e2e (Windows / macOS)" 步骤。

**Step 5: 校验 YAML 与矩阵展开**

```bash
node -e "const y=require('js-yaml');const fs=require('fs');y.load(fs.readFileSync('.github/workflows/platform.yml','utf8'));console.log('YAML OK')"
```

预期输出 `YAML OK`（js-yaml 是 wdio 依赖树内已有的传递依赖，无需安装；若 require 失败则改用 `npx --yes js-yaml .github/workflows/platform.yml`）。

**Step 6: Commit**

```bash
git add .github/workflows/platform.yml
git commit -m "ci: promote windows-11-arm build+e2e from probe to blocking matrix"
```

---

### Task 2: 同步文档

**Files:**
- Modify: `README.md:91`
- Modify: `docs/plans/2026-09-22-20-测试与CI实施计划.md`（§7 未决表 win32-arm64 行）
- Create: 本计划文件 `docs/plans/2026-10-06-promote-win11-arm-e2e-blocking.md`（随 docs commit 入库）

**Step 1: README.md:91 平台表**

把：

```markdown
| `windows-11-arm` | 真 Windows 11（arm64，实验性，非阻塞探测） | 编译 + e2e |
```

改为：

```markdown
| `windows-11-arm` | 真 Windows 11（arm64）                     | 编译 + e2e |
```

**Step 2: 原实施计划 §7 未决表回填结论**

docs/plans/2026-09-22-20-测试与CI实施计划.md 中：

```markdown
| `@wdio/tauri-service` 是否支持 win32-arm64                                  | 官方平台支持表只区分 Windows/Linux/macOS，未区分架构                                                        | Task 11 探测行                                          |
```

改为（沿用该表已解决项的删除线格式）：

```markdown
| ~~`@wdio/tauri-service` 是否支持 win32-arm64~~                              | **已实测支持（2026-10-06）**：windows-11-arm build+e2e 连续 4 次跑绿（runs 37180146401 / 37191190787 / 37191815146 / 37316659457），并已提升为阻塞行 | 见 docs/plans/2026-10-06-promote-win11-arm-e2e-blocking.md |
```

**Step 3: Commit**

```bash
git add README.md docs/plans/2026-09-22-20-测试与CI实施计划.md docs/plans/2026-10-06-promote-win11-arm-e2e-blocking.md
git commit -m "docs: mark windows-11-arm e2e as blocking after 4 green probe runs"
```

---

### Task 3: 端到端验证

**Step 1: 推分支并开 PR**

```bash
git push -u origin ci/promote-win11-arm-e2e
gh pr create --fill
```

**Step 2: 在 PR 上确认矩阵展开**

PR 的 platform 运行应出现 5 个阻塞 job，其中包含 `windows-11-arm · build+e2e`（不带 Probe 前缀），且探测组只剩 `Probe · windows-2025 · e2e` 与 `Probe · macos-26 · e2e`。

```bash
gh run watch $(gh run list --branch ci/promote-win11-arm-e2e --workflow platform --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

预期：全部阻塞 job success（含 windows-11-arm · build+e2e）。注意 arm64 行约 15 分钟，是整个 PR 的关键路径。

**Step 3: 合并后观察 main 一次**

合并后 main 的下一次 platform 运行中确认同样展开。若随后 15 分钟内又有 push 进 main，该行会再次显示"已取消"——这是 concurrency 的预期行为，不是失败；它会在最新一次运行中重跑。

---

## 风险与回滚

- 回滚 = revert 那两个 commit，矩阵回到 4+3 行。
- 若 arm64 runner 出现排队/容量问题（GitHub 对 `windows-11-arm` 是较新的镜像），阻塞行会拉长 PR 等待；届时可退回探测行或在 §6.3 的缩量开关里讨论。
