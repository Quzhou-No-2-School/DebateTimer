import { clearPersistedState, wake } from "../support/app.ts";

/**
 * 背景偏好：设置面板里选择内置背景并持久化（localStorage，见 src/core/storage.ts）。
 * 默认「无背景」；「无背景」按钮文本刻意避开面板 header 的「关闭」，e2e 探针不撞车。
 */
describe("background preference", () => {
  beforeEach(async () => {
    await clearPersistedState();
    await browser.refresh();
    await expect($("main")).toBeDisplayed();
  });

  after(async () => {
    await clearPersistedState();
    await browser.refresh();
    await expect($("main")).toBeDisplayed();
  });

  async function openSettings() {
    await wake();
    await $("button=赛制").click();
    const dialog = $('[role="dialog"][aria-label="赛制设置"]');
    await expect(dialog).toBeDisplayed();
    return dialog;
  }

  async function persistedBackground(): Promise<string> {
    return browser.execute(() => {
      const raw = localStorage.getItem("debatetimer:v1");
      return raw
        ? (JSON.parse(raw) as { preferences: { background: string } }).preferences.background
        : "";
    });
  }

  it("selected background persists across reload", async () => {
    const dialog = await openSettings();
    await dialog.$("button=背景一").click();
    expect(await persistedBackground()).toBe("bg-1");

    await dialog.$("button=关闭").click();
    await browser.refresh();
    const reopened = await openSettings();
    expect(await reopened.$("button=背景一").getAttribute("class")).toContain("border-accent");
    expect(await reopened.$("button=无背景").getAttribute("class")).not.toContain("border-accent");
  });

  it("defaults to no background and switching back persists", async () => {
    expect(await persistedBackground()).toBe("");

    const dialog = await openSettings();
    await dialog.$("button=背景二").click();
    expect(await persistedBackground()).toBe("bg-2");
    await dialog.$("button=无背景").click();
    expect(await persistedBackground()).toBe("off");

    await dialog.$("button=关闭").click();
    await browser.refresh();
    const reopened = await openSettings();
    expect(await reopened.$("button=无背景").getAttribute("class")).toContain("border-accent");
  });
});
