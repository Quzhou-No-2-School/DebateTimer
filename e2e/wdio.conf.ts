import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";

// 可执行文件名取自 Cargo package name（tauri-app），不是 productName（辩论计时器）。
const isWindows = process.platform === "win32";
const binary = `./src-tauri/target/debug/tauri-app${isWindows ? ".exe" : ""}`;

export const config: WebdriverIO.Config = {
  runner: "local",
  // WDIO 把 specs 相对 **配置文件所在目录** 解析（rootDir = dirname(config)），
  // 所以这里写 ./specs 而不是 ./e2e/specs。
  specs: ["./specs/**/*.e2e.ts"],
  maxInstances: 1,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: { ui: "bdd", timeout: 120_000 },

  // 全新 clone 上 src-tauri/target/debug/ 还不存在，先构建一次；
  // DBT_REBUILD_E2E=1 可强制重建（改了 Rust 侧或前端产物时用）。
  onPrepare: () => {
    if (!existsSync(binary) || process.env.DBT_REBUILD_E2E === "1") {
      const r = spawnSync("npm", ["run", "test:e2e:build"], { stdio: "inherit", shell: true });
      if (r.status !== 0) throw new Error("e2e 目标构建失败");
    }
  },

  // 失败时留现场：截图 + 页面 DOM。CI 的 upload-artifact 会把 e2e/artifacts/ 收走，
  // 线上挂了不用只靠日志猜。保存失败不能再抛错，否则会盖掉原始断言失败。
  afterTest: async (test, _context, { error }) => {
    if (!error) return;
    const dir = "./artifacts";
    const name = `${test.parent ?? "suite"}__${test.title}`.replace(/[^\w.-]+/g, "_").slice(0, 100);
    try {
      await mkdir(dir, { recursive: true });
      await browser.saveScreenshot(`${dir}/${name}.png`);
      await writeFile(`${dir}/${name}.html`, await browser.getPageSource(), "utf8");
    } catch (saveError) {
      console.warn(`失败现场保存失败：${(saveError as Error).message}`);
    }
  },

  // embedded provider：WebDriver server 跑在应用进程内，不需要外部 driver
  // （tauri-plugin-wdio-webdriver 已在 src-tauri 里按 debug_assertions 注册）。
  services: [["tauri", { appBinaryPath: binary, driverProvider: "embedded" }]],
  capabilities: [{ browserName: "tauri" }],
};
