import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

/**
 * 扫描 static/backgrounds/ 下所有 jpg/png，生成虚拟模块 `virtual:backgrounds`
 * （导出 BACKGROUNDS: { id, name, src }[]，id 为含扩展名的文件名）。
 * 开发者往目录里放图片文件即可在设置面板选择，无需改代码；
 * 打包版需重新构建才会包含新增图片。
 *
 * @returns {import("vite").Plugin}
 */
function backgroundsManifest() {
  const VIRTUAL_ID = "virtual:backgrounds";
  const RESOLVED_ID = `\0${VIRTUAL_ID}`;
  let root = process.cwd();
  return {
    name: "backgrounds-manifest",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const dir = resolve(root, "static/backgrounds");
      const files = existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => /\.(jpe?g|png)$/i.test(f))
            .sort()
        : [];
      const backgrounds = files.map((file) => ({
        id: file,
        name: file.replace(/\.(jpe?g|png)$/i, ""),
        src: `/backgrounds/${encodeURIComponent(file)}`,
      }));
      return `export const BACKGROUNDS = ${JSON.stringify(backgrounds)};`;
    },
    // dev 下目录内增删图片时让虚拟模块失效并整页刷新。
    // 注意不能用 addWatchFile(目录)：dev 的 import-analysis 会把 watch
    // 文件当 import 解析，目录解析不了会直接报错。
    configureServer(server) {
      const dir = resolve(root, "static/backgrounds");
      /** @param {string} file */
      const invalidate = (file) => {
        if (dirname(file) !== dir) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: "full-reload" });
        }
      };
      server.watcher.on("add", invalidate);
      server.watcher.on("unlink", invalidate);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      // SPA mode for Tauri (no Node server): see src/routes/+layout.ts header.
      // index.html is safe here because nothing is prerendered (ssr = false).
      adapter: adapter({ fallback: "index.html" }),
    }),
    tailwindcss(),
    backgroundsManifest(),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
