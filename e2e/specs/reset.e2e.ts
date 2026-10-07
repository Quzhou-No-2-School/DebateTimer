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
    await browser.keys(["t"]);
    const input = $("input");
    await input.waitForDisplayed();
    await input.click();
    await input.clearValue();
    await input.addValue("e2e-topic");
    await browser.keys(["Enter"]); // 输入框吞掉 Enter 并提交
    await expect($("input")).not.toExist();

    const fresh = await clockText(); // 第一环节满值

    await browser.keys(["Enter"]);
    await browser.pause(300);
    await browser.keys(["Space"]);
    await browser.pause(1500);

    await wake();
    await $("button=重置").click();
    const dialog = $('[role="dialog"][aria-label="重置全流程？"]');
    await expect(dialog).toBeDisplayed();
    await dialog.$("button=确认重置").click();

    await browser.pause(300);
    await expect(dialog).not.toBeDisplayed();
    // 回到第一环节：满值 + idle
    await expect($("button=开始")).toBeDisplayed();
    // 满值比较对"清零但留在第 2 环节"类回归无分辨力（两环节同为 3:00），由下方持久化断言兜底
    expect(await clockText()).toBe(fresh);
    // stageIndex 已持久化回 0（PersistedState.match.stageIndex，见 src/core/storage.ts）
    const idx = await browser.execute(() => {
      const raw = localStorage.getItem("debatetimer:v1");
      return raw ? (JSON.parse(raw) as { match: { stageIndex: number } }).match.stageIndex : -1;
    });
    expect(idx).toBe(0);
    // 辩题在重置后保留（计划承诺：只清流程与计时，不清 match 配置）
    await expect($("header button")).toHaveText("e2e-topic");
  });

  it("hotkeys are blocked while the reset dialog is open", async () => {
    await wake();
    await $("button=重置").click();
    const dialog = $('[role="dialog"][aria-label="重置全流程？"]');
    await expect(dialog).toBeDisplayed();

    await browser.keys(["Space"]); // 守卫若失效 → toggle → 计时器启动
    await browser.pause(300);

    await expect(dialog).toBeDisplayed();
    await expect($("button=开始")).toBeDisplayed(); // 与模板时长无关的探针

    // Esc 走 close 链关闭重置弹窗（+page.svelte close 链的 resetOpen 分支）
    await browser.keys(["Escape"]);
    await browser.pause(200);
    await expect(dialog).not.toBeDisplayed();
  });
});
