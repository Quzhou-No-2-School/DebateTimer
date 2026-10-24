// 背景清单由 vite.config.js 的 backgroundsManifest 插件在构建/开发时生成
declare module "virtual:backgrounds" {
  import type { BackgroundOption } from "./core/models";

  export const BACKGROUNDS: BackgroundOption[];
}
