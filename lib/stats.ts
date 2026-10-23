import "server-only";

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bishkek" });
const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Bishkek" });
const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "short", year: "2-digit", timeZone: "Asia/Bishkek" });

export const toDayKey = (iso: string | Date) => dayKey.format(new Date(iso));

// Последние N дней (включая сегодня) в часовом поясе Бишкека
export function lastDays(n: number) {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push({ key: dayKey.format(d), label: dayLabel.format(d) });
  }
  return out;
}

export function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    out.push({ key: dayKey.format(d).slice(0, 7), label: monthLabel.format(d) });
  }
  return out;
}

export function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

export function delta(cur: number, prev: number) {
  if (!prev) return cur ? "новые за период" : "без изменений";
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d > 0 ? "+" : ""}${d}% к прошлой неделе`;
}
