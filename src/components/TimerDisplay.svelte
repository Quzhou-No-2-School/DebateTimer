<script lang="ts">
  import { timer } from "../lib/timer.svelte";
  import { formatClock, formatOvertime } from "../core/format";

  let text = $derived(
    timer.remainMs > 0
      ? formatClock(timer.remainMs)
      : timer.overtimeMs > 0
        ? formatOvertime(timer.overtimeMs)
        : "00:00",
  );

  let tone = $derived(
    timer.remainMs <= 0
      ? "text-danger"
      : timer.status !== "idle" && timer.remainMs <= 30_000
        ? "text-warn"
        : "text-ink",
  );
</script>

<div
  class="tnum leading-none font-semibold tracking-tight transition-colors duration-200 {tone}"
  style="font-size: clamp(4rem, 22vh, 20rem)"
>
  {text}
</div>
