import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { partitionLeads, upsertLead } from "./leads";
import { LEAD_STATUSES, type LeadDetail, type LeadSummary } from "./types";

const now = Date.parse("2026-10-13T06:30:00Z");
const leads: LeadSummary[] = LEAD_STATUSES.map((status, index) => ({
  id: index + 1,
  name: ["Hank Scorpio", "SARAH Jones", "Diana Prince", "Sarah Connor", "Bruce Wayne", "Tony Stark"][index],
  status,
  company: null,
  phone: null,
  follow_up_at: status === "proposal_sent" ? "2026-10-13T07:00:00Z" : status === "contacted" ? "2026-10-12T07:00:00Z" : null,
  last_note: null,
  last_discussion_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
}));

beforeEach(() => vi.stubEnv("TZ", "Asia/Kolkata"));
afterEach(() => vi.unstubAllEnvs());

it("shows each lead once and retains older overdue follow-ups", () => {
  const { today, others } = partitionLeads(leads, "all", "", now);
  expect(today.map((lead) => lead.id)).toEqual([4]);
  expect(others.map((lead) => lead.id)).toEqual([1, 2, 3, 5, 6]);
  expect(new Set([...today, ...others].map((lead) => lead.id)).size).toBe(leads.length);
});

it.each(LEAD_STATUSES)("filters both sections by %s", (status) => {
  const { today, others } = partitionLeads(leads, status, "", now);
  expect([...today, ...others].map((lead) => lead.status)).toEqual([status]);
});

it("searches names case-insensitively in both sections", () => {
  const { today, others } = partitionLeads(leads, "all", "  sArAh  ", now);
  expect(today.map((lead) => lead.name)).toEqual(["Sarah Connor"]);
  expect(others.map((lead) => lead.name)).toEqual(["SARAH Jones"]);
});

it("combines search and status filters", () => {
  const { today, others } = partitionLeads(leads, "contacted", "sarah", now);
  expect(today).toEqual([]);
  expect(others.map((lead) => lead.name)).toEqual(["SARAH Jones"]);
});

it("sorts today's schedules by time and ID without changing source order", () => {
  const input = [leads[3], { ...leads[3], id: 8, follow_up_at: "2026-10-13T06:00:00Z" }, { ...leads[3], id: 7, follow_up_at: "2026-10-13T06:00:00Z" }];
  expect(partitionLeads(input, "all", "", now).today.map((lead) => lead.id)).toEqual([7, 8, 4]);
  expect(input.map((lead) => lead.id)).toEqual([4, 8, 7]);
});

it("moves today's follow-up into the main list after local midnight", () => {
  const result = partitionLeads(leads, "all", "", Date.parse("2026-10-13T18:30:00Z"));
  expect(result.today).toEqual([]);
  expect(result.others).toHaveLength(6);
});

it("handles an empty database and an unmatched name", () => {
  expect(partitionLeads([], "all", "", now)).toEqual({ today: [], others: [] });
  expect(partitionLeads(leads, "all", "unmatched", now)).toEqual({ today: [], others: [] });
});

it("inserts a new lead from its saved detail without duplicates", () => {
  const { last_note, last_discussion_at, ...fields } = leads[0];
  const detail: LeadDetail = { ...fields, id: 10, name: "New lead", created_at: "2026-10-13T06:30:00Z", discussions: [] };
  const result = upsertLead(leads, detail);
  expect(result).toHaveLength(7);
  expect(result[0]).toMatchObject({ id: 10, last_note: null, last_discussion_at: null });
  expect(upsertLead(result, detail)).toHaveLength(7);
  expect(leads).toHaveLength(6);
});

it("applies saved status, note, and schedule to the dashboard summary", () => {
  const { last_note, last_discussion_at, ...fields } = leads[0];
  const detail: LeadDetail = {
    ...fields, status: "qualified", follow_up_at: "2026-10-13T07:00:00Z",
    discussions: [{ id: 20, note: "Newest note", follow_up_at: "2026-10-13T07:00:00Z", created_at: "2026-10-13T06:00:00Z" }],
  };
  const result = upsertLead(leads, detail);
  expect(result[0]).toMatchObject({ id: fields.id, status: "qualified", last_note: "Newest note", last_discussion_at: "2026-10-13T06:00:00Z", follow_up_at: detail.follow_up_at });
  expect(result.filter((lead) => lead.id === fields.id)).toHaveLength(1);
  expect(partitionLeads(result, "qualified", "hank", now).today).toHaveLength(1);
});

it("removes a cleared follow-up from today's list while preserving its history summary", () => {
  const { last_note, last_discussion_at, ...fields } = leads[3];
  const result = upsertLead(leads, {
    ...fields, follow_up_at: null,
    discussions: [{ id: 20, note: "Scheduled call", follow_up_at: fields.follow_up_at, created_at: "2026-10-13T06:00:00Z" }],
  });
  const { today, others } = partitionLeads(result, "all", "", now);
  expect(today).toEqual([]);
  expect(others).toHaveLength(leads.length);
  expect(others.find((lead) => lead.id === fields.id)).toMatchObject({ follow_up_at: null, last_note: "Scheduled call" });
  expect(leads[3].follow_up_at).not.toBeNull();
});

it("keeps deterministic activity ordering when only status changes", () => {
  const { last_note, last_discussion_at, ...fields } = leads[0];
  const result = upsertLead(leads, { ...fields, status: "won", discussions: [] });
  expect(result.map((lead) => lead.id)).toEqual([6, 5, 4, 3, 2, 1]);
});
