export function isToday(timestamp: string, now: number): boolean {
  const date = new Date(timestamp);
  const today = new Date(now);
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

export function isOverdue(timestamp: string, now: number): boolean {
  return Date.parse(timestamp) < now;
}

export function relativeTime(timestamp: string, now: number): string {
  const elapsed = Math.max(0, (now - Date.parse(timestamp)) / 1000);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [31_536_000, "year"], [2_592_000, "month"], [604_800, "week"],
    [86_400, "day"], [3_600, "hour"], [60, "minute"],
  ];
  for (const [seconds, unit] of units) {
    if (elapsed >= seconds) {
      return new Intl.RelativeTimeFormat("en", { numeric: "always" })
        .format(-Math.floor(elapsed / seconds), unit);
    }
  }
  return "just now";
}

export function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
    .format(new Date(timestamp));
}

export function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(timestamp));
}

export function followUpToISO(date: string, time: string, now = Date.now()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Choose a follow-up date and time.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const local = new Date(year, month - 1, day, hour, minute);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day
    || local.getHours() !== hour || local.getMinutes() !== minute) {
    throw new Error("This date or time is invalid in your time zone. Choose another.");
  }
  if (local.getTime() <= now) throw new Error("Follow-up must be in the future.");
  return local.toISOString();
}
