import { clockText, clearPersistedState, resetToFirstStage, wake } from "../support/app.ts";

/**
 * 重置全流程：弹窗确认后回到第一环节并清零计时（辩题/队名保留）。
 * 取消不得产生任何副作用；确认后 stageIndex 需持久化回 0。
 */
describe("full-flow reset", () => {
  beforeEach(async () => {
    await resetToFirstStage();
  });

  after(async () => {
    await clearPersistedState();
  });

  it("cancel keeps the running timer untouched", async () => {
    await browser.keys(["Enter"]); // 到第二环节
    await browser.pause(300);
    await browser.keys(["Space"]); // 开始计时
    await expect($("button=暂停")).toBeDisplayed();

    await wake();
    await $("button=重置").click();
    const dialog = $('[role="dialog"][aria-label="重置全流程？"]');
    await expect(dialog).toBeDisplayed();

    await dialog.$("button=取消").click();
    await browser.pause(300);
    await expect(dialog).not.toBeDisplayed();
    // 未被重置：计时器仍处于运行态（重置会强制回 idle）
    await expect($("button=暂停")).toBeDisplayed();
  });

  it("confirming returns to stage 1 with a cleared, persisted state", async () => {
    const fresh = await clockText(); // 第一环节满值

    await browser.keys(["Enter"]);
    await browser.pause(300);
    await browser.keys(["Space"]);
    await browser.pause(1500);

    await wake();
    await $("button=重置").click();
    const dialog = $('[role="dialog"][aria-label="重置全流程？"]');
    await dialog.$("button=确认重置").click();

    await browser.pause(300);
    await expect(dialog).not.toBeDisplayed();
    // 回到第一环节：满值 + idle
    await expect($("button=开始")).toBeDisplayed();
    expect(await clockText()).toBe(fresh);
    // stageIndex 已持久化回 0（PersistedState.match.stageIndex，见 src/core/storage.ts）
    const idx = await browser.execute(() => {
      const raw = localStorage.getItem("debatetimer:v1");
      return raw ? (JSON.parse(raw) as { match: { stageIndex: number } }).match.stageIndex : -1;
    });
    expect(idx).toBe(0);
  });

  it("hotkeys are blocked while the reset dialog is open", async () => {
    // 打开重置弹窗后按 Enter：守卫（+page.svelte:70-76）应拦截"下一环节"
    await wake();
    await $("button=重置").click();
    const dialog = $('[role="dialog"][aria-label="重置全流程？"]');
    await expect(dialog).toBeDisplayed();

    const clockBefore = await clockText();
    await browser.keys(["Enter"]);
    await browser.pause(300);

    // 弹窗仍在、环节未切换（计时满值不变 = 还在第一环节）
    await expect(dialog).toBeDisplayed();
    expect(await clockText()).toBe(clockBefore);
  });
});
