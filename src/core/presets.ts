import type { FlowTemplate, PromptRule, Side, SpeakerSide, Stage, TimingMode } from "./models";

/**
 * 内置赛制。
 *
 * 重要调研结论：全国**没有统一的辩论赛计时标准**，"剩 30 秒提示"只是行业惯例，
 * 各校差异很大。所以这里的每个数字都可被用户在赛制编辑器里改掉，
 * 且改动内置模板时会"另存为自定义"，不污染内置数据。
 */

function min(m: number, s = 0): number {
  return m * 60 + s;
}

/** 通用提示：环节越长，提前量越大 */
function defaultPrompts(limitSec: number): PromptRule[] {
  const lead = limitSec >= 120 ? 30 : limitSec >= 60 ? 15 : 10;
  return [
    { atRemainingSec: lead, label: `还剩 ${lead} 秒`, sound: "short", repeat: 1 },
    { atRemainingSec: 0, label: "时间到", sound: "bell", repeat: 1 },
  ];
}

/** 中学赛制的黄牌 / 红牌提示 */
function cardPrompts(yellowAtRemainingSec: number): PromptRule[] {
  return [
    { atRemainingSec: yellowAtRemainingSec, label: "黄牌", sound: "short", repeat: 1, flash: true },
    { atRemainingSec: 0, label: "红牌", sound: "bell", repeat: 1, flash: true },
  ];
}

/** 奥瑞冈：申论 4:00 一声 / 4:30 两声 / 5:00 三声；质询与结辩 3:00 一声 / 3:30 两声 / 4:00 三声 */
function oregonPrompts(): PromptRule[] {
  return [
    { atRemainingSec: 60, label: "一声铃", sound: "short", repeat: 1 },
    { atRemainingSec: 30, label: "两声铃", sound: "short", repeat: 2 },
    { atRemainingSec: 0, label: "时间到 · 三声铃", sound: "short", repeat: 3 },
  ];
}

interface StageInit {
  id: string;
  name: string;
  side: Side;
  speaker?: string;
  timing: TimingMode;
  prompts?: PromptRule[];
  overtime?: Stage["overtime"];
}

function stage(init: StageInit): Stage {
  const limitSec = limitOf(init.timing);
  return {
    id: init.id,
    name: init.name,
    side: init.side,
    speaker: init.speaker,
    timing: init.timing,
    prompts: init.prompts ?? defaultPrompts(limitSec),
    overtime: init.overtime ?? "stop",
  };
}

function limitOf(timing: TimingMode): number {
  switch (timing.kind) {
    case "single":
      return timing.limitSec;
    case "split":
      return Math.max(...timing.buckets.map((b) => b.limitSec));
    case "alternating":
      return timing.perSideSec;
  }
}

function single(limitSec: number): TimingMode {
  return { kind: "single", limitSec };
}

function freeDebate(perSideSec: number, firstSide: SpeakerSide): TimingMode {
  return { kind: "alternating", perSideSec, firstSide };
}

/** 盘问：提问与回答分计（提问累计 1 分钟、回答累计 3 分钟） */
function querySplit(askSec: number, answerSec: number): TimingMode {
  return {
    kind: "split",
    buckets: [
      { id: "ask", label: "提问", limitSec: askSec },
      { id: "answer", label: "回答", limitSec: answerSec },
    ],
  };
}

// ---------------------------------------------------------------- 内置模板

const singapore: FlowTemplate = {
  id: "singapore-4",
  name: "新加坡模式（四人制）",
  builtin: true,
  stages: [
    stage({ id: "sg-1", name: "正方一辩陈词", side: "pro", speaker: "一辩", timing: single(min(3)) }),
    stage({ id: "sg-2", name: "反方一辩陈词", side: "con", speaker: "一辩", timing: single(min(3)) }),
    stage({ id: "sg-3", name: "正方二辩陈词", side: "pro", speaker: "二辩", timing: single(min(3)) }),
    stage({ id: "sg-4", name: "反方二辩陈词", side: "con", speaker: "二辩", timing: single(min(3)) }),
    stage({ id: "sg-5", name: "正方三辩陈词", side: "pro", speaker: "三辩", timing: single(min(3)) }),
    stage({ id: "sg-6", name: "反方三辩陈词", side: "con", speaker: "三辩", timing: single(min(3)) }),
    stage({ id: "sg-7", name: "自由辩论", side: "neutral", timing: freeDebate(min(4), "pro") }),
    stage({ id: "sg-8", name: "反方四辩总结", side: "con", speaker: "四辩", timing: single(min(4)) }),
    stage({ id: "sg-9", name: "正方四辩总结", side: "pro", speaker: "四辩", timing: single(min(4)) }),
  ],
};

const fourSpeakerUniv: FlowTemplate = {
  id: "four-speaker-univ",
  name: "四辩制（大学常见）",
  builtin: true,
  stages: [
    stage({ id: "u-1", name: "正方一辩立论", side: "pro", speaker: "一辩", timing: single(min(3)) }),
    stage({ id: "u-2", name: "反方一辩立论", side: "con", speaker: "一辩", timing: single(min(3)) }),
    stage({ id: "u-3", name: "正方二辩立证陈词", side: "pro", speaker: "二辩", timing: single(min(3)) }),
    stage({ id: "u-4", name: "反方二辩立证陈词", side: "con", speaker: "二辩", timing: single(min(3)) }),
    stage({ id: "u-5", name: "盘问（正方三辩提问）", side: "pro", speaker: "三辩", timing: querySplit(min(1), min(3)) }),
    stage({ id: "u-6", name: "盘问（反方三辩提问）", side: "con", speaker: "三辩", timing: querySplit(min(1), min(3)) }),
    stage({ id: "u-7", name: "自由辩论", side: "neutral", timing: freeDebate(min(5), "pro") }),
    stage({ id: "u-8", name: "反方四辩总结", side: "con", speaker: "四辩", timing: single(min(4)) }),
    stage({ id: "u-9", name: "正方四辩总结", side: "pro", speaker: "四辩", timing: single(min(4)) }),
  ],
};

// 注意：这套时长来自搜索摘要，原始 .doc（山科大研究生院）未能抓取成功，数字待现场复核。
const fourSpeakerShort: FlowTemplate = {
  id: "four-speaker-short",
  name: "四辩制（精简版，时长待复核）",
  builtin: true,
  stages: [
    stage({ id: "s-1", name: "正方一辩立论", side: "pro", speaker: "一辩", timing: single(min(3)) }),
    stage({ id: "s-2", name: "反方一辩立论", side: "con", speaker: "一辩", timing: single(min(3)) }),
    stage({ id: "s-3", name: "正方二辩驳立论", side: "pro", speaker: "二辩", timing: single(min(2)) }),
    stage({ id: "s-4", name: "反方二辩驳立论", side: "con", speaker: "二辩", timing: single(min(2)) }),
    // 单边计时：只计提问方，被盘问方不计
    stage({ id: "s-5", name: "质辩盘问（正方）", side: "pro", speaker: "三辩", timing: single(min(1, 30)) }),
    stage({ id: "s-6", name: "质辩盘问（反方）", side: "con", speaker: "三辩", timing: single(min(1, 30)) }),
    stage({ id: "s-7", name: "自由辩论", side: "neutral", timing: freeDebate(min(4), "pro") }),
    stage({ id: "s-8", name: "反方四辩总结", side: "con", speaker: "四辩", timing: single(min(3)) }),
    stage({ id: "s-9", name: "正方四辩总结", side: "pro", speaker: "四辩", timing: single(min(3)) }),
  ],
};

const threeSpeakerMiddle: FlowTemplate = {
  id: "three-speaker-middle",
  name: "三人制（中学）",
  builtin: true,
  stages: [
    stage({
      id: "m-1",
      name: "正方一辩立论",
      side: "pro",
      speaker: "一辩",
      timing: single(min(3)),
      prompts: cardPrompts(30),
    }),
    stage({
      id: "m-2",
      name: "反方一辩立论",
      side: "con",
      speaker: "一辩",
      timing: single(min(3)),
      prompts: cardPrompts(30),
    }),
    stage({ id: "m-3", name: "正方二辩驳论", side: "pro", speaker: "二辩", timing: single(min(1)) }),
    stage({ id: "m-4", name: "反方二辩驳论", side: "con", speaker: "二辩", timing: single(min(1)) }),
    // 攻辩四轮：攻方 1 分钟（45 秒黄牌＝剩 15 秒）、辩方 1 分 30（1:15 黄牌＝剩 15 秒）
    // 四轮的攻守归属各校不同，环节名可自行改
    stage({ id: "m-5", name: "攻辩（一）", side: "neutral", timing: querySplit(min(1), min(1, 30)), prompts: cardPrompts(15) }),
    stage({ id: "m-6", name: "攻辩（二）", side: "neutral", timing: querySplit(min(1), min(1, 30)), prompts: cardPrompts(15) }),
    stage({ id: "m-7", name: "攻辩（三）", side: "neutral", timing: querySplit(min(1), min(1, 30)), prompts: cardPrompts(15) }),
    stage({ id: "m-8", name: "攻辩（四）", side: "neutral", timing: querySplit(min(1), min(1, 30)), prompts: cardPrompts(15) }),
    stage({ id: "m-9", name: "正方攻辩小结", side: "pro", timing: single(min(1, 30)), prompts: cardPrompts(15) }),
    stage({ id: "m-10", name: "反方攻辩小结", side: "con", timing: single(min(1, 30)), prompts: cardPrompts(15) }),
    // 中学赛制多由反方先开始自由辩论
    stage({ id: "m-11", name: "自由辩论", side: "neutral", timing: freeDebate(min(5), "con") }),
    stage({ id: "m-12", name: "反方三辩总结", side: "con", speaker: "三辩", timing: single(min(3)), prompts: cardPrompts(30) }),
    stage({ id: "m-13", name: "正方三辩总结", side: "pro", speaker: "三辩", timing: single(min(3)), prompts: cardPrompts(30) }),
  ],
};

const oregon: FlowTemplate = {
  id: "oregon-544",
  name: "奥瑞冈制（五·四·四）",
  builtin: true,
  stages: [
    stage({ id: "o-1", name: "正方一辩申论", side: "pro", speaker: "一辩", timing: single(min(5)), prompts: oregonPrompts() }),
    stage({ id: "o-2", name: "反方二辩质询正方一辩", side: "con", speaker: "二辩", timing: single(min(4)), prompts: oregonPrompts() }),
    stage({ id: "o-3", name: "反方一辩申论", side: "con", speaker: "一辩", timing: single(min(5)), prompts: oregonPrompts() }),
    stage({ id: "o-4", name: "正方三辩质询反方一辩", side: "pro", speaker: "三辩", timing: single(min(4)), prompts: oregonPrompts() }),
    stage({ id: "o-5", name: "正方二辩申论", side: "pro", speaker: "二辩", timing: single(min(5)), prompts: oregonPrompts() }),
    stage({ id: "o-6", name: "反方三辩质询正方二辩", side: "con", speaker: "三辩", timing: single(min(4)), prompts: oregonPrompts() }),
    stage({ id: "o-7", name: "反方二辩申论", side: "con", speaker: "二辩", timing: single(min(5)), prompts: oregonPrompts() }),
    stage({ id: "o-8", name: "正方一辩质询反方二辩", side: "pro", speaker: "一辩", timing: single(min(4)), prompts: oregonPrompts() }),
    stage({ id: "o-9", name: "正方三辩申论", side: "pro", speaker: "三辩", timing: single(min(5)), prompts: oregonPrompts() }),
    stage({ id: "o-10", name: "反方一辩质询正方三辩", side: "con", speaker: "一辩", timing: single(min(4)), prompts: oregonPrompts() }),
    stage({ id: "o-11", name: "反方三辩申论", side: "con", speaker: "三辩", timing: single(min(5)), prompts: oregonPrompts() }),
    stage({ id: "o-12", name: "正方二辩质询反方三辩", side: "pro", speaker: "二辩", timing: single(min(4)), prompts: oregonPrompts() }),
    stage({ id: "o-13", name: "反方结辩", side: "con", timing: single(min(4)), prompts: oregonPrompts() }),
    stage({ id: "o-14", name: "正方结辩", side: "pro", timing: single(min(4)), prompts: oregonPrompts() }),
  ],
};

const blank: FlowTemplate = {
  id: "blank",
  name: "空白自定义",
  builtin: true,
  stages: [stage({ id: "b-1", name: "环节 1", side: "neutral", timing: single(min(3)) })],
};

export const PRESETS: FlowTemplate[] = [fourSpeakerUniv, singapore, threeSpeakerMiddle, oregon, fourSpeakerShort, blank];

export const DEFAULT_TEMPLATE_ID = fourSpeakerUniv.id;

export function findPreset(id: string): FlowTemplate | undefined {
  return PRESETS.find((p) => p.id === id);
}
