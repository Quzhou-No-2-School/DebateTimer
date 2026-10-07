import { wake } from "../support/app.ts";

/**
 * The confirm branch of the quit flow.
 *
 * quit.e2e.ts only exercises cancel (it must keep the app alive for later
 * specs). This spec is the counterpart: confirming the dialog must reach
 * the window close command, which is ACL-guarded — a missing
 * core:window:allow-close permission fails silently inside quit()'s catch
 * and leaves a dead quit button.
 *
 * We do NOT let the app actually exit: the embedded WebDriver server dies
 * with the process, WDIO's deleteSession then fails with ECONNREFUSED and
 * the spec is marked failed even when everything worked (observed on all
 * three platforms in run 36872346060). Instead we install an
 * onCloseRequested listener that flags the request and preventDefault()s
 * it. The close-requested event can only arrive when the close IPC command
 * passed the ACL, which is exactly the behavior under test — while the
 * process stays alive and teardown stays clean.
 *
 * Side effect to clean up: the embedded provider reuses one app instance
 * across sessions, and quit() has already stopped the RAF loop by the time
 * we prevent the close (run 36874548218: the following timing spec then saw
 * a frozen clock). Reload the page so the next session starts hydrated.
 */
describe("quit confirmation", () => {
  it("confirming the dialog requests the window close", async () => {
    await wake();

    await browser.execute(() => {
      const w = window as unknown as {
        __closeRequested?: boolean;
        __TAURI__: {
          window: {
            getCurrentWindow: () => {
              onCloseRequested: (cb: (e: { preventDefault: () => void }) => void) => void;
            };
          };
        };
      };
      w.__closeRequested = false;
      w.__TAURI__.window.getCurrentWindow().onCloseRequested((e) => {
        w.__closeRequested = true;
        e.preventDefault();
      });
    });

    await $("button=退出").click();
    const dialog = $('[role="dialog"][aria-label="退出应用？"]');
    await expect(dialog).toBeDisplayed();
    await dialog.$("button=退出").click();

    // quit() runs: quitOpen=false, stopLoop, save, close() -> CloseRequested
    await browser.waitUntil(
      () =>
        browser.execute(
          () => (window as unknown as { __closeRequested?: boolean }).__closeRequested === true,
        ),
      {
        timeout: 10_000,
        timeoutMsg:
          "window close was never requested — close() denied by ACL or confirm path broken",
      },
    );

    // Hand a healthy app back to the next session: undo quit()'s stopLoop
    // by reloading (onMount restarts the loop and restores idle state).
    await browser.refresh();
    await expect($("main")).toBeDisplayed();
  });
});
