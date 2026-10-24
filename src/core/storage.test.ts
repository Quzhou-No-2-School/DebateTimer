import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "./models";
import { defaultState, loadState, saveState } from "./storage";

/** 极简 localStorage 桩：仅存一个键 */
function stubStorage() {
  let data: Record<string, string> = {};
  const store = {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => (data[k] = v),
    removeItem: (k: string) => delete data[k],
    clear: () => (data = {}),
  };
  vi.stubGlobal("localStorage", store);
  return store;
}

describe("偏好持久化", () => {
  beforeEach(() => {
    stubStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("无数据时返回默认偏好（含背景字段）", () => {
    expect(loadState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES.background).toBe("off");
    expect(DEFAULT_PREFERENCES.backgroundOpacity).toBe(0.3);
  });

  it("旧版数据缺背景字段时自动补默认值", () => {
    localStorage.setItem(
      "debatetimer:v1",
      JSON.stringify({
        match: defaultState().match,
        customTemplates: [],
        preferences: { volume: 0.5, soundEnabled: false, promptsEnabled: false },
      }),
    );
    const prefs = loadState().preferences;
    expect(prefs.volume).toBe(0.5);
    expect(prefs.soundEnabled).toBe(false);
    expect(prefs.background).toBe("off");
    expect(prefs.backgroundOpacity).toBe(0.3);
  });

  it("保存后再读取得到等价偏好", () => {
    const state = defaultState();
    state.preferences.background = "背景一.jpg";
    state.preferences.backgroundOpacity = 0.6;
    saveState(state);
    expect(loadState().preferences).toEqual(state.preferences);
  });
});
