import { describe, expect, it } from "vitest";
import { ADJUST_STEP_LARGE_MS, ADJUST_STEP_MS, isEditableTarget, resolveHotkey } from "./hotkeys";
import type { KeyLike } from "./hotkeys";

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
