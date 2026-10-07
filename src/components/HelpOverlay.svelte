<script lang="ts">
  interface Props {
    open: boolean;
    onClose: () => void;
  }
  let { open, onClose }: Props = $props();

  const rows: [string, string][] = [
    ["空格", "开始 / 暂停当前环节"],
    ["Enter 或 →", "进入下一环节"],
    ["Backspace 或 ←", "回到上一环节"],
    ["Tab", "自由辩论切换发言方"],
    ["+ / −", "当前环节 ±10 秒（Shift 为 ±60 秒）"],
    ["1 – 9", "直接跳到第 N 个环节"],
    ["T", "修改辩题"],
    ["F11 或 F", "全屏切换"],
    ["H", "显示 / 隐藏本帮助"],
    ["Esc", "关闭弹窗 / 退出编辑"],
  ];
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20"
    role="presentation"
    onclick={onClose}
  >
    <div
      class="w-[36rem] rounded-xl border border-line bg-canvas p-8 shadow-lg"
      role="dialog"
      aria-label="快捷键"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <h2 class="mb-5 text-lg font-semibold">快捷键</h2>
      <dl class="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
        {#each rows as [key, desc] (key)}
          <dt class="font-medium text-ink">{key}</dt>
          <dd class="text-ink-muted">{desc}</dd>
        {/each}
      </dl>
      <button
        class="mt-6 rounded-md border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent"
        onclick={onClose}
      >
        关闭
      </button>
    </div>
  </div>
{/if}
