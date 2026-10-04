import type { PromptRule, SpeakerSide, Stage } from "./models";
import type { TimeSource } from "./clock";
import { authoritativeDelta, systemTimeSource } from "./clock";

export type EngineStatus = "idle" | "running" | "paused" | "finished";

export interface Slot {
  id: string;
  label: string;
  side: SpeakerSide | null;
  limitMs: number;
  remainMs: number;
}

export interface Snapshot {
  status: EngineStatus;
  slots: Slot[];
  activeSlotId: string | null;
  /** 当前活动表的剩余毫秒 */
  remainMs: number;
  /** 超时毫秒（仅在 stage.overtime === 'count' 时累计） */
  overtimeMs: number;
}

export interface PromptEvent {
  rule: PromptRule;
  slotId: string;
}

type Listener<T> = (payload: T) => void;

interface Mark {
  /** 绝对墙钟时间戳 */
  at: number;
  rule: PromptRule;
  slotId: string;
  fired: boolean;
}

function markKey(slotId: string, rule: PromptRule): string {
  return `${slotId}:${rule.atRemainingSec}`;
}

function buildSlots(stage: Stage): Slot[] {
  const side: SpeakerSide | null = stage.side === "neutral" ? null : stage.side;
  const t = stage.timing;
  switch (t.kind) {
    case "single": {
      const ms = t.limitSec * 1000;
      return [{ id: "main", label: stage.name, side, limitMs: ms, remainMs: ms }];
    }
    case "split":
      return t.buckets.map((b) => {
        const ms = b.limitSec * 1000;
        return { id: b.id, label: b.label, side, limitMs: ms, remainMs: ms };
      });
    case "alternating": {
      const ms = t.perSideSec * 1000;
      return (["pro", "con"] as SpeakerSide[]).map((s) => ({
        id: s,
        label: s,
        side: s,
        limitMs: ms,
        remainMs: ms,
      }));
    }
  }
}

/**
 * 计时引擎。
 *
 * 两条硬规则：
 * 1. 剩余时间永远由 **绝对截止时间戳 deadline** 算出，不做 tick 累加 —— 杜绝累积漂移。
 * 2. 提示点预先算成绝对时间戳（marks），tick 只做"跨过检测" —— 掉帧或休眠后一次性补触发，绝不漏。
 *
 * 引擎不含任何定时器：由 UI 层驱动 `tick()`，因此在测试里可以手动推进时间。
 */
export class TimerEngine {
  private time: TimeSource;
  private stage: Stage | null = null;
  private slots: Slot[] = [];
  private activeIndex = 0;
  private status: EngineStatus = "idle";
  private deadline: number | null = null;
  private pausedRemain: number | null = null;
  private marks: Mark[] = [];
  private firedKeys = new Set<string>();
  private overtimeMs = 0;
  private finishEmitted = false;
  private finishedWall = 0;
  private lastWall = 0;
  private lastPerf = 0;

  private tickListeners: Listener<Snapshot>[] = [];
  private promptListeners: Listener<PromptEvent>[] = [];
  private finishListeners: Listener<Snapshot>[] = [];

  constructor(time: TimeSource = systemTimeSource()) {
    this.time = time;
    this.sampleClock();
  }

  // ---------- 订阅 ----------

  onTick(cb: Listener<Snapshot>): () => void {
    this.tickListeners.push(cb);
    return () => {
      this.tickListeners = this.tickListeners.filter((l) => l !== cb);
    };
  }

  onPrompt(cb: Listener<PromptEvent>): () => void {
    this.promptListeners.push(cb);
    return () => {
      this.promptListeners = this.promptListeners.filter((l) => l !== cb);
    };
  }

  onFinish(cb: Listener<Snapshot>): () => void {
    this.finishListeners.push(cb);
    return () => {
      this.finishListeners = this.finishListeners.filter((l) => l !== cb);
    };
  }

  // ---------- 生命周期 ----------

  loadStage(stage: Stage): void {
    this.stage = stage;
    this.slots = buildSlots(stage);
    this.activeIndex = 0;
    const timing = stage.timing;
    if (timing.kind === "alternating") {
      const idx = this.slots.findIndex((s) => s.id === timing.firstSide);
      this.activeIndex = idx >= 0 ? idx : 0;
    }
    this.reset();
  }

  reset(): void {
    for (const s of this.slots) s.remainMs = s.limitMs;
    this.status = "idle";
    this.deadline = null;
    this.pausedRemain = null;
    this.marks = [];
    this.firedKeys.clear();
    this.overtimeMs = 0;
    this.finishEmitted = false;
    this.sampleClock();
    this.emitTick();
  }

  start(): void {
    const slot = this.activeSlot();
    if (!slot || this.status === "running") return;
    this.deadline = this.time.wall() + slot.remainMs;
    this.status = "running";
    this.sampleClock();
    this.rebuildMarks();
    this.emitTick();
  }

  pause(): void {
    if (this.status !== "running" || this.deadline === null) return;
    const slot = this.activeSlot();
    if (!slot) return;
    slot.remainMs = Math.max(0, this.deadline - this.time.wall());
    this.pausedRemain = slot.remainMs;
    this.status = "paused";
    this.deadline = null;
    this.emitTick();
  }

  resume(): void {
    const slot = this.activeSlot();
    if (this.status !== "paused" || !slot) return;
    this.deadline = this.time.wall() + (this.pausedRemain ?? slot.remainMs);
    this.pausedRemain = null;
    this.status = "running";
    this.sampleClock();
    this.rebuildMarks();
    this.emitTick();
  }

  toggle(): void {
    if (this.status === "running") this.pause();
    else if (this.status === "paused") this.resume();
    else if (this.status === "idle") this.start();
  }

  /** 加时/减时（毫秒，可正可负） */
  adjust(deltaMs: number): void {
    const slot = this.activeSlot();
    if (!slot) return;
    if (this.status === "running" && this.deadline !== null) {
      this.deadline += deltaMs;
      this.rebuildMarks();
    } else if (this.status === "idle" || this.status === "paused") {
      slot.remainMs = Math.max(0, slot.remainMs + deltaMs);
      if (this.status === "paused") this.pausedRemain = slot.remainMs;
    }
    this.emitTick();
  }

  /** 切换活动表（split 的桶间切换 / alternating 的正反方切换） */
  setActiveSlot(id: string): void {
    const idx = this.slots.findIndex((s) => s.id === id);
    if (idx < 0 || idx === this.activeIndex) return;
    const now = this.time.wall();
    const prev = this.activeSlot();
    if (this.status === "running" && this.deadline !== null && prev) {
      prev.remainMs = Math.max(0, this.deadline - now);
    }
    this.activeIndex = idx;
    if (this.status === "running") {
      this.deadline = now + this.slots[idx].remainMs;
      this.rebuildMarks();
    }
    this.emitTick();
  }

  /** 循环切到下一块表（自由辩论里按 Tab 切正反方） */
  nextSlot(): void {
    if (this.slots.length === 0) return;
    const next = this.slots[(this.activeIndex + 1) % this.slots.length];
    this.setActiveSlot(next.id);
  }

  // ---------- 驱动 ----------

  /** 由 UI 层每帧调用；测试里手动调用。 */
  tick(): void {
    const nowWall = this.time.wall();
    const nowPerf = this.time.perf();
    const wallDelta = nowWall - this.lastWall;
    const perfDelta = nowPerf - this.lastPerf;
    this.lastWall = nowWall;
    this.lastPerf = nowPerf;

    if (this.status === "running" && this.deadline !== null) {
      // 墙钟回拨时按单调时钟补偿，保证计时连续推进
      this.deadline += wallDelta - authoritativeDelta(perfDelta, wallDelta);

      const slot = this.activeSlot();
      if (slot) {
        const remain = this.deadline - nowWall;
        slot.remainMs = Math.max(0, remain);
        this.fireMarks(nowWall);
        if (remain <= 0) {
          slot.remainMs = 0;
          this.status = "finished";
          this.finishedWall = nowWall;
          this.overtimeMs = 0;
          this.deadline = null;
          if (!this.finishEmitted) {
            this.finishEmitted = true;
            this.emitFinish();
          }
        }
      }
    } else if (this.status === "finished" && this.stage?.overtime === "count") {
      this.overtimeMs = Math.max(0, nowWall - this.finishedWall);
    }

    this.emitTick();
  }

  // ---------- 状态 ----------

  snapshot(): Snapshot {
    const active = this.activeSlot();
    return {
      status: this.status,
      slots: this.slots.map((s) => ({ ...s })),
      activeSlotId: active?.id ?? null,
      remainMs: active?.remainMs ?? 0,
      overtimeMs: this.overtimeMs,
    };
  }

  get currentStatus(): EngineStatus {
    return this.status;
  }

  get activeSide(): SpeakerSide | null {
    return this.activeSlot()?.side ?? null;
  }

  // ---------- 内部 ----------

  private activeSlot(): Slot | null {
    return this.slots[this.activeIndex] ?? null;
  }

  private sampleClock(): void {
    this.lastWall = this.time.wall();
    this.lastPerf = this.time.perf();
  }

  private rebuildMarks(): void {
    const slot = this.activeSlot();
    if (!slot || this.deadline === null || !this.stage) {
      this.marks = [];
      return;
    }
    const deadline = this.deadline;
    const stage = this.stage;
    this.marks = stage.prompts
      .map((rule) => ({
        at: deadline - rule.atRemainingSec * 1000,
        rule,
        slotId: slot.id,
        fired: this.firedKeys.has(markKey(slot.id, rule)),
      }))
      .sort((a, b) => a.at - b.at);
  }

  private fireMarks(now: number): void {
    for (const m of this.marks) {
      if (!m.fired && now >= m.at) {
        m.fired = true;
        this.firedKeys.add(markKey(m.slotId, m.rule));
        for (const cb of this.promptListeners) cb({ rule: m.rule, slotId: m.slotId });
      }
    }
  }

  private emitTick(): void {
    const snap = this.snapshot();
    for (const cb of this.tickListeners) cb(snap);
  }

  private emitFinish(): void {
    const snap = this.snapshot();
    for (const cb of this.finishListeners) cb(snap);
  }
}
