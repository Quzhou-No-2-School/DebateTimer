import { clockText, resetToFirstStage } from "../support/app.ts";

describe("timer core", () => {
  beforeEach(async () => {
    await resetToFirstStage();
  });

  it("space starts the timer: button switches to pause", async () => {
    // 先确认焦点不在按钮上——否则空格会被浏览器当成"激活该按钮"，
    // 就分不清是快捷键生效还是隐式点击了。焦点在 body 时，唯一能让计时器
    // 动起来的路径就是 <svelte:window onkeydown>，这同时证明了按键确实到达了 webview。
    expect(await browser.execute(() => document.activeElement?.tagName)).not.toBe("BUTTON");

    await browser.keys(["Space"]);
    await expect($("button=暂停")).toBeDisplayed();
  });

  it("second space pauses: button switches back to start", async () => {
    await browser.keys(["Space"]);
    await expect($("button=暂停")).toBeDisplayed();

    await browser.keys(["Space"]);
    await expect($("button=开始")).toBeDisplayed();
  });

  it("enter advances to the next stage: clock text changes", async () => {
    // 先跑 1.5 秒，让显示值离开本环节满值——formatClock 是 ceil（src/core/format.ts:4），
    // 刚进环节时按了 Enter 再读，两个环节都是 3:00，会读不出差别。
    await browser.keys(["Space"]);
    await browser.pause(1500);
    const before = await clockText();

    await browser.keys(["Enter"]);
    await browser.pause(300);
    const after = await clockText();

    expect(after).not.toBe(before);
    // 新环节是 idle 态
    await expect($("button=开始")).toBeDisplayed();
  });
});
