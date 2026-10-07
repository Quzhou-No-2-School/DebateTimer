import { wake } from "../support/app.ts";

/**
 * 对应已验收的产品约束：全屏应用必须留显式退出入口 + 二次确认（memory: feedback_quit_entry）。
 *
 * 坑 4：弹窗打开后页面上有 **两个** 「退出」按钮（控制条一个、弹窗一个），
 * 所以选择器必须作用域到 dialog 内部。
 * 这里**只点取消**：点确认会关掉应用，后面的用例就没得跑了。
 */
describe("quit entry", () => {
  it("cancel keeps the app alive after the confirmation dialog", async () => {
    await wake();
    await $("button=退出").click();

    const dialog = $('[role="dialog"][aria-label="退出应用？"]');
    await expect(dialog).toBeDisplayed();
    await expect(dialog).toHaveText(expect.stringContaining("比赛进行中退出会中断计时"));

    await dialog.$("button=取消").click();
    await expect(dialog).not.toBeDisplayed();
    await expect($("main")).toBeDisplayed(); // 应用没被关掉
  });
});
