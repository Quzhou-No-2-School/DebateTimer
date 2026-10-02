import { describe, expect, it } from "vitest";
import { authoritativeDelta, systemTimeSource } from "./clock";

describe("authoritativeDelta", () => {
  it("正常情况下以墙钟推进为准", () => {
    expect(authoritativeDelta(1000, 1000)).toBe(1000);
  });

  it("休眠后墙钟照常推进、单调时钟停滞 → 仍按墙钟计（真实流逝时间）", () => {
    // perf 在休眠期间不推进（CLOCK_MONOTONIC 不计休眠），wall 推进了 60s
    expect(authoritativeDelta(0, 60_000)).toBe(60_000);
  });

  it("墙钟回拨时退回单调时钟，避免计时凭空变慢", () => {
    expect(authoritativeDelta(1000, -5_000)).toBe(1000);
  });
});

describe("systemTimeSource", () => {
  it("perf 与 wall 都返回递增的毫秒数", () => {
    const t = systemTimeSource();
    expect(t.perf()).toBeGreaterThan(0);
    expect(t.wall()).toBeGreaterThan(1_600_000_000_000);
  });
});
