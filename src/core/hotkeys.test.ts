import { describe, expect, it } from "vitest";
import {
  ADJUST_STEP_LARGE_MS,
  ADJUST_STEP_MS,
  gateHotkey,
  isEditableTarget,
  resolveHotkey,
} from "./hotkeys";
import type { HotkeyAction, KeyLike, OverlayState } from "./hotkeys";

function key(k: string, extra: Partial<KeyLike> = {}): KeyLike {
  return { key: k, ...extra };
}

const INPUT = { tagName: "input" } as unknown as EventTarget;

describe("isEditableTarget", () => {
  it("识别输入框、文本域与 contenteditable", () => {
    expect(isEditableTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "textarea" } as unknown as EventTarget)).toBe(true);
    expect(
      isEditableTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
  });

  it("普通元素不算可编辑", () => {
    expect(isEditableTarget({ tagName: "DIV" } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("resolveHotkey", () => {
  it("空格 = 开始/暂停", () => {
    expect(resolveHotkey(key(" "))).toEqual({ type: "toggle" });
  });

  it("输入框里按空格不触发快捷键（现场最容易误触）", () => {
    expect(resolveHotkey(key(" ", { target: INPUT }))).toBeNull();
  });

  it("输入框里按 Esc 仍然生效（取消编辑）", () => {
    expect(resolveHotkey(key("Escape", { target: INPUT }))).toEqual({ type: "close" });
  });

  it("回车与方向键切换环节", () => {
    expect(resolveHotkey(key("Enter"))).toEqual({ type: "nextStage" });
    expect(resolveHotkey(key("ArrowRight"))).toEqual({ type: "nextStage" });
    expect(resolveHotkey(key("ArrowLeft"))).toEqual({ type: "prevStage" });
    expect(resolveHotkey(key("Backspace"))).toEqual({ type: "prevStage" });
  });

  it("Tab 切换发言方", () => {
    expect(resolveHotkey(key("Tab"))).toEqual({ type: "switchSide" });
  });

  it("R 键已不再映射重置（重置改为按钮操作，无快捷键）", () => {
    expect(resolveHotkey(key("r"))).toBeNull();
    expect(resolveHotkey(key("R"))).toBeNull();
  });

  it("加减号调整时长，Shift 为大步长", () => {
    expect(resolveHotkey(key("+"))).toEqual({ type: "adjust", deltaMs: ADJUST_STEP_MS });
    expect(resolveHotkey(key("-"))).toEqual({ type: "adjust", deltaMs: -ADJUST_STEP_MS });
    expect(resolveHotkey(key("+", { shiftKey: true }))).toEqual({
      type: "adjust",
      deltaMs: ADJUST_STEP_LARGE_MS,
    });
  });

  it("数字键跳到第 N 个环节", () => {
    expect(resolveHotkey(key("3"))).toEqual({ type: "gotoStage", index: 2 });
  });

  it("带 Ctrl / Cmd 的组合键交给系统", () => {
    expect(resolveHotkey(key(" ", { ctrlKey: true }))).toBeNull();
    expect(resolveHotkey(key("r", { metaKey: true }))).toBeNull();
  });

  it("未映射的键返回 null", () => {
    expect(resolveHotkey(key("q"))).toBeNull();
  });
});

describe("gateHotkey", () => {
  const none: OverlayState = {
    quitOpen: false,
    resetOpen: false,
    helpOpen: false,
    settingsOpen: false,
  };
  const toggle: HotkeyAction = { type: "toggle" };
  const help: HotkeyAction = { type: "help" };
  const close: HotkeyAction = { type: "close" };

  it("没有浮层时全部放行", () => {
    expect(gateHotkey(toggle, none)).toBe(true);
    expect(gateHotkey(help, none)).toBe(true);
  });

  it("任一浮层打开时只放行 Esc", () => {
    for (const k of ["quitOpen", "resetOpen", "settingsOpen", "helpOpen"] as const) {
      const s = { ...none, [k]: true };
      expect(gateHotkey(toggle, s)).toBe(false);
      expect(gateHotkey({ type: "nextStage" }, s)).toBe(false);
      expect(gateHotkey(close, s)).toBe(true);
    }
  });

  it("帮助单独打开时放行 H，用来关闭帮助", () => {
    expect(gateHotkey(help, { ...none, helpOpen: true })).toBe(true);
  });

  it("其他弹窗打开时 H 不放行（不能在确认弹窗下面开关帮助）", () => {
    expect(gateHotkey(help, { ...none, resetOpen: true })).toBe(false);
    expect(gateHotkey(help, { ...none, helpOpen: true, quitOpen: true })).toBe(false);
    expect(gateHotkey(help, { ...none, settingsOpen: true })).toBe(false);
  });
});
