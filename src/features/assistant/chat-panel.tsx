"use client";

import Link from "next/link";
import { useState } from "react";
import { listingUrl, categoryLabels, type Listing } from "@/features/catalogue/types";
import { dateLabel, money } from "@/features/planner/model";
import type { AssistantContext, AssistantTurn } from "./conversation";

type Message = { role: "assistant" | "user"; text: string; result?: AssistantTurn };
type Props = { destinations: Listing[]; today: string };

const examples = [
  "Plan a 3-day trip in Bumburet for 4 people with PKR 50,000. I like nature and culture.",
  "Show me family hotels in Bumburet.",
  "What hiking activities can I do in Chitral Town?",
];

export function AssistantChat({ destinations, today }: Props) {
  const [context, setContext] = useState<AssistantContext>({ mode: null, start: "", end: "", people: 2, days: null, budget: "", destinationIds: [], interests: [] });
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "Hello! I can help you find places, hotels, activities and guides in Chitral, or draft a trip. Tell me what you are looking for. I’ll ask follow-up questions if I need more details." }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(value: string) {
    const message = value.trim();
    if (!message || busy) return;
    setDraft(""); setBusy(true); setError("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    try {
      const response = await fetch("/api/assistant/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context }), signal: AbortSignal.timeout(20_000) });
      const result = await response.json().catch(() => null) as AssistantTurn | { error?: string } | null;
      if (!response.ok || !result || !("text" in result)) throw new Error(result && "error" in result ? result.error : "I could not check the catalogue just now. Please try again.");
      setContext(result.context);
      setMessages((current) => [...current, { role: "assistant", text: result.text, result }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "I could not check the catalogue just now. Please try again.");
    } finally { setBusy(false); }
  }

  return <div className="assistant-workspace">
    <section className="assistant-panel" aria-label="Trip details">
      <p className="assistant-eyebrow">A few details help me give better suggestions</p>
      <div className="assistant-trip-fields">
        <label>Start date<input type="date" min={today} value={context.start} onChange={(event) => setContext((current) => ({ ...current, start: event.target.value, end: "" }))} /></label>
        <label>End date <span>(optional)</span><input type="date" min={context.start || today} value={context.end} onChange={(event) => setContext((current) => ({ ...current, end: event.target.value }))} /></label>
        <label>People<input type="number" min={1} max={20} value={context.people} onChange={(event) => setContext((current) => ({ ...current, people: Math.max(1, Math.min(20, Number(event.target.value) || 1)) }))} /></label>
      </div>
      <p className="assistant-help">For a trip draft, tell me the number of days, your budget and the places you want to visit.</p>
    </section>

    <section className="assistant-chat" aria-label="GoChitral travel assistant">
      <div className="assistant-conversation" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((message, index) => <article className={`assistant-message assistant-message-${message.role}`} key={`${index}-${message.role}`}>
          <p className="assistant-message-label">{message.role === "assistant" ? "GoChitral assistant" : "You"}</p>
          <p>{message.text}</p>
          {message.result?.plan && <div className="assistant-itinerary">
            <h2>Your {message.result.plan.days.length}-day trip draft</h2>
            <p className="assistant-estimate">Known estimate: {money(message.result.plan.knownTotalMinor)} of {money(message.result.plan.budgetMinor)} · {message.result.plan.unknownCount} item(s) have unknown costs</p>
            {message.result.plan.days.map((day, dayIndex) => <section className="assistant-plan-day" key={day.day}>
              <h3>Day {dayIndex + 1} · {dateLabel(day.day)} · {day.destinationTitle}</h3>
              <ul>{day.items.map((item) => <li key={item.id}><strong>{item.title}</strong>{item.kind === "hotels" ? ` · ${item.quantity} room(s), ${item.unitMinor === null ? "price not listed" : `${money(item.unitMinor)} per room per night`}` : item.kind === "activities" ? ` · ${item.unitMinor === null ? "price not listed" : `${money(item.unitMinor)} per person`}` : " · visit"}</li>)}</ul>
            </section>)}
            {message.result.plan.warnings.map((warning) => <p className="assistant-warning" key={warning}>{warning}</p>)}
          </div>}
          {message.result?.cards?.length ? <div className="assistant-cards">{message.result.cards.map((card) => <article className="assistant-card" key={card.id}>
            <p className="assistant-eyebrow">{categoryLabels[card.category]} · {card.location}</p>
            <h2><Link href={`/${card.category}/${card.slug}`}>{card.title}</Link></h2>
            <p>{card.summary}</p>
            <p>{card.price === null ? "Price not listed" : `${money(card.price)} ${card.priceUnit}`} {card.score !== null && `· Match score ${card.score.toFixed(2)}`}</p>
            {card.reasons.length > 0 && <p className="assistant-reasons">{card.reasons.join(" · ")}</p>}
            {destinations.some((destination) => destination.id === card.id) && <Link className="text-link" href={listingUrl(destinations.find((destination) => destination.id === card.id)!)}>View place</Link>}
          </article>)}</div> : null}
        </article>)}
        {busy && <p className="assistant-pending" role="status">Checking GoChitral’s published listings…</p>}
      </div>

      {messages.length === 1 && <div className="assistant-examples" aria-label="Example questions">{examples.map((example) => <button type="button" key={example} disabled={busy} onClick={() => void send(example)}>{example}</button>)}</div>}
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
        <label className="sr-only" htmlFor="assistant-prompt">Ask about Chitral or describe your trip</label>
        <textarea id="assistant-prompt" maxLength={500} rows={3} placeholder="Ask about Chitral or describe the trip you want…" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <div className="assistant-compose-footer"><span>{draft.length}/500</span><button type="submit" disabled={busy || !draft.trim()}>{busy ? "Thinking…" : "Send"}</button></div>
      </form>
    </section>
    <p className="assistant-disclosure">Local demo: answers use published GoChitral listings and simple rules. No external AI service is connected yet. Prices and availability may change; confirm with the provider.</p>
  </div>;
}
