import { TimerEngine } from "../core/engine";
import type { EngineStatus, Slot } from "../core/engine";
import type { PromptRule } from "../core/models";
import { playPrompt } from "../core/audio";
import { config } from "./config.svelte";

const PROMPT_LINGER_MS = 4000;

class TimerStore {
  engine = new TimerEngine();

  status = $state<EngineStatus>("idle");
  remainMs = $state(0);
  overtimeMs = $state(0);
  slots = $state<Slot[]>([]);
  activeSlotId = $state<string | null>(null);
  stageIndex = $state(0);

  promptLabel = $state<string | null>(null);
  promptFlash = $state(false);

  private promptTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId = 0;
  private looping = false;

  constructor() {
    this.engine.onTick((s) => {
      this.status = s.status;
      this.remainMs = s.remainMs;
      this.overtimeMs = s.overtimeMs;
      this.slots = s.slots;
      this.activeSlotId = s.activeSlotId;
    });
    this.engine.onPrompt(({ rule }) => this.onPrompt(rule));
  }

  get stage() {
    return config.template?.stages[this.stageIndex] ?? null;
  }

  get stageCount(): number {
    return config.template?.stages.length ?? 0;
  }

  /** 由 UI 每帧驱动 */
  startLoop(): void {
    if (this.looping) return;
    this.looping = true;
    const frame = () => {
      this.engine.tick();
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stopLoop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.looping = false;
  }

  loadStage(index: number): void {
    const stages = config.template?.stages ?? [];
    if (stages.length === 0) return;
    const i = Math.min(Math.max(index, 0), stages.length - 1);
    this.stageIndex = i;
    config.match.stageIndex = i;
    config.save();
    this.engine.loadStage(stages[i]);
    this.clearPrompt();
  }

  next(): void {
    this.loadStage(this.stageIndex + 1);
  }

  prev(): void {
    this.loadStage(this.stageIndex - 1);
  }

  goto(index: number): void {
    this.loadStage(index);
  }

  toggle(): void {
    this.engine.toggle();
  }

  adjust(deltaMs: number): void {
    this.engine.adjust(deltaMs);
  }

  switchSide(): void {
    this.engine.nextSlot();
  }

  private onPrompt(rule: PromptRule): void {
    this.promptLabel = rule.label ?? null;
    this.promptFlash = rule.flash ?? false;

    if (config.preferences.soundEnabled) {
      playPrompt(rule.sound ?? "short", {
        volume: config.preferences.volume,
        repeat: rule.repeat ?? 1,
      });
    }

    // "时间到" 常驻直到切环节；过程提示几秒后自动消失
    if (this.promptTimer) clearTimeout(this.promptTimer);
    if (rule.atRemainingSec > 0) {
      this.promptTimer = setTimeout(() => {
        this.promptLabel = null;
        this.promptTimer = null;
      }, PROMPT_LINGER_MS);
    }
  }

  private clearPrompt(): void {
    if (this.promptTimer) clearTimeout(this.promptTimer);
    this.promptTimer = null;
    this.promptLabel = null;
    this.promptFlash = false;
  }
}

export const timer = new TimerStore();
