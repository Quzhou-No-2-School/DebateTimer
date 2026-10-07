<script lang="ts">
  import { releaseFocus } from "../lib/focus";
  interface Props {
    open: boolean;
    title: string;
    body: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
  }
  let { open, title, body, confirmLabel, onCancel, onConfirm }: Props = $props();

  let dialog = $state<HTMLDivElement | null>(null);

  // 打开时把焦点收进弹窗容器（不落在按钮上，误按空格 / Enter 不会触发任何一边）。
  // 背景按钮若仍持有焦点，原生 click 会绕过全局快捷键闸门。
  $effect(() => {
    if (!open || !dialog) return;
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.focus();
    return () => releaseFocus(prev);
  });

  /** Tab 只在弹窗按钮间循环，不依赖 WebView 对 inert 的支持 */
  function trapTab(e: KeyboardEvent) {
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>("button"));
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
    items[next].focus();
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20"
    role="presentation"
    onclick={onCancel}
  >
    <div
      class="w-96 rounded-xl border border-line bg-canvas p-8 shadow-lg"
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        } else if (e.key === "Tab") {
          trapTab(e);
        }
      }}
    >
      <h2 class="mb-2 text-lg font-semibold">{title}</h2>
      <p class="mb-6 text-sm text-ink-muted">{body}</p>
      <div class="flex justify-end gap-3">
        <button
          class="rounded-md border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent"
          onclick={onCancel}
        >
          取消
        </button>
        <button
          class="rounded-md border border-danger px-4 py-2 text-sm text-danger hover:bg-danger hover:text-white"
          onclick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
