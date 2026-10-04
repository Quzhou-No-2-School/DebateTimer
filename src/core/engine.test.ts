import { describe, expect, it } from "vitest";
import { TimerEngine } from "./engine";
import type { Stage } from "./models";

function fakeTime() {
  let perf = 1_000;
  let wall = 1_700_000_000_000;
  return {
    perf: () => perf,
    wall: () => wall,
    /** 正常推进：perf 与 wall 同步前进 */
    advance(ms: number) {
      perf += ms;
      wall += ms;
    },
    /** 系统休眠：wall 照常走，perf 停滞 */
    sleep(ms: number) {
      wall += ms;
    },
    /** 时钟回拨：wall 往回跳 */
    rewind(ms: number) {
      wall -= ms;
    },
  };
}

function singleStage(over: Partial<Stage> = {}): Stage {
  return {
    id: "s1",
    name: "正方一辩立论",
    side: "pro",
    timing: { kind: "single", limitSec: 180 },
    prompts: [],
    overtime: "stop",
    ...over,
  };
}

describe("TimerEngine 单边倒计时", () => {
  it("开始后推进 1 秒，剩余减少 1 秒", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage(singleStage());

    e.start();
    t.advance(1000);
    e.tick();

    expect(e.snapshot().remainMs).toBe(179_000);
    expect(e.currentStatus).toBe("running");
  });

  it("暂停期间时间不流逝，恢复后接着走（不丢时也不多走）", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage(singleStage());

    e.start();
    t.advance(1000);
    e.tick();
    e.pause();
    t.advance(10_000);
    e.tick();
    e.resume();
    t.advance(1000);
    e.tick();

    expect(e.snapshot().remainMs).toBe(178_000);
  });
});

describe("TimerEngine 提示点", () => {
  it("剩 30 秒触发一次，之后不再重复触发", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage(singleStage({ prompts: [{ atRemainingSec: 30, label: "还剩 30 秒" }] }));

    const fired: number[] = [];
    e.onPrompt(({ rule }) => fired.push(rule.atRemainingSec));

    e.start();
    t.advance(150_000); // 剩 30 秒
    e.tick();
    t.advance(1000);
    e.tick();

    expect(fired).toEqual([30]);
  });

  it("休眠跨越多个提示点时，醒来一次性补触发且顺序正确", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage(
      singleStage({
        prompts: [
          { atRemainingSec: 30, label: "还剩 30 秒" },
          { atRemainingSec: 0, label: "时间到" },
        ],
      }),
    );

    const fired: number[] = [];
    e.onPrompt(({ rule }) => fired.push(rule.atRemainingSec));

    e.start();
    t.sleep(200_000); // 电脑睡了 200 秒，perf 停滞、wall 照走
    e.tick();

    expect(fired).toEqual([30, 0]);
    expect(e.currentStatus).toBe("finished");
  });
});

describe("TimerEngine 到点与超时", () => {
  it("到点后状态为 finished；overtime=count 时继续累计超时", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage(singleStage({ timing: { kind: "single", limitSec: 60 }, overtime: "count" }));

    e.start();
    t.advance(60_000);
    e.tick();
    expect(e.currentStatus).toBe("finished");
    expect(e.snapshot().remainMs).toBe(0);

    t.advance(5000);
    e.tick();
    expect(e.snapshot().overtimeMs).toBe(5000);
  });

  it("overtime=stop 时不累计超时", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage(singleStage({ timing: { kind: "single", limitSec: 60 }, overtime: "stop" }));

    e.start();
    t.advance(60_000);
    e.tick();
    t.advance(5000);
    e.tick();

    expect(e.snapshot().overtimeMs).toBe(0);
  });
});

describe("TimerEngine 加时", () => {
  it("加 10 秒后剩余时间增加，未触发的提示点按新截止时间重算", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage(singleStage({ prompts: [{ atRemainingSec: 30, label: "还剩 30 秒" }] }));

    const fired: number[] = [];
    e.onPrompt(({ rule }) => fired.push(rule.atRemainingSec));

    e.start();
    t.advance(149_000); // 剩 31 秒（还没到提示点）
    e.tick();
    e.adjust(10_000); // 加时 10 秒 → 剩 41 秒
    t.advance(1000);
    e.tick();

    expect(e.snapshot().remainMs).toBe(40_000);
    expect(fired).toEqual([]); // 提示点顺延，没有提前误报

    t.advance(10_000); // 剩 30 秒
    e.tick();
    expect(fired).toEqual([30]);
  });
});

describe("TimerEngine 双边与分桶计时", () => {
  it("alternating：正反方两块表独立，切换只影响当前方", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage({
      id: "free",
      name: "自由辩论",
      side: "neutral",
      timing: { kind: "alternating", perSideSec: 240, firstSide: "pro" },
      prompts: [],
      overtime: "stop",
    });

    e.start();
    t.advance(1000);
    e.tick();

    const pro = e.snapshot().slots.find((s) => s.id === "pro")!;
    const con = e.snapshot().slots.find((s) => s.id === "con")!;
    expect(pro.remainMs).toBe(239_000);
    expect(con.remainMs).toBe(240_000);

    e.nextSlot(); // Tab 切到反方
    t.advance(1000);
    e.tick();

    expect(e.snapshot().slots.find((s) => s.id === "con")!.remainMs).toBe(239_000);
    expect(e.snapshot().slots.find((s) => s.id === "pro")!.remainMs).toBe(239_000); // 正方冻结
  });

  it("split：盘问的提问桶与回答桶分别计时", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage({
      id: "query",
      name: "盘问",
      side: "neutral",
      timing: {
        kind: "split",
        buckets: [
          { id: "ask", label: "提问", limitSec: 60 },
          { id: "answer", label: "回答", limitSec: 180 },
        ],
      },
      prompts: [],
      overtime: "stop",
    });

    e.start();
    t.advance(1000);
    e.tick();
    expect(e.snapshot().slots.find((s) => s.id === "ask")!.remainMs).toBe(59_000);

    e.setActiveSlot("answer");
    t.advance(1000);
    e.tick();

    expect(e.snapshot().slots.find((s) => s.id === "answer")!.remainMs).toBe(179_000);
    expect(e.snapshot().slots.find((s) => s.id === "ask")!.remainMs).toBe(59_000);
  });
});

describe("TimerEngine 时钟回拨", () => {
  it("系统时间往回跳时计时不凭空变快", () => {
    const t = fakeTime();
    const e = new TimerEngine(t);
    e.loadStage(singleStage());

    e.start();
    t.advance(1000);
    e.tick();
    const before = e.snapshot().remainMs;

    t.rewind(5000); // 有人把系统时间往前调了 5 秒
    e.tick();

    expect(e.snapshot().remainMs).toBe(before);
  });
});
