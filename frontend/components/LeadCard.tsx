import type { LeadSummary } from "../lib/types";
import { formatDateTime, formatTime, isOverdue, isToday, relativeTime } from "../lib/dates";
import StatusBadge, { STATUS_DETAILS } from "./StatusBadge";

export default function LeadCard({ lead, now, onOpen }: { lead: LeadSummary; now: number; onOpen: () => void }) {
  const today = lead.follow_up_at !== null && isToday(lead.follow_up_at, now);
  const overdue = lead.follow_up_at !== null && isOverdue(lead.follow_up_at, now);
  const closed = lead.status === "won" || lead.status === "lost";
  const colors = overdue ? "border-red-200 bg-red-50" : today ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white";

  return (
    <article aria-label={`${lead.name}, ${STATUS_DETAILS[lead.status].label}`} className={`relative rounded-lg border p-4 shadow-sm ${colors}`}>
      <button id={`lead-${lead.id}`} type="button" aria-label={`Open timeline for ${lead.name}`} onClick={onOpen} className="absolute inset-0 z-10 rounded-lg hover:ring-1 hover:ring-slate-300" />
      <div className="flex items-start justify-between gap-3">
        <h3 className={`min-w-0 text-lg font-semibold leading-6 break-words ${closed ? "text-slate-600" : "text-gray-900"}`}>
          {lead.name}{lead.company && <span className="text-sm font-normal text-slate-500"> ({lead.company})</span>}
        </h3>
        <StatusBadge status={lead.status} />
      </div>
      <div className="mt-2 flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:gap-2">
        <p className="min-w-0 truncate text-slate-600" title={lead.last_note ?? undefined}>
          {lead.last_note ? <><span className="font-medium text-slate-800">Last Note: </span>{lead.last_note}</> : "No discussions yet"}
        </p>
        {lead.last_discussion_at && <time dateTime={lead.last_discussion_at} title={formatDateTime(lead.last_discussion_at)} className="shrink-0 text-xs text-slate-500">{relativeTime(lead.last_discussion_at, now)}</time>}
      </div>
      {lead.follow_up_at && (
        <p className="mt-3">
          <span className={`inline-flex max-w-full items-start gap-1 rounded px-2 py-1 text-xs font-semibold ${overdue ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
            <span aria-hidden="true">{overdue ? "!" : "🔔"}</span>
            <span>{overdue && "Overdue: "}{today ? `Follow-up today at ${formatTime(lead.follow_up_at)}` : `Follow-up ${formatDateTime(lead.follow_up_at)}`}</span>
          </span>
        </p>
      )}
    </article>
  );
}
