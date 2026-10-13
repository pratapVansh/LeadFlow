import type { LeadStatus } from "../lib/types";

export const STATUS_DETAILS: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "New", className: "border-green-200 bg-green-100 text-green-800" },
  contacted: { label: "Contacted", className: "border-amber-200 bg-amber-100 text-amber-800" },
  qualified: { label: "Qualified", className: "border-blue-200 bg-blue-100 text-blue-800" },
  proposal_sent: { label: "Proposal Sent", className: "border-purple-200 bg-purple-100 text-purple-800" },
  won: { label: "Won", className: "border-slate-200 bg-slate-100 text-slate-600" },
  lost: { label: "Lost", className: "border-red-200 bg-red-100 text-red-800" },
};

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const detail = STATUS_DETAILS[status];
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium uppercase leading-4 ${detail.className}`}>{detail.label}</span>;
}
