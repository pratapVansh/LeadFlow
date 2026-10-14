import type { DiscussionCreate, LeadCreate, LeadDetail, LeadStatus, LeadSummary } from "./types";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error("Could not reach LeadFlow. Please try again.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    let message = "Could not complete the request. Please try again.";
    if (typeof body?.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body?.detail)) {
      const messages = body.detail
        .filter((error: { msg?: unknown }) => typeof error?.msg === "string")
        .map((error: { msg: string }) => error.msg.replace(/^Value error, /, ""));
      if (messages.length) message = messages.join(" ");
    }
    throw new Error(message);
  }
  return response.json().catch(() => { throw new Error("Unexpected server response. Please try again."); });
}

export function getLeads(signal?: AbortSignal): Promise<LeadSummary[]> {
  return request("/api/leads", { signal });
}

export function getLead(id: number, signal?: AbortSignal): Promise<LeadDetail> {
  return request(`/api/leads/${id}`, { signal });
}

export function createLead(body: LeadCreate): Promise<LeadDetail> {
  return request("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function updateStatus(id: number, status: LeadStatus): Promise<LeadDetail> {
  return request(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
}

export function clearFollowUp(id: number): Promise<LeadDetail> {
  return request(`/api/leads/${id}/follow-up`, { method: "DELETE" });
}

export function addDiscussion(id: number, body: DiscussionCreate): Promise<LeadDetail> {
  return request(`/api/leads/${id}/discussions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
