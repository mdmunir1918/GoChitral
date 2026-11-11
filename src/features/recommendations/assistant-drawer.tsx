"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Answer = {
  status?: "answered" | "fallback";
  message?: string;
  error?: string;
  answer?: string;
  topic?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  reviewedAt?: string;
  expiresAt?: string | null;
  relatedTopics?: string[];
  relatedListings?: { id: string; title: string; slug: string; category: string }[];
};

export function AssistantDrawer({ contextListingId }: { contextListingId?: string }) {
  const [open, setOpen] = useState(false), [question, setQuestion] = useState(""), [busy, setBusy] = useState(false), [answer, setAnswer] = useState<Answer | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!dialog.current) return;
    if (open && !dialog.current.open) { dialog.current.showModal(); closeButton.current?.focus(); }
    else if (!open && dialog.current.open) dialog.current.close();
  }, [open]);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setAnswer(null);
    try {
      const response = await fetch("/api/assistant/answer", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, ...(contextListingId ? { contextListingId } : {}) }), signal: AbortSignal.timeout(10_000) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Answers are not available right now. Please try again.");
      setAnswer(result as Answer);
    } catch (error) { setAnswer({ error: error instanceof Error ? error.message : "Answers are not available right now." }); }
    finally { setBusy(false); }
  }

  return <div className="assistant-drawer-control">
    <button type="button" className="secondary" onClick={() => { setAnswer(null); setOpen(true); }}>Ask a local question</button>
    <dialog className="assistant-dialog" ref={dialog} aria-labelledby="assistant-title" onCancel={(event) => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)}>
      {open && <section className="assistant-dialog-content"><header><div><p className="listing-location">Reviewed local information</p><h2 id="assistant-title">Ask about your visit</h2></div>
        <button ref={closeButton} type="button" className="secondary" onClick={() => setOpen(false)}>Close</button></header>
        <p>Answers use administrator-reviewed sources. Road and access conditions may change; this assistant does not use AI or read your saved trips.</p>
        <form onSubmit={ask}><label htmlFor="local-question">Your question <span>(up to 300 characters)</span></label>
          <textarea id="local-question" maxLength={300} minLength={3} required value={question} onChange={(event) => setQuestion(event.target.value)} />
          <button type="submit" disabled={busy}>{busy ? "Checking reviewed answers…" : "Ask"}</button>
        </form>
        {busy && <p role="status">Checking current reviewed information…</p>}
        {answer?.error && <p role="alert" className="assistant-message">{answer.error}</p>}
        {answer && !answer.error && <section className="assistant-answer" aria-live="polite"><h3>{answer.topic ?? "No reviewed answer found"}</h3>
          <p>{answer.answer ?? answer.message}</p>
          {answer.sourceUrl && <p>Source · <a href={answer.sourceUrl} target="_blank" rel="noreferrer">{answer.sourceTitle}</a></p>}
          {answer.reviewedAt && <p>Last reviewed · {answer.reviewedAt}{answer.expiresAt ? ` · Expires ${answer.expiresAt}` : " · No expiry date set"}</p>}
          {answer.relatedListings?.map((item) => <p key={item.id}><Link href={`/${item.category}/${item.slug}`}>{item.title}</Link></p>)}
          {answer.relatedTopics?.length ? <div><h4>Other topics</h4><ul>{answer.relatedTopics.map((topic) => <li key={topic}><button type="button" className="text-button" onClick={() => setQuestion(topic)}>{topic}</button></li>)}</ul></div> : null}
        </section>}
        <p className="assistant-note">Questions are checked for an answer but are not saved or sent to an external AI service.</p>
      </section>}
    </dialog>
  </div>;
}
