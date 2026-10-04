<script lang="ts">
  import { config } from "../lib/config.svelte";
  import { timer } from "../lib/timer.svelte";
  import type { FlowTemplate, PromptRule } from "../core/models";
  import { exportTemplate, importTemplate } from "../core/storage";
  import { playPrompt, unlockAudio } from "../core/audio";

  let { open = $bindable(false), onQuit }: { open?: boolean; onQuit?: () => void } = $props();

  let json = $state("");
  let error = $state<string | null>(null);
  let tpl = $derived(config.template);

  /** 内置模板不允许原地修改：首次编辑自动另存为自定义 */
  function ensureEditable(): FlowTemplate | undefined {
    if (!tpl) return undefined;
    if (tpl.builtin) {
      config.deriveCustom();
      config.save();
    }
    return config.template;
  }

  function apply(mutate: (t: FlowTemplate) => void) {
    const t = ensureEditable();
    if (!t) return;
    mutate(t);
    config.save();
    timer.loadStage(timer.stageIndex);
  }

  function leadPrompt(stage: FlowTemplate["stages"][number]): PromptRule | undefined {
    return stage.prompts.find((p) => p.atRemainingSec > 0);
  }

  function primaryLimit(stage: FlowTemplate["stages"][number]): number | null {
    const t = stage.timing;
    if (t.kind === "single") return t.limitSec;
    if (t.kind === "alternating") return t.perSideSec;
    return null;
  }

  function setLimit(stage: FlowTemplate["stages"][number], sec: number) {
    const t = stage.timing;
    if (t.kind === "single") t.limitSec = sec;
    else if (t.kind === "alternating") t.perSideSec = sec;
  }

  function doExport() {
    if (tpl) json = exportTemplate(tpl);
  }

  function doImport() {
    try {
      const t = importTemplate(json);
      config.customTemplates.push(t);
      config.useTemplate(t.id);
      timer.loadStage(0);
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "导入失败";
    }
  }

  const field = "rounded border border-line px-2 py-1 text-sm outline-none focus:border-accent";
  const btn =
    "rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent";
</script>

{#if open}
  <div
    class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/20 py-10"
    role="presentation"
    onclick={() => (open = false)}
  >
    <div
      class="w-[52rem] rounded-xl border border-line bg-canvas p-8 shadow-lg"
      role="dialog"
      aria-label="赛制设置"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          open = false;
        }
      }}
    >
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-lg font-semibold">赛制</h2>
        <div class="flex items-center gap-2">
          {#if onQuit}
            <button class="{btn} text-ink-muted" onclick={onQuit}>退出应用</button>
          {/if}
          <button class={btn} onclick={() => (open = false)}>关闭</button>
        </div>
      </div>

      <!-- 模板选择 -->
      <section class="mb-6">
        <h3 class="mb-2 text-sm font-medium text-ink-muted">选择流程</h3>
        <div class="flex flex-wrap gap-2">
          {#each config.allTemplates as t (t.id)}
            <button
              class="{btn} {t.id === config.match.templateId ? 'border-accent text-accent' : ''}"
              onclick={() => {
                config.useTemplate(t.id);
                timer.loadStage(0);
              }}
            >
              {t.name}{t.builtin ? "" : "（自定义）"}
            </button>
          {/each}
        </div>
        <p class="mt-2 text-xs text-ink-muted">
          修改内置流程时会自动另存为自定义副本，内置数据不会被改坏。
        </p>
      </section>

      <!-- 环节编辑 -->
      <section class="mb-6">
        <h3 class="mb-2 text-sm font-medium text-ink-muted">环节</h3>
        <div class="flex flex-col gap-2">
          {#each tpl?.stages ?? [] as stage, i (stage.id)}
            <div class="flex items-center gap-2 rounded border border-line p-2">
              <span class="w-6 text-center text-xs text-ink-muted">{i + 1}</span>
              <input
                class="{field} flex-1"
                value={stage.name}
                oninput={(e) => {
                  const v = e.currentTarget.value;
                  apply((t) => (t.stages[i].name = v));
                }}
              />
              {#if primaryLimit(stage) !== null}
                <input
                  class="{field} w-20 text-right"
                  type="number"
                  min="1"
                  value={primaryLimit(stage)}
                  oninput={(e) => {
                    const v = Number(e.currentTarget.value);
                    apply((t) => setLimit(t.stages[i], Number.isFinite(v) && v > 0 ? v : 1));
                  }}
                />
                <span class="text-xs text-ink-muted">
                  秒{stage.timing.kind === "alternating" ? "／每方" : ""}
                </span>
              {:else}
                <span class="w-20 text-right text-xs text-ink-muted">分桶计时</span>
              {/if}
              <input
                class="{field} w-16 text-right"
                type="number"
                min="0"
                value={leadPrompt(stage)?.atRemainingSec ?? 0}
                oninput={(e) => {
                  const v = Number(e.currentTarget.value);
                  apply((t) => {
                    const p = leadPrompt(t.stages[i]);
                    if (p) p.atRemainingSec = Math.max(0, Number.isFinite(v) ? v : 0);
                  });
                }}
              />
              <span class="text-xs text-ink-muted">秒提示</span>
              <button class={btn} onclick={() => apply((t) => t.stages.splice(i, 1))}>删除</button>
              <button
                class={btn}
                disabled={i === 0}
                onclick={() =>
                  apply((t) => {
                    if (i > 0) [t.stages[i - 1], t.stages[i]] = [t.stages[i], t.stages[i - 1]];
                  })}
              >
                上移
              </button>
            </div>

            {#if stage.timing.kind === "split"}
              <div class="ml-8 flex flex-wrap gap-3 text-xs text-ink-muted">
                {#each stage.timing.buckets as bucket, bi (bucket.id)}
                  <label class="flex items-center gap-1">
                    {bucket.label}
                    <input
                      class="{field} w-16 text-right"
                      type="number"
                      min="1"
                      value={bucket.limitSec}
                      oninput={(e) => {
                        const v = Number(e.currentTarget.value);
                        apply((t) => {
                          const st = t.stages[i];
                          if (st.timing.kind === "split") {
                            st.timing.buckets[bi].limitSec = Number.isFinite(v) && v > 0 ? v : 1;
                          }
                        });
                      }}
                    />
                    秒
                  </label>
                {/each}
              </div>
            {/if}
          {/each}
        </div>
        <button
          class="{btn} mt-3"
          onclick={() =>
            apply((t) =>
              t.stages.push({
                id: `st-${Date.now()}`,
                name: `环节 ${t.stages.length + 1}`,
                side: "neutral",
                timing: { kind: "single", limitSec: 180 },
                prompts: [
                  { atRemainingSec: 30, label: "还剩 30 秒", sound: "short", repeat: 1 },
                  { atRemainingSec: 0, label: "时间到", sound: "bell", repeat: 1 },
                ],
                overtime: "stop",
              }),
            )}
        >
          添加环节
        </button>
      </section>

      <!-- 提示音 -->
      <section class="mb-6">
        <h3 class="mb-2 text-sm font-medium text-ink-muted">提示音</h3>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={config.preferences.soundEnabled} />
            开启
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            bind:value={config.preferences.volume}
            onchange={() => config.save()}
          />
          <button
            class={btn}
            onclick={() => {
              unlockAudio();
              playPrompt("short", { volume: config.preferences.volume });
              playPrompt("bell", { volume: config.preferences.volume });
            }}
          >
            试听
          </button>
        </div>
      </section>

      <!-- 导入导出 -->
      <section>
        <h3 class="mb-2 text-sm font-medium text-ink-muted">导入 / 导出（JSON，可拷给其他老师）</h3>
        <div class="flex gap-2">
          <button class={btn} onclick={doExport}>导出当前流程</button>
          <button class={btn} onclick={doImport}>导入</button>
        </div>
        <textarea
          class="{field} mt-2 h-32 w-full font-mono text-xs"
          placeholder="导出的 JSON 会显示在这里；也可粘贴 JSON 后点“导入”"
          bind:value={json}></textarea>
        {#if error}
          <p class="mt-1 text-xs text-danger">{error}</p>
        {/if}
      </section>
    </div>
  </div>
{/if}
