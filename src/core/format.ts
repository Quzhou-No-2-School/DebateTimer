/** 时长格式化：mm:ss。剩余时间向上取整，保证"还剩 1 秒"时显示 00:01。 */

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** 超时显示为 +mm:ss，与剩余时间区分开 */
export function formatOvertime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `+${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
