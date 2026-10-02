import type { FlowTemplate, MatchState, Preferences, Stage } from "./models";
import { DEFAULT_MATCH, DEFAULT_PREFERENCES } from "./models";
import { DEFAULT_TEMPLATE_ID } from "./presets";

const STORAGE_KEY = "debatetimer:v1";

export interface PersistedState {
  match: MatchState;
  /** 用户自定义（或从内置另存的）模板 */
  customTemplates: FlowTemplate[];
  preferences: Preferences;
}

export function defaultState(): PersistedState {
  return {
    match: { ...DEFAULT_MATCH, templateId: DEFAULT_TEMPLATE_ID },
    customTemplates: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadState(): PersistedState {
  const store = safeStorage();
  if (!store) return defaultState();
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const base = defaultState();
    return {
      match: { ...base.match, ...(parsed.match ?? {}) },
      customTemplates: Array.isArray(parsed.customTemplates)
        ? parsed.customTemplates.filter(isValidTemplate)
        : [],
      preferences: { ...base.preferences, ...(parsed.preferences ?? {}) },
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 配额满或被禁用时静默失败，不能影响计时本身
  }
}

export function exportTemplate(template: FlowTemplate): string {
  return JSON.stringify(template, null, 2);
}

/** 导入模板 JSON（用户文件，属系统边界，必须校验） */
export function importTemplate(json: string): FlowTemplate {
  const parsed: unknown = JSON.parse(json);
  if (!isValidTemplate(parsed)) throw new Error("模板文件格式不正确");
  return parsed;
}

function isValidTemplate(value: unknown): value is FlowTemplate {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Partial<FlowTemplate>;
  if (typeof t.name !== "string" || !Array.isArray(t.stages)) return false;
  return t.stages.every(isValidStage);
}

function isValidStage(value: unknown): value is Stage {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<Stage>;
  if (typeof s.id !== "string" || typeof s.name !== "string") return false;
  if (typeof s.timing !== "object" || s.timing === null) return false;
  if (!Array.isArray(s.prompts)) return false;
  return true;
}

/** 内置模板不可被覆盖：编辑内置模板时先另存为自定义 */
export function cloneAsCustom(template: FlowTemplate): FlowTemplate {
  return {
    id: `custom-${Date.now()}`,
    name: `${template.name}（自定义）`,
    builtin: false,
    stages: template.stages.map((s) => ({
      ...s,
      id: `${s.id}-${Math.random().toString(36).slice(2, 7)}`,
    })),
  };
}
