import { wake } from "../support/app.ts";

/**
 * The confirm branch of the quit flow.
 *
 * quit.e2e.ts only exercises cancel (closing the app would kill the session for
 * later specs in that file). This spec is the counterpart: confirming the dialog
 * must terminate the process. The embedded WebDriver server dies with the app,
 * so after clicking confirm every subsequent command must fail — that is the
 * success signal. It also guards against regressions of the window close
 * permission (a denied `core:window:allow-close` fails silently inside
 * `quit()`'s catch and the app would stay alive, i.e. a dead quit button).
 */
describe("quit confirmation", () => {
  it("confirming the dialog exits the application", async () => {
    await wake();
    await $("button=退出").click();

    const dialog = $('[role="dialog"][aria-label="退出确认"]');
    await expect(dialog).toBeDisplayed();

    try {
      await dialog.$("button=退出").click();
    } catch {
      // The app may exit before the WebDriver response arrives; the poll below decides.
    }

    const deadline = Date.now() + 20_000;
    let exited = false;
    while (Date.now() < deadline) {
      try {
        await browser.getTitle();
        await browser.pause(250);
      } catch {
        exited = true;
        break;
      }
    }

    expect(exited).toBe(true);
  });
});
