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
  | { type: "switchSide" }
  | { type: "adjust"; deltaMs: number }
  | { type: "editTopic" }
  | { type: "fullscreen" }
  | { type: "help" }
  | { type: "close" }
  | { type: "gotoStage"; index: number };

/** 当前打开的浮层；有任一浮层时全局快捷键需要先过 gateHotkey */
export interface OverlayState {
  quitOpen: boolean;
  resetOpen: boolean;
  helpOpen: boolean;
  settingsOpen: boolean;
}

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

/**
 * 浮层打开期间的快捷键闸门：返回 false 表示吞掉这个动作。
 *
 * 有浮层时只放行 Esc（走 close 链）；唯一例外是帮助单独打开时放行 H，
 * 保证帮助里写的「H 显示 / 隐藏本帮助」成立。
 */
export function gateHotkey(action: HotkeyAction, s: OverlayState): boolean {
  const modal = s.quitOpen || s.resetOpen || s.settingsOpen;
  if (!modal && !s.helpOpen) return true;
  if (action.type === "close") return true;
  return action.type === "help" && s.helpOpen && !modal;
}
