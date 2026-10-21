<script lang="ts">
  import { config } from "../lib/config.svelte";
  import { timer } from "../lib/timer.svelte";
  import type { Stage } from "../core/models";
  import { stageTotalSec } from "../core/models";
  import { formatClock } from "../core/format";

  let stages = $derived(config.template?.stages ?? []);

  const STATUS_TEXT: Record<typeof timer.status, string> = {
    idle: "待开始",
    running: "进行中",
    paused: "已暂停",
    finished: "已结束",
  };

  /** 双边交替制按“每方”显示，避免自由辩论被误读成 12 分钟 */
  function durationText(stage: Stage): string {
    if (stage.timing.kind === "alternating") {
      return `${formatClock(stage.timing.perSideSec * 1000)}/方`;
    }
    return formatClock(stageTotalSec(stage) * 1000);
  }

  let container = $state<HTMLOListElement | null>(null);

  // 切环节后把当前项滚到容器中部。直接改 scrollTop，避免 scrollIntoView 连带滚动祖先。
  $effect(() => {
    void timer.stageIndex;
    void config.match.templateId;
    const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!container || !active) return;
    container.scrollTop = Math.max(
      0,
      active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2,
    );
  });
</script>

{#if stages.length > 0}
  <nav
    class="absolute top-1/2 left-4 z-10 w-44 -translate-y-1/2 overflow-hidden rounded-lg border border-line bg-canvas/85 backdrop-blur-sm xl:w-52"
    aria-label="赛制流程"
    data-testid="flow-rail"
  >
    <div class="flex items-baseline justify-between border-b border-line px-3 py-2">
      <span class="text-xs font-medium tracking-wide text-ink-muted">赛制流程</span>
      <span class="tnum text-[11px] text-ink-muted">{timer.stageIndex + 1}/{stages.length}</span>
    </div>
    <ol
      class="relative max-h-[calc(100vh-14rem)] [scrollbar-width:thin] [scrollbar-color:var(--color-line)_transparent] overflow-y-auto py-1"
      bind:this={container}
    >
      {#each stages as stage, i (stage.id)}
        {@const isCurrent = i === timer.stageIndex}
        {@const isDone = i < timer.stageIndex}
        <li
          class="flex gap-2 border-l-2 px-3 py-1.5 {isCurrent
            ? 'border-accent bg-surface'
            : 'border-transparent'}"
          aria-current={isCurrent ? "step" : undefined}
          data-testid="flow-rail-item"
        >
          <span
            class="tnum w-4 shrink-0 text-right text-[11px] leading-4 {isDone
              ? 'text-ink-muted/60'
              : 'text-ink-muted'}"
          >
            {isDone ? "✓" : i + 1}
          </span>
          <span class="min-w-0 flex-1">
            <span
              class="block text-xs leading-4 {isCurrent
                ? 'font-medium text-ink'
                : isDone
                  ? 'text-ink-muted/60'
                  : 'text-ink-muted'}"
            >
              {stage.name}
            </span>
            {#if isCurrent}
              <span class="text-[10px] leading-4 text-accent">{STATUS_TEXT[timer.status]}</span>
            {/if}
          </span>
          <span class="tnum shrink-0 text-[11px] leading-4 text-ink-muted">
            {durationText(stage)}
          </span>
        </li>
      {/each}
    </ol>
  </nav>
{/if}
