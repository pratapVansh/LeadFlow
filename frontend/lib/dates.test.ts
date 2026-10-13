import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { followUpToISO, formatDateTime, formatTime, isOverdue, isToday, relativeTime } from "./dates";

beforeEach(() => vi.stubEnv("TZ", "Asia/Kolkata"));
afterEach(() => vi.unstubAllEnvs());

describe("browser-local calendar days", () => {
  const now = Date.parse("2026-10-13T06:30:00Z");

  it("uses local midnight instead of UTC midnight", () => {
    expect(isToday("2026-10-12T18:30:00Z", now)).toBe(true);
    expect(isToday("2026-10-12T18:29:59Z", now)).toBe(false);
    expect(isToday("2026-10-13T18:30:00Z", now)).toBe(false);
  });

  it("handles year boundaries", () => {
    const newYear = Date.parse("2026-12-31T19:00:00Z");
    expect(isToday("2026-12-31T18:30:00Z", newYear)).toBe(true);
    expect(isToday("2026-12-31T18:29:59Z", newYear)).toBe(false);
  });

  it("handles the shorter day when daylight saving starts", () => {
    vi.stubEnv("TZ", "America/New_York");
    const springDay = Date.parse("2026-03-08T16:00:00Z");
    expect(isToday("2026-03-08T05:00:00Z", springDay)).toBe(true);
    expect(isToday("2026-03-09T03:59:59Z", springDay)).toBe(true);
    expect(isToday("2026-03-09T04:00:00Z", springDay)).toBe(false);
  });

  it("formats stored UTC times in the local time zone", () => {
    expect(formatTime("2026-10-13T00:00:00Z")).toContain("5:30");
    expect(formatDateTime("2026-10-12T18:30:00Z")).toContain("13");
    expect(formatDateTime("2026-10-12T18:30:00Z")).toContain("2026");
  });
});

describe("follow-up scheduling", () => {
  const now = Date.parse("2026-10-13T06:30:00Z");

  it("converts browser-local date/time into UTC", () => {
    expect(followUpToISO("2026-10-14", "14:00", now)).toBe("2026-10-14T08:30:00.000Z");
  });

  it.each([["", "14:00"], ["2026-10-14", ""], ["2026-02-30", "14:00"], ["2026-10-14", "25:00"], ["2026-10-14", "14:99"]])("rejects invalid date/time %s %s", (date, time) => {
    expect(() => followUpToISO(date, time, now)).toThrow();
  });

  it("rejects the present instant and the past", () => {
    expect(() => followUpToISO("2026-10-13", "12:00", now)).toThrow("Follow-up must be in the future.");
    expect(() => followUpToISO("2026-10-12", "12:00", now)).toThrow("Follow-up must be in the future.");
  });

  it("rejects a local time skipped by daylight saving", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(() => followUpToISO("2026-03-08", "02:30", Date.parse("2026-03-01T00:00:00Z"))).toThrow("invalid in your time zone");
  });

  it("uses the browser's first occurrence of an ambiguous fall-back time", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(followUpToISO("2026-11-01", "01:30", now)).toBe("2026-11-01T05:30:00.000Z");
  });
});

it("marks a follow-up overdue only after its scheduled instant", () => {
  const due = "2026-10-13T06:30:00Z";
  const time = Date.parse(due);
  expect(isOverdue(due, time - 1)).toBe(false);
  expect(isOverdue(due, time)).toBe(false);
  expect(isOverdue(due, time + 1)).toBe(true);
});

describe("discussion ages", () => {
  const now = Date.parse("2026-10-13T06:30:00Z");

  it.each([
    [30, "just now"], [60, "1 minute ago"], [7_200, "2 hours ago"],
    [172_800, "2 days ago"], [604_800, "1 week ago"],
    [2_592_000, "1 month ago"], [31_536_000, "1 year ago"],
  ])("formats an age of %i seconds", (seconds, expected) => {
    expect(relativeTime(new Date(now - seconds * 1000).toISOString(), now)).toBe(expected);
  });

  it("handles client clock skew without a negative age", () => {
    expect(relativeTime(new Date(now + 30_000).toISOString(), now)).toBe("just now");
  });
});
