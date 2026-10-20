<script lang="ts">
  import "../app.css";
  import { config } from "../lib/config.svelte";
  import { BACKGROUNDS } from "../core/models";
  let { children } = $props();

  const bg = $derived(BACKGROUNDS.find((b) => b.id === config.preferences.background));
</script>

<div class="relative h-screen w-screen overflow-hidden bg-canvas text-ink">
  {#if bg}
    <img
      src={bg.src}
      alt=""
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style:opacity={config.preferences.backgroundOpacity}
    />
  {/if}
  <div class="relative h-full w-full">
    {@render children()}
  </div>
</div>
