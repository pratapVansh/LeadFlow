import { afterEach, expect, it, vi } from "vitest";
import { addDiscussion, clearFollowUp, createLead, getLead, getLeads, updateStatus } from "./api";

afterEach(() => vi.unstubAllGlobals());

it("requests fresh lead summaries through the API proxy with cancellation", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController();
  expect(await getLeads(controller.signal)).toEqual([]);
  expect(fetchMock).toHaveBeenCalledWith("/api/leads", { signal: controller.signal, cache: "no-store" });
});

it("rejects failed API responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
  await expect(getLeads()).rejects.toThrow("Could not complete the request. Please try again.");
});

it("propagates network failures for the dashboard error state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network failed")));
  await expect(getLeads()).rejects.toThrow("Could not reach LeadFlow. Please try again.");
});

it("loads detail with cancellation", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":12,"discussions":[]}'));
  vi.stubGlobal("fetch", fetchMock);
  const signal = new AbortController().signal;
  expect(await getLead(12, signal)).toEqual({ id: 12, discussions: [] });
  expect(fetchMock).toHaveBeenCalledWith("/api/leads/12", { cache: "no-store", signal });
});

it("sends the correct lead creation, status, and discussion contracts", async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"id":12,"discussions":[]}')));
  vi.stubGlobal("fetch", fetchMock);
  await createLead({ name: "Test lead", company: null, phone: "555-0123" });
  await updateStatus(12, "qualified");
  await addDiscussion(12, { note: "A call" });
  await addDiscussion(12, { note: "Scheduled", follow_up_at: "2099-01-01T09:00:00Z" });
  expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, JSON.parse(init.body), init.headers])).toEqual([
    ["/api/leads", "POST", { name: "Test lead", company: null, phone: "555-0123" }, { "Content-Type": "application/json" }],
    ["/api/leads/12", "PATCH", { status: "qualified" }, { "Content-Type": "application/json" }],
    ["/api/leads/12/discussions", "POST", { note: "A call" }, { "Content-Type": "application/json" }],
    ["/api/leads/12/discussions", "POST", { note: "Scheduled", follow_up_at: "2099-01-01T09:00:00Z" }, { "Content-Type": "application/json" }],
  ]);
});

it("clears the active follow-up and returns the saved detail", async () => {
  const detail = { id: 12, follow_up_at: null, discussions: [] };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(detail)));
  vi.stubGlobal("fetch", fetchMock);
  expect(await clearFollowUp(12)).toEqual(detail);
  expect(fetchMock).toHaveBeenCalledWith("/api/leads/12/follow-up", { cache: "no-store", method: "DELETE" });
});

it("reports a failed follow-up clear", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"detail":"Database unavailable. Please try again."}', { status: 503 })));
  await expect(clearFollowUp(12)).rejects.toThrow("Database unavailable. Please try again.");
});

it("displays backend validation messages without the Pydantic prefix", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ msg: "Value error, Follow-up must be in the future." }] }), { status: 422 })));
  await expect(addDiscussion(12, { note: "Call" })).rejects.toThrow("Follow-up must be in the future.");
});

it("displays a missing-lead error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"detail":"Lead not found."}', { status: 404 })));
  await expect(getLead(12)).rejects.toThrow("Lead not found.");
});

it("retains cancellation errors instead of presenting a network failure", async () => {
  const controller = new AbortController();
  controller.abort();
  const error = new DOMException("Cancelled", "AbortError");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
  await expect(getLead(12, controller.signal)).rejects.toBe(error);
});

it("handles invalid success JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Invalid JSON")));
  await expect(getLead(12)).rejects.toThrow("Unexpected server response. Please try again.");
});
