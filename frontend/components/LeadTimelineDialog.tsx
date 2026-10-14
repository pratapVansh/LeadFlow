"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addDiscussion, clearFollowUp, getLead, updateStatus } from "../lib/api";
import { followUpToISO, formatDateTime, relativeTime } from "../lib/dates";
import { LEAD_STATUSES, type DiscussionCreate, type LeadDetail, type LeadStatus } from "../lib/types";
import Modal from "./Modal";
import { STATUS_DETAILS } from "./StatusBadge";

export default function LeadTimelineDialog({ leadId, now, onClose, onSaved }: {
  leadId: number;
  now: number;
  onClose: () => void;
  onSaved: (lead: LeadDetail) => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLead(null);
    setLoadError(false);
    getLead(leadId, controller.signal)
      .then((lead) => { if (!controller.signal.aborted) setLead(lead); })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [leadId, attempt]);

  async function changeStatus(status: LeadStatus) {
    if (busy || !lead) return;
    setError("");
    setBusy(true);
    try {
      const saved = await updateStatus(leadId, status);
      setLead(saved);
      onSaved(saved);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update status. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFollowUp() {
    if (busy || !lead?.follow_up_at) return;
    setError("");
    setBusy(true);
    try {
      const saved = await clearFollowUp(leadId);
      setLead(saved);
      onSaved(saved);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not clear the follow-up. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !lead) return;
    if (!note.trim()) { setError("Enter a discussion note."); return; }
    const body: DiscussionCreate = { note: note.trim() };
    try {
      if (followUp) body.follow_up_at = followUpToISO(date, time);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Choose a valid follow-up date and time.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const saved = await addDiscussion(leadId, body);
      setLead(saved);
      onSaved(saved);
      setNote("");
      setFollowUp(false);
      setDate("");
      setTime("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save this discussion. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal wide busy={busy} onClose={onClose}
      title={lead ? <>{lead.name}{lead.company && <span className="font-normal text-slate-500"> ({lead.company})</span>}</> : "Lead Timeline"}
      subtitle={lead?.phone ? <span className="break-all"><span aria-hidden="true">📞 </span>{lead.phone}</span> : undefined}
      actions={lead ? <div className="shrink-0"><label htmlFor="lead-status" className="sr-only">Lead status</label><select id="lead-status" value={lead.status} disabled={busy} onChange={(event) => void changeStatus(event.target.value as LeadStatus)} className="max-w-40 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60">{LEAD_STATUSES.map((status) => <option key={status} value={status}>{STATUS_DETAILS[status].label}</option>)}</select></div> : undefined}
    >
      {!lead ? <div className="p-6 text-sm text-slate-600">{loadError ? <div role="alert"><p>Could not load this lead. Please try again.</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-50">Retry</button></div> : <p role="status">Loading timeline…</p>}</div> : (
        <>
          {lead.follow_up_at && <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-blue-50 px-6 py-3">
            <p className="text-sm text-blue-900">Active follow-up: <time dateTime={lead.follow_up_at}>{formatDateTime(lead.follow_up_at)}</time></p>
            <button type="button" disabled={busy} onClick={() => void removeFollowUp()} className="rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-60">Clear follow-up</button>
          </div>}
          <div className="min-h-24 flex-1 overflow-y-auto bg-slate-50 p-6">
            {lead.discussions.length ? <ol aria-label="Discussion history" className="ml-2 space-y-6 border-l-2 border-slate-200">
              {lead.discussions.map((discussion, index) => (
                <li key={discussion.id} className="relative pl-6">
                  <span aria-hidden="true" className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ring-slate-50 ${index === 0 ? "bg-blue-500" : "bg-slate-300"}`} />
                  <p className="mb-1.5 text-xs text-slate-500"><time dateTime={discussion.created_at}>{formatDateTime(discussion.created_at)}</time> <span className="text-slate-400">({relativeTime(discussion.created_at, now)})</span></p>
                  <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
                    <p className="whitespace-pre-wrap break-words">{discussion.note}</p>
                    {discussion.follow_up_at && <p className="mt-2"><span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">📅 Follow-up set for: <time dateTime={discussion.follow_up_at}>{formatDateTime(discussion.follow_up_at)}</time></span></p>}
                  </div>
                </li>
              ))}
            </ol> : <p className="text-sm text-slate-500">No discussions yet.</p>}
          </div>

          <form onSubmit={saveNote} className="shrink-0 border-t border-slate-200 bg-white p-5">
            <fieldset disabled={busy} className="space-y-3">
              <label htmlFor="discussion-note" className="sr-only">Discussion note</label>
              <textarea id="discussion-note" autoFocus required maxLength={5000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Log a new discussion…" className="block max-h-40 min-h-16 w-full resize-y rounded-md border border-slate-300 p-3 text-sm placeholder:text-slate-400" />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={followUp} onChange={(event) => setFollowUp(event.target.checked)} className="h-4 w-4 accent-blue-600" /> Set Follow-up</label>
                <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto">
                  <label htmlFor="follow-up-date" className="sr-only">Follow-up date</label>
                  <input id="follow-up-date" type="date" required={followUp} disabled={!followUp || busy} value={date} onChange={(event) => setDate(event.target.value)} className="min-w-0 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400 sm:w-36" />
                  <label htmlFor="follow-up-time" className="sr-only">Follow-up time</label>
                  <input id="follow-up-time" type="time" required={followUp} disabled={!followUp || busy} value={time} onChange={(event) => setTime(event.target.value)} className="min-w-0 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400 sm:w-28" />
                </div>
                <button type="submit" disabled={busy} className="ml-auto rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">{busy ? "Saving…" : "Save Note"}</button>
              </div>
            </fieldset>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          </form>
        </>
      )}
    </Modal>
  );
}
