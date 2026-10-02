import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_ID, PRESETS, findPreset } from "./presets";
import { exportTemplate, importTemplate } from "./storage";
import { stageTotalSec } from "./models";

describe("内置赛制", () => {
  it("每套模板都有环节，且每个环节时长为正", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
    for (const t of PRESETS) {
      expect(t.stages.length).toBeGreaterThan(0);
      for (const s of t.stages) {
        expect(stageTotalSec(s)).toBeGreaterThan(0);
      }
    }
  });

  it("默认模板存在", () => {
    expect(findPreset(DEFAULT_TEMPLATE_ID)).toBeDefined();
  });

  it("奥瑞冈每个环节都有三级铃（一声 / 两声 / 三声）", () => {
    const oregon = PRESETS.find((p) => p.id === "oregon-544")!;
    for (const s of oregon.stages) {
      expect(s.prompts.map((p) => p.repeat ?? 1)).toEqual([1, 2, 3]);
    }
  });

  it("提示点按剩余秒数递减排列（先报 30 秒，再报到点）", () => {
    for (const t of PRESETS) {
      for (const s of t.stages) {
        const secs = s.prompts.map((p) => p.atRemainingSec);
        expect([...secs].sort((a, b) => b - a)).toEqual(secs);
      }
    }
  });
});

describe("模板导入导出", () => {
  it("导出后再导入得到等价模板", () => {
    const json = exportTemplate(PRESETS[0]);
    const back = importTemplate(json);
    expect(back.name).toBe(PRESETS[0].name);
    expect(back.stages.length).toBe(PRESETS[0].stages.length);
  });

  it("非法 JSON 抛出可读错误", () => {
    expect(() => importTemplate('{"name":"x"}')).toThrow("模板文件格式不正确");
    expect(() => importTemplate("不是 JSON")).toThrow();
  });
});
