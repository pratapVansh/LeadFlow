"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createLead } from "../lib/api";
import type { LeadDetail } from "../lib/types";
import Modal from "./Modal";

export default function AddLeadDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (lead: LeadDetail) => void }) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { nameInput.current?.focus(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError("Full name is required."); nameInput.current?.focus(); return; }
    setError("");
    setBusy(true);
    try {
      const lead = await createLead({ name: name.trim(), company: company.trim() || null, phone: phone.trim() || null });
      onSaved(lead);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save this lead. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add New Lead" busy={busy} onClose={onClose}>
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 overflow-y-auto p-6">
          <fieldset disabled={busy} className="space-y-4">
            <div>
              <label htmlFor="lead-name" className="mb-1 block text-sm text-slate-700">Full Name <span className="text-red-600">*</span></label>
              <input ref={nameInput} id="lead-name" required maxLength={200} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g., John Doe" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400" />
            </div>
            <div>
              <label htmlFor="lead-company" className="mb-1 block text-sm text-slate-700">Company <span className="text-slate-400">(Optional)</span></label>
              <input id="lead-company" maxLength={200} autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g., Stark Industries" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400" />
            </div>
            <div>
              <label htmlFor="lead-phone" className="mb-1 block text-sm text-slate-700">Phone <span className="text-slate-400">(Optional)</span></label>
              <input id="lead-phone" type="tel" maxLength={50} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g., 555-0123" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400" />
            </div>
          </fieldset>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        </div>
        <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 p-5">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy ? "Saving…" : "Save Lead"}</button>
        </footer>
      </form>
    </Modal>
  );
}
