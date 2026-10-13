"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export default function Modal({ title, subtitle, actions, wide = false, busy = false, onClose, children }: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      const target = previous?.isConnected ? previous : previous?.id ? document.getElementById(previous.id) : null;
      (target ?? document.getElementById("add-lead-button"))?.focus();
    };
  }, []);

  function keepFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)"))
      .filter((control) => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) {
      event.preventDefault();
      event.currentTarget.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog ref={ref} aria-labelledby={titleId} aria-busy={busy} onKeyDown={keepFocus} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className={`lead-dialog m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] overflow-auto rounded-xl border-0 bg-white p-0 text-gray-900 shadow-xl open:flex open:flex-col ${wide ? "max-w-[672px]" : "max-w-md"}`}>
      <header className="flex shrink-0 flex-wrap items-start gap-3 border-b border-slate-200 px-5 py-5">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-xl font-semibold leading-7 break-words">{title}</h2>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {actions}
        <button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      {children}
    </dialog>
  );
}
