"use client";

import { useEffect, useState } from "react";
import { getLeads } from "../lib/api";
import { partitionLeads, upsertLead } from "../lib/leads";
import { LEAD_STATUSES, type LeadDetail, type LeadStatus, type LeadSummary } from "../lib/types";
import LeadCard from "./LeadCard";
import AddLeadDialog from "./AddLeadDialog";
import LeadTimelineDialog from "./LeadTimelineDialog";
import { STATUS_DETAILS } from "./StatusBadge";

export default function LeadDashboard() {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [dialog, setDialog] = useState<"add" | number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    getLeads(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setLeads(data);
          setNow(Date.now());
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const { today, others } = partitionLeads(leads, status, search, now);

  function applyLead(lead: LeadDetail) {
    setLeads((current) => upsertLead(current, lead));
    setNow(Date.now());
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-blue-600">
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-9M15 6h6v6" /></svg>
            LeadFlow
          </h1>
          <button id="add-lead-button" type="button" disabled={loading || error} onClick={() => setDialog("add")} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">+ Add New Lead</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="Filter leads by status" className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-xs font-semibold tracking-widest text-slate-500">FILTERS:</span>
            {(["all", ...LEAD_STATUSES] as const).map((value) => (
              <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`rounded-full border px-3 py-2 text-sm leading-4 transition-colors ${status === value ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"}`}>
                {value === "all" ? "All" : STATUS_DETAILS[value].label}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-52">
            <label htmlFor="lead-search" className="sr-only">Search leads by name</label>
            <input id="lead-search" type="search" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name…" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400" />
          </div>
        </div>

        {loading ? <p role="status" className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading leads…</p> : error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p>Could not load leads. Please try again.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 rounded-md bg-white px-3 py-2 font-medium ring-1 ring-red-200 hover:bg-red-100">Retry</button>
          </div>
        ) : (
          <>
            <section aria-labelledby="today-heading" className="mb-8">
              <h2 id="today-heading" className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500"><span aria-hidden="true">📌</span> Today&apos;s follow-ups</h2>
              <div className="space-y-3">
                {today.length ? today.map((lead) => <LeadCard key={lead.id} lead={lead} now={now} onOpen={() => setDialog(lead.id)} />) : <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No follow-ups today{status !== "all" || search.trim() ? " matching these filters" : ""}.</p>}
              </div>
            </section>

            <section aria-labelledby="leads-heading">
              <h2 id="leads-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">All leads</h2>
              <div className="space-y-3">
                {others.length ? others.map((lead) => <LeadCard key={lead.id} lead={lead} now={now} onOpen={() => setDialog(lead.id)} />) : <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">{!leads.length ? "No leads yet." : today.length ? "All matching leads are shown above." : "No leads match your search and filters."}</p>}
              </div>
            </section>
          </>
        )}
      </main>
      {dialog === "add" && <AddLeadDialog onClose={() => setDialog(null)} onSaved={(lead) => { applyLead(lead); setStatus("all"); setSearch(""); }} />}
      {typeof dialog === "number" && <LeadTimelineDialog key={dialog} leadId={dialog} now={now} onClose={() => setDialog(null)} onSaved={applyLead} />}
    </>
  );
}
