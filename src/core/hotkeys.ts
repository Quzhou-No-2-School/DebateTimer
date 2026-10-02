/**
 * 快捷键解析。
 *
 * 现场最容易踩的坑：改辩题 / 改时长时，输入框里的空格、回车、字母会被当成快捷键，
 * 导致计时器被误启停。所以 **只要焦点在可编辑元素里，单键快捷键一律屏蔽**（Esc 例外）。
 */

export type HotkeyAction =
  | { type: "toggle" }
  | { type: "nextStage" }
  | { type: "prevStage" }
  | { type: "reset" }
  | { type: "switchSide" }
  | { type: "adjust"; deltaMs: number }
  | { type: "editTopic" }
  | { type: "fullscreen" }
  | { type: "help" }
  | { type: "close" }
  | { type: "gotoStage"; index: number };

export const ADJUST_STEP_MS = 10_000;
export const ADJUST_STEP_LARGE_MS = 60_000;

/** 只需 KeyboardEvent 的这些字段，便于在 node 环境里单测 */
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable === true;
}

/** 返回 null 表示"不处理"，交给浏览器/输入框默认行为 */
export function resolveHotkey(e: KeyLike): HotkeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  const editable = isEditableTarget(e.target ?? null);
  // 输入态只放行 Esc（取消编辑 / 失焦）
  if (editable && e.key !== "Escape") return null;

  switch (e.key) {
    case " ":
      return { type: "toggle" };
    case "Enter":
    case "ArrowRight":
      return { type: "nextStage" };
    case "ArrowLeft":
    case "Backspace":
      return { type: "prevStage" };
    case "r":
    case "R":
      return { type: "reset" };
    case "Tab":
      return { type: "switchSide" };
    case "+":
    case "=":
      return { type: "adjust", deltaMs: e.shiftKey ? ADJUST_STEP_LARGE_MS : ADJUST_STEP_MS };
    case "-":
    case "_":
      return { type: "adjust", deltaMs: e.shiftKey ? -ADJUST_STEP_LARGE_MS : -ADJUST_STEP_MS };
    case "t":
    case "T":
      return { type: "editTopic" };
    case "F11":
    case "f":
    case "F":
      return { type: "fullscreen" };
    case "h":
    case "H":
    case "?":
      return { type: "help" };
    case "Escape":
      return { type: "close" };
    default:
      break;
  }

  if (/^[1-9]$/.test(e.key)) {
    return { type: "gotoStage", index: Number(e.key) - 1 };
  }

  return null;
}
