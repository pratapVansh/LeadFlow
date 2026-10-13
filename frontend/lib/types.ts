export const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal_sent", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadSummary {
  id: number;
  name: string;
  company: string | null;
  phone: string | null;
  status: LeadStatus;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  last_note: string | null;
  last_discussion_at: string | null;
}

export interface Discussion {
  id: number;
  note: string;
  follow_up_at: string | null;
  created_at: string;
}

export interface LeadDetail extends Omit<LeadSummary, "last_note" | "last_discussion_at"> {
  discussions: Discussion[];
}

export interface LeadCreate {
  name: string;
  company?: string | null;
  phone?: string | null;
}

export interface DiscussionCreate {
  note: string;
  follow_up_at?: string | null;
}
