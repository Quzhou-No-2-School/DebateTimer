/** 领域模型：纯类型 + 纯函数，零框架、零 Tauri 依赖。 */

export type Side = "pro" | "con" | "neutral";

export type SpeakerSide = Extract<Side, "pro" | "con">;

/** 提示音类型，由 core/audio.ts 合成 */
export type PromptSound = "short" | "bell" | "double";

export interface PromptRule {
  /** 剩余多少秒时触发（0 = 时间到） */
  atRemainingSec: number;
  /** 屏幕提示文字，如"还剩 30 秒" */
  label?: string;
  sound?: PromptSound;
  /** 响几声（奥瑞冈需要一/两/三声） */
  repeat?: number;
  /** 是否闪烁强调 */
  flash?: boolean;
}

/**
 * 计时模式。调研确认三种都是真实需求：
 * - single：单边倒计时，走完即止
 * - split：同一环节多块表分别累计（如盘问：提问累计 1min / 回答累计 3min）
 * - alternating：双边分离计时（自由辩论：双方各一块表，一方停下即切另一方）
 */
export type TimingMode =
  | { kind: "single"; limitSec: number }
  | { kind: "split"; buckets: TimingBucket[] }
  | { kind: "alternating"; perSideSec: number; firstSide: SpeakerSide };

export interface TimingBucket {
  id: string;
  label: string;
  limitSec: number;
}

export interface Stage {
  id: string;
  /** 环节名，如"正方一辩立论" */
  name: string;
  side: Side;
  /** 发言人，如"一辩"，可现场编辑 */
  speaker?: string;
  timing: TimingMode;
  prompts: PromptRule[];
  /** 时间到之后：停止计时 / 继续计超时 */
  overtime: "stop" | "count";
}

export interface FlowTemplate {
  id: string;
  name: string;
  builtin: boolean;
  stages: Stage[];
}

export interface MatchState {
  topic: string;
  proName: string;
  conName: string;
  templateId: string;
  stageIndex: number;
}

export interface Preferences {
  volume: number;
  soundEnabled: boolean;
  promptsEnabled: boolean;
}

/** 环节总时长（秒）。split 取各桶之和，alternating 取双方之和。 */
export function stageTotalSec(stage: Stage): number {
  const t = stage.timing;
  switch (t.kind) {
    case "single":
      return t.limitSec;
    case "split":
      return t.buckets.reduce((sum, b) => sum + b.limitSec, 0);
    case "alternating":
      return t.perSideSec * 2;
  }
}

export const DEFAULT_PREFERENCES: Preferences = {
  volume: 0.8,
  soundEnabled: true,
  promptsEnabled: true,
};

export const DEFAULT_MATCH: MatchState = {
  topic: "辩题",
  proName: "正方",
  conName: "反方",
  templateId: "",
  stageIndex: 0,
};
