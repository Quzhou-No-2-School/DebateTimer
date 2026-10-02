import type { PromptSound } from "./models";

/**
 * 提示音：全部用 Web Audio 实时合成，不打包任何音频文件。
 * 好处：零体积、音色/音量/响几声都能配（奥瑞冈需要一/两/三声）、没有素材版权问题。
 */

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/**
 * 浏览器自动播放策略会挂起 AudioContext，必须在**首次用户交互**里调用一次，
 * 否则现场第一次响铃会是静音——这是真实会踩的坑。
 */
export function unlockAudio(): void {
  const c = ensureCtx();
  if (c && c.state === "suspended") void c.resume();
}

interface StrikeOptions {
  freq: number;
  /** 起音到衰减结束的总时长（秒） */
  duration: number;
  /** 起始时间（AudioContext 时间轴，秒） */
  at: number;
  volume: number;
  /** 泛音倍数与相对音量，用于合成钟声 */
  harmonics?: { ratio: number; gain: number }[];
}

function strike(c: AudioContext, o: StrikeOptions): void {
  const master = c.createGain();
  master.gain.value = o.volume;
  master.connect(c.destination);

  const partials = o.harmonics ?? [{ ratio: 1, gain: 1 }];
  for (const p of partials) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = o.freq * p.ratio;

    const peak = 0.9 * p.gain;
    gain.gain.setValueAtTime(0.0001, o.at);
    gain.gain.exponentialRampToValueAtTime(peak, o.at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, o.at + o.duration);

    osc.connect(gain);
    gain.connect(master);
    osc.start(o.at);
    osc.stop(o.at + o.duration + 0.05);
  }
}

export interface PlayOptions {
  volume?: number;
  /** 响几声（奥瑞冈需要 1 / 2 / 3 声） */
  repeat?: number;
}

export function playPrompt(sound: PromptSound, opts: PlayOptions = {}): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();

  const volume = Math.min(1, Math.max(0, opts.volume ?? 0.8));
  if (volume === 0) return;

  const repeat = Math.max(1, opts.repeat ?? 1);
  const t0 = c.currentTime + 0.02;

  if (sound === "double") {
    // 两声：一记短促双击
    for (let i = 0; i < repeat; i++) {
      const at = t0 + i * 0.45;
      strike(c, { freq: 880, duration: 0.22, at, volume });
      strike(c, { freq: 880, duration: 0.22, at: at + 0.25, volume });
    }
    return;
  }

  if (sound === "bell") {
    // 钟声：基频 + 两个非整数泛音，衰减更长
    for (let i = 0; i < repeat; i++) {
      strike(c, {
        freq: 660,
        duration: 1.2,
        at: t0 + i * 0.6,
        volume,
        harmonics: [
          { ratio: 1, gain: 1 },
          { ratio: 2.0, gain: 0.5 },
          { ratio: 2.76, gain: 0.25 },
        ],
      });
    }
    return;
  }

  // short：单声短铃
  for (let i = 0; i < repeat; i++) {
    strike(c, { freq: 880, duration: 0.25, at: t0 + i * 0.45, volume });
  }
}
