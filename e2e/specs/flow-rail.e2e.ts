import { clearPersistedState, wake } from "../support/app.ts";

/**
 * 左侧赛制流程栏：只读展示全流程与当前环节。
 * 默认赛制是三人制（中学），清掉持久状态后应为 7 个环节。
 */
describe("flow rail", () => {
  before(async () => {
    await clearPersistedState();
    await browser.refresh();
    await expect($("main")).toBeDisplayed();
  });

  after(async () => {
    await clearPersistedState();
    await browser.refresh();
    await expect($("main")).toBeDisplayed();
  });

  it("lists the full default flow and marks the current stage", async () => {
    const rail = $('[data-testid="flow-rail"]');
    await expect(rail).toBeDisplayed();

    const items = $$('[data-testid="flow-rail-item"]');
    expect(items.length).toBe(7);

    expect(await items[0].getAttribute("aria-current")).toBe("step");
    expect(await items[1].getAttribute("aria-current")).toBeNull();

    // 自由辩论按“每方”显示，不能被误读成总时长 12:00
    const freeDebate = await items[4].getText();
    expect(freeDebate).toContain("自由辩论");
    expect(freeDebate).toContain("06:00/方");
  });

  it("follows stage jumps", async () => {
    await wake();
    await browser.keys(["3"]);
    await browser.pause(200);

    const items = $$('[data-testid="flow-rail-item"]');
    expect(await items[2].getAttribute("aria-current")).toBe("step");
    expect(await items[0].getAttribute("aria-current")).toBeNull();
    // 已过环节在序号列显示 ✓
    expect(await items[0].getText()).toContain("✓");
  });

  it("control bar stays visible while idle", async () => {
    await wake();
    await browser.pause(3500);

    const opacity = await $('[data-testid="control-bar"]').getCSSProperty("opacity");
    expect(opacity.value).toBe("1");
  });
});
