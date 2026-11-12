"use client";

import { useState } from "react";
import { calendarDays, dateLabel, money, type Settings } from "./model";
import { interests, type Interest } from "@/features/recommendations/rank";
import type { AssistantPlan } from "./assistant";

type Props = {
  trip: Settings;
  destinations: { id: string; title: string }[];
  onApply: (plan: AssistantPlan) => void;
};

const labels: Record<Interest, string> = { culture: "Culture", hiking: "Hiking", nature: "Nature", history: "History", family: "Family", food: "Food", photography: "Photography", wildlife: "Wildlife" };

export function TripAssistant({ trip, destinations, onApply }: Props) {
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>(["nature"]);
  const [generated, setGenerated] = useState<{ plan: AssistantPlan; inputKey: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const days = calendarDays(trip.start, trip.end);
  const inputKey = JSON.stringify({ ...trip, interests: selectedInterests });
  const plan = generated?.inputKey === inputKey ? generated.plan : null;

  async function generate() {
    setBusy(true); setGenerated(null); setError("");
    const generatedFor = inputKey;
    try {
      const response = await fetch("/api/planner/assistant", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: trip.start, days: days.length, people: trip.people, budget: trip.budget, destinationIds: trip.destinationIds, interests: selectedInterests }), signal: AbortSignal.timeout(20_000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.plan) throw new Error(result?.error ?? "The plan could not be created. Try again.");
      setGenerated({ plan: result.plan as AssistantPlan, inputKey: generatedFor });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The plan could not be created. Try again."); }
    finally { setBusy(false); }
  }

  return <section className="trip-assistant" aria-labelledby="trip-assistant-title">
    <p className="eyebrow">Build a draft from your trip details</p>
    <h3 id="trip-assistant-title">Trip planning assistant</h3>
    <p>It uses the dates, budget, people and destinations above. Choose interests, then generate a day-by-day draft.</p>
    <fieldset className="trip-assistant-interests"><legend>What does your group enjoy?</legend>{interests.map((interest) => <label key={interest}>
      <input type="checkbox" checked={selectedInterests.includes(interest)} onChange={(event) => setSelectedInterests((current) => event.target.checked ? [...current, interest] : current.filter((value) => value !== interest))} />{labels[interest]}
    </label>)}</fieldset>
    <p className="trip-assistant-summary">{days.length ? `${days.length} ${days.length === 1 ? "day" : "days"}` : "No valid days"} · {trip.people} people · {trip.budget ? `PKR ${trip.budget}` : "budget needed"} · {trip.destinationIds.map((id) => destinations.find((item) => item.id === id)?.title ?? "Unavailable place").join(", ") || "choose a destination"}</p>
    <p className="trip-assistant-summary">It can create plans for up to 14 days.</p>
    <button type="button" disabled={busy || !trip.budget || !trip.destinationIds.length || !days.length || days.length > 14} onClick={() => void generate()}>{busy ? "Planning your days…" : "Create my plan"}</button>
    {busy && <p role="status">Checking published places, room capacity and prices…</p>}
    {error && <p className="plan-notice" role="alert">{error}</p>}
    {plan && <div className="trip-assistant-result" aria-live="polite">
      <h4>Your {plan.days.length}-day draft</h4>
      <p>Known estimate · {money(plan.knownTotalMinor)} of {money(plan.budgetMinor)} budget · {plan.unknownCount} unpriced or unknown cost item(s)</p>
      {plan.days.map((day, index) => <section className="trip-assistant-day" key={day.day}>
        <h5>Day {index + 1} · {dateLabel(day.day)} · {day.destinationTitle}</h5>
        <ul>{day.items.map((item) => <li key={item.id}><strong>{item.title}</strong> · {item.kind === "hotels" ? `${item.quantity} room(s), ${item.unitMinor === null ? "price not listed" : `${money(item.unitMinor)} / room / night`}` : item.kind === "activities" ? `${item.unitMinor === null ? "price not listed" : `${money(item.unitMinor)} / person`} for ${item.quantity}` : "visit"}</li>)}</ul>
      </section>)}
      {plan.warnings.map((warning) => <p className="plan-notice" key={warning}>{warning}</p>)}
      <p className="trip-assistant-disclosure">{plan.disclosure}</p>
      <button type="button" onClick={() => onApply(plan)}>Use this plan in my itinerary</button>
    </div>}
  </section>;
}
