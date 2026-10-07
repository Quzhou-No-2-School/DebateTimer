<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { timer } from "../lib/timer.svelte";
  import { config } from "../lib/config.svelte";
  import { resolveHotkey } from "../core/hotkeys";
  import { unlockAudio } from "../core/audio";
  import TimerDisplay from "../components/TimerDisplay.svelte";
  import TopicHeader from "../components/TopicHeader.svelte";
  import StageBar from "../components/StageBar.svelte";
  import FreeDebatePanel from "../components/FreeDebatePanel.svelte";
  import ControlBar from "../components/ControlBar.svelte";
  import PromptOverlay from "../components/PromptOverlay.svelte";
  import HelpOverlay from "../components/HelpOverlay.svelte";
  import SettingsPanel from "../components/SettingsPanel.svelte";
  import ConfirmDialog from "../components/ConfirmDialog.svelte";

  let editing = $state<"topic" | "pro" | "con" | null>(null);
  let helpOpen = $state(false);
  let settingsOpen = $state(false);
  let quitOpen = $state(false);
  let resetOpen = $state(false);
  let controlsVisible = $state(true);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  // e2e 专用：@wdio/tauri-service 的 browser.tauri.*（窗口状态轮询等）依赖
  // 该前端插件暴露的核心引用；仅在 e2e 构建模式下加载，release 产物不含。
  if (import.meta.env.MODE === "e2e") {
    void import("@wdio/tauri-plugin");
  }

  function wake() {
    // 浏览器会挂起 AudioContext 直到首次用户交互——不解锁的话现场第一声铃是静音的
    unlockAudio();
    controlsVisible = true;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => (controlsVisible = false), 3000);
  }

  async function toggleFullscreen() {
    try {
      const w = getCurrentWindow();
      await w.setFullscreen(!(await w.isFullscreen()));
    } catch {
      // 纯浏览器开发模式下没有 Tauri 窗口，忽略
    }
  }

  async function quit() {
    quitOpen = false;
    timer.stopLoop();
    config.save();
    try {
      await getCurrentWindow().close();
    } catch {
      // 纯浏览器开发模式下没有 Tauri 窗口，忽略
    }
  }

  function resetMatch() {
    resetOpen = false;
    timer.loadStage(0);
  }

  function onKeydown(e: KeyboardEvent) {
    wake();
    const action = resolveHotkey(e);
    if (!action) return;

    if (
      (quitOpen || resetOpen || helpOpen || settingsOpen) &&
      action.type !== "close"
    ) {
      return;
    }

    switch (action.type) {
      case "toggle":
        e.preventDefault();
        timer.toggle();
        break;
      case "nextStage":
        timer.next();
        break;
      case "prevStage":
        timer.prev();
        break;
      case "switchSide":
        e.preventDefault();
        timer.switchSide();
        break;
      case "adjust":
        timer.adjust(action.deltaMs);
        break;
      case "gotoStage":
        timer.goto(action.index);
        break;
      case "editTopic":
        editing = "topic";
        break;
      case "fullscreen":
        e.preventDefault();
        void toggleFullscreen();
        break;
      case "help":
        helpOpen = !helpOpen;
        break;
      case "close":
        if (quitOpen) quitOpen = false;
        else if (resetOpen) resetOpen = false;
        else if (helpOpen) helpOpen = false;
        else if (settingsOpen) settingsOpen = false;
        else editing = null;
        break;
    }
  }

  onMount(() => {
    timer.loadStage(config.match.stageIndex ?? 0);
    timer.startLoop();
    wake();
    return () => timer.stopLoop();
  });
</script>

<svelte:window onkeydown={onKeydown} onpointerdown={wake} onmousemove={wake} />

<main class="flex h-full w-full flex-col">
  <TopicHeader {editing} onEdit={(t) => (editing = t)} />

  <section class="flex flex-1 flex-col items-center justify-center gap-6">
    <PromptOverlay />
    <TimerDisplay />
    <StageBar />
    <FreeDebatePanel />
  </section>

  <ControlBar
    visible={controlsVisible}
    onHelp={() => (helpOpen = true)}
    onSettings={() => (settingsOpen = true)}
    onQuit={() => (quitOpen = true)}
    onReset={() => (resetOpen = true)}
  />
</main>

<HelpOverlay open={helpOpen} onClose={() => (helpOpen = false)} />
<SettingsPanel bind:open={settingsOpen} onQuit={() => (quitOpen = true)} />
<ConfirmDialog
  open={quitOpen}
  title="退出应用？"
  body="比赛进行中退出会中断计时，请确认。"
  confirmLabel="退出"
  onCancel={() => (quitOpen = false)}
  onConfirm={quit}
/>
<ConfirmDialog
  open={resetOpen}
  title="重置全流程？"
  body="将清空所有环节的进度并回到第一环节，辩题与队名保留。"
  confirmLabel="确认重置"
  onCancel={() => (resetOpen = false)}
  onConfirm={resetMatch}
/>
