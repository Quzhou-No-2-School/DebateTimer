import { clearPersistedState, wake } from "../support/app.ts";

/**
 * 导出赛制：点击「导出当前流程」把 JSON 写进系统剪贴板并给出已复制反馈。
 *
 * 回归背景（v0.1.0 现场实测）：旧实现把完整 JSON 灌进 textarea，在学校
 * Windows 机器上确定性触发 WebView2 渲染进程崩溃（整窗错误页，重启才恢复）。
 * 导出已改为剪贴板写入（src/components/SettingsPanel.svelte doExport），
 * textarea 只留给导入粘贴——因此断言两件事：反馈出现 + textarea 保持为空。
 */
describe("export current flow", () => {
  after(async () => {
    await clearPersistedState();
    // 焦点留在设置面板按钮上，照 reset.e2e.ts 的惯例 reload 交还干净页面
    await browser.refresh();
    await expect($("main")).toBeDisplayed();
  });

  it("copies JSON to the clipboard and shows copied feedback", async () => {
    await wake();
    await $("button=赛制").click();
    const dialog = $('[role="dialog"][aria-label="赛制设置"]');
    await expect(dialog).toBeDisplayed();

    await dialog.$("button=导出当前流程").click();

    // 剪贴板写入成功 → 按钮文本瞬时变为「已复制」（3 秒后恢复）
    await expect(dialog.$("button=已复制")).toBeDisplayed();
    // 导出不再渲染 JSON 进 textarea（本次修复的回归探针）
    await expect(dialog.$("textarea")).toHaveValue("");
  });
});
