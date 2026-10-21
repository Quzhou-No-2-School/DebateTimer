/**
 * e2e 公共操作。
 *
 * 坑 1：控制条现在常驻（不再 3 秒后淡出），但 wake() 仍要保留：
 * 首次鼠标 / 按键交互才会解锁 AudioContext，否则现场第一声铃是静音的。
 * wake() 绑在 <svelte:window> 的 mousemove / pointerdown 上，所以交互前先把鼠标移到页面上。
 */

/** 唤回自动淡出的控制条（顺带解锁 AudioContext，和现场操作路径一致） */
export async function wake(): Promise<void> {
  await $("main").moveTo();
}

/**
 * 回到第一个环节，并把计时器带回 idle。
 *
 * stageIndex 会持久化进 localStorage（src/core/storage.ts），上一轮跑完可能停在任意环节，
 * 先按键 "1"（gotoStage → loadStage）把起点归一化，断言才不依赖历史状态。
 */
export async function resetToFirstStage(): Promise<void> {
  await wake();
  await browser.keys(["1"]);
  await browser.pause(200);
}

/** 当前计时器显示的文本（mm:ss 或 +mm:ss） */
export function clockText(): Promise<string> {
  return $(".tnum").getText();
}

/** 清掉本轮写进 localStorage 的状态，下一次启动回到默认值 */
export async function clearPersistedState(): Promise<void> {
  await browser.execute(() => localStorage.removeItem("debatetimer:v1"));
}
