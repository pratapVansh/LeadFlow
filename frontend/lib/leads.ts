import { isToday } from "./dates";
import type { LeadDetail, LeadStatus, LeadSummary } from "./types";

export function partitionLeads(leads: LeadSummary[], status: LeadStatus | "all", search: string, now: number) {
  const query = search.trim().toLowerCase();
  const today: LeadSummary[] = [];
  const others: LeadSummary[] = [];
  for (const lead of leads) {
    if ((status !== "all" && lead.status !== status) || !lead.name.toLowerCase().includes(query)) {
      continue;
    }
    if (lead.follow_up_at && isToday(lead.follow_up_at, now)) {
      today.push(lead);
    } else {
      others.push(lead);
    }
  }
  today.sort((a, b) => Date.parse(a.follow_up_at!) - Date.parse(b.follow_up_at!) || a.id - b.id);
  return { today, others };
}

export function upsertLead(leads: LeadSummary[], detail: LeadDetail): LeadSummary[] {
  const { discussions, ...fields } = detail;
  const summary: LeadSummary = {
    ...fields,
    last_note: discussions[0]?.note ?? null,
    last_discussion_at: discussions[0]?.created_at ?? null,
  };
  return [summary, ...leads.filter((lead) => lead.id !== detail.id)].sort((a, b) =>
    Date.parse(b.last_discussion_at ?? b.created_at) - Date.parse(a.last_discussion_at ?? a.created_at) || b.id - a.id);
}
