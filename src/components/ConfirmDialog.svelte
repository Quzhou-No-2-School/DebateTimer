<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    body: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
  }
  let { open, title, body, confirmLabel, onCancel, onConfirm }: Props = $props();
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20"
    role="presentation"
    onclick={onCancel}
  >
    <div
      class="w-96 rounded-xl border border-line bg-canvas p-8 shadow-lg"
      role="dialog"
      aria-label={title}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
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
