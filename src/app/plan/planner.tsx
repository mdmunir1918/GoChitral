"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { calendarDays, dateImpact, dateLabel, deviceDraftSchema, draftKey, limits, money, newDraft, restoreDraft, tripSchema, type DeviceDraft, type PlannerListing, type Quote, type Selection, type Settings } from "@/features/planner/model";
import { categoryLabels } from "@/features/catalogue/types";
import { MapDrawer, type MapStop } from "@/features/maps/map-drawer";
import { AssistantDrawer } from "@/features/recommendations/assistant-drawer";

type Props = { initial: DeviceDraft; catalogue: PlannerListing[]; addId: string; storageKey?: string };
export function Planner({ initial, catalogue, addId, storageKey = draftKey }: Props) {
  const router = useRouter();
  const target = catalogue.find(l => l.id === addId);
  const [draft, setDraft] = useState(initial);
  const [settings, setSettings] = useState<Settings>(initial.trip);
  const [ready, setReady] = useState(false), [persist, setPersist] = useState(false);
  const [step, setStep] = useState(1), [message, setMessage] = useState("");
  const [storageMessage, setStorageMessage] = useState("");
  const [pendingDates, setPendingDates] = useState<Settings | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null), [busy, setBusy] = useState(false);
  const [activeDay, setActiveDay] = useState(initial.trip.start);
  const [kind, setKind] = useState<Selection["kind"]>(target?.category ?? "activities");
  const [listingId, setListingId] = useState(target?.id ?? "");
  const [roomId, setRoomId] = useState(target?.rooms[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [savedVersion, setSavedVersion] = useState("");
  const [guideRequestsToResolve, setGuideRequestsToResolve] = useState<{ id: string; reference: string; status: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Read browser storage after hydration. No names or contact details are stored.
    async function load() {
      let next = initial, restored = false, note = "";
      try {
        const result = restoreDraft(window.localStorage.getItem(storageKey));
        note = result.message;
        if (result.draft && result.draft.editing?.id === initial.editing?.id) { next = result.draft; restored = true; }
        else window.localStorage.removeItem(storageKey);
      } catch { note = "This browser cannot save a draft. You can still plan in this tab."; }
      if (!restored && target) next = { ...next, trip: { ...next.trip, destinationIds: [target.destinationId ?? target.id] } };
      if (!next.saveKey) next = { ...next, saveKey: crypto.randomUUID() };
      if (cancelled) return;
      setDraft(next); setSettings(next.trip); setPersist(restored); setStorageMessage(note);
      setMessage(""); setSavedVersion(""); setQuote(null); setPendingDates(null); setDiscarding(false);
      setActiveDay(next.trip.start); setQuantity(target?.category === "activities" ? next.trip.people : 1);
      setStep(addId && restored && tripSchema.safeParse(next.trip).success ? 2 : 1);
      setReady(true);
    }
    void load();
    return () => { cancelled = true; };
  }, [initial, addId, target, storageKey]);
  useEffect(() => {
    if (!ready || !persist) return;
    const valid = deviceDraftSchema.safeParse(draft);
    if (!valid.success) return;
    // Storage errors must not erase the editable in-memory draft.
    void Promise.resolve().then(() => {
      try { window.localStorage.setItem(storageKey, JSON.stringify(valid.data)); }
      catch { setStorageMessage("Your browser could not save this draft. Keep this tab open while planning."); }
    });
  }, [draft, ready, persist, storageKey]);

  const days = calendarDays(draft.trip.start, draft.trip.end);
  const day = days.includes(activeDay) ? activeDay : days[0] ?? "";
  const destinations = catalogue.filter(l => l.category === "destinations");
  const listing = catalogue.find(l => l.id === listingId && l.category === kind);
  const choices = catalogue.filter(l => l.category === kind && draft.trip.destinationIds.includes(l.destinationId ?? l.id));
  function title(item: Selection) {
    const listing = catalogue.find(l => l.id === item.listingId);
    const room = listing?.rooms.find(r => r.id === item.roomId);
    return listing ? `${listing.title}${room ? ` · ${room.title}` : ""}` : "Unavailable selection";
  }
  function mapStopsForDay(value: string): MapStop[] {
    return draft.items.filter((item) => item.day === value).flatMap((item) => {
      const listing = catalogue.find((entry) => entry.id === item.listingId);
      if (!listing) return [];
      return [{ id: listing.id, title: title(item), location: listing.location ?? "Chitral",
        latitude: listing.latitude, longitude: listing.longitude, visitorNote: listing.visitorNote, reviewed: listing.reviewed }];
    });
  }
  function edit(next: DeviceDraft) { setDraft(next); setPersist(true); setQuote(null); setMessage(""); }
  function applySettings(next: Settings) {
    const nextDays = calendarDays(next.start, next.end);
    const datesChanged = next.start !== draft.trip.start || next.end !== draft.trip.end;
    edit({ ...draft, trip: next, items: datesChanged ? draft.items.filter(i => nextDays.includes(i.day)) : draft.items });
    setPendingDates(null); setActiveDay(nextDays[0]); setStep(2);
  }
  function continueSettings() {
    const valid = tripSchema.safeParse(settings);
    if (!valid.success) { setMessage(valid.error.issues[0].message); return; }
    const impact = dateImpact(draft.items, valid.data);
    const changed = draft.trip.start !== valid.data.start || draft.trip.end !== valid.data.end;
    if (changed && (impact.removed.length || impact.checkout.length)) { setPendingDates(valid.data); return; }
    applySettings(valid.data);
  }
  function addSelection() {
    if (!listing || !choices.some(l => l.id === listing.id)) { setMessage("Choose an item in one of your trip destinations."); return; }
    if (kind === "hotels" && !listing.rooms.some(r => r.id === roomId)) { setMessage("Choose an available room type."); return; }
    const replacement = draft.items.find(i => i.day === day && i.kind === kind && (["hotels", "guides"].includes(kind) || i.listingId === listing.id));
    if (!replacement && draft.items.length >= limits.items) { setMessage(`Use at most ${limits.items} items in one trip.`); return; }
    const item: Selection = { id: replacement?.id ?? crypto.randomUUID(), day, kind, listingId: listing.id, quantity: kind === "destinations" || kind === "guides" ? 1 : quantity, ...(kind === "hotels" ? { roomId } : {}) };
    edit({ ...draft, items: [...draft.items.filter(i => i.id !== replacement?.id), item] });
    setMessage(replacement ? "Selection replaced." : "Added to your day.");
  }
  async function review() {
    const valid = tripSchema.safeParse(draft.trip);
    if (!valid.success) { setMessage(valid.error.issues[0].message); setStep(1); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/planner/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trip: draft.trip, items: draft.items }), signal: AbortSignal.timeout(20000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(result?.lines)) throw new Error(result?.error || "The estimate could not be loaded. Your selections are still here. Try again.");
      const current = result as Quote;
      setQuote(current); setStep(3); setPersist(true);
      setDraft(previous => ({ ...previous, items: previous.items.map(i => {
        const line = current.lines.find(l => l.id === i.id);
        return line && !line.issues.length ? { ...i, previousUnitMinor: line.unitMinor } : i;
      }) }));
    } catch (error) { setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "The price check took too long. Your selections are still here. Try again."); }
    finally { setBusy(false); }
  }
  async function saveItinerary() {
    if (!quote?.valid) { setMessage("Review and repair the daily choices before saving."); return; }
    setBusy(true); setMessage(""); setSavedVersion(""); setGuideRequestsToResolve([]);
    const current = deviceDraftSchema.parse({ ...draft, saveKey: draft.saveKey ?? crypto.randomUUID() });
    setDraft(current); setPersist(true);
    let stored = true;
    try { window.localStorage.setItem(storageKey, JSON.stringify(current)); } catch { stored = false; }
    const input = { key: current.saveKey, title: current.title?.trim() || "My Chitral trip", tripId: current.editing?.id, revision: current.editing?.revision, plan: { trip: current.trip, items: current.items } };
    try {
      const response = await fetch("/api/trips/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(65000) });
      const result = await response.json().catch(() => null);
      if (Array.isArray(result?.requests)) setGuideRequestsToResolve(result.requests);
      if (response.status === 401) {
        if (!stored) { setMessage("This browser cannot keep your draft across sign-in. Sign in in another tab, then return here and retry."); return; }
        router.push(`/account/sign-in?next=${encodeURIComponent(current.editing ? `/my-trips/${current.editing.id}/edit` : "/plan")}`);
        return;
      }
      if (!response.ok || !result?.id) {
        if (result?.conflict && result.tripId) setSavedVersion(`/my-trips/${result.tripId}`);
        if (result?.quote) {
          const updated = result.quote as Quote;
          setQuote(updated); setStep(3);
          setDraft(previous => ({ ...previous, items: previous.items.map(i => {
            const line = updated.lines.find(l => l.id === i.id);
            return line && !line.issues.length ? { ...i, previousUnitMinor: line.unitMinor } : i;
          }) }));
        }
        throw new Error(result?.error || "We could not confirm the save. Your draft is preserved. Retry Save itinerary safely.");
      }
      setPersist(false);
      // Do not erase a different draft edited in another tab during the request.
      try { if (window.localStorage.getItem(storageKey) === JSON.stringify(current)) window.localStorage.removeItem(storageKey); } catch { /* The confirmed server copy remains available. */ }
      router.push(`/my-trips/${result.id}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "The save took too long to confirm. Your draft is preserved. Retry Save itinerary safely."); }
    finally { setBusy(false); }
  }
  if (!ready) return <p className="route-loading" role="status">Loading your draft…</p>;
  const replacement = draft.items.some(i => i.day === day && i.kind === kind && (["hotels", "guides"].includes(kind) || i.listingId === listingId));
  const impact = pendingDates ? dateImpact(draft.items, pendingDates) : null;
  return <fieldset className="plan-controls" disabled={busy}>
    <p className="plan-storage">Draft stays on this device for 24 hours. It is not a booking. {storageMessage}</p>
    <nav className="plan-steps" aria-label="Planner steps">{["Trip details", "Plan your days", "Review budget"].map((name, index) => <button key={name} disabled={busy} type="button" aria-current={step === index + 1 ? "step" : undefined} onClick={() => {
      if (index === 2) { void review(); return; }
      if (index === 1 && !tripSchema.safeParse(draft.trip).success) { setMessage("Complete Trip details first."); setStep(1); return; }
      if (index === 0) setSettings(draft.trip);
      setStep(index + 1); setMessage("");
    }}>{index + 1}. {name}</button>)}</nav>
    {addId && <p className="plan-notice">{target ? `Add ${target.title}: choose its destination in Trip details, then choose a day and add it below.` : "That listing is no longer available. You can choose another place below."}</p>}
    {message && <p className="plan-notice" role="status">{message}</p>}
    {guideRequestsToResolve.length > 0 && <ul className="plan-notice">{guideRequestsToResolve.map(request => <li key={request.id}><Link className="text-link" href={`/my-trips/requests/${request.id}`}>{request.reference} · {request.status} · review guide request</Link></li>)}</ul>}
    {savedVersion && <div className="plan-notice"><p><Link className="text-link" href={savedVersion}>Open saved version</Link> · Your current edits stay on this device.</p><button className="secondary" type="button" onClick={() => {
      try { window.localStorage.removeItem(storageKey); } catch { setMessage("Your browser could not clear the old draft. Clear its site storage before reloading."); return; }
      setPersist(false); router.push(`${savedVersion}/edit`); router.refresh();
    }}>Discard these edits and reload saved version</button></div>}
    {busy && <p role="status">Refreshing current prices…</p>}
    {step === 1 && <section aria-labelledby="trip-details-title"><h2 id="trip-details-title">Trip details</h2>
      <form className="plan-settings" onSubmit={e => { e.preventDefault(); continueSettings(); }}>
        <label>Trip name (optional)<input maxLength={160} value={draft.title ?? ""} placeholder="My Chitral trip" onChange={e => { setDraft({ ...draft, title: e.target.value }); setPersist(true); }} /></label>
        <label>Start date<input type="date" min="2020-01-01" max="2100-12-31" required value={settings.start} onChange={e => { setSettings({ ...settings, start: e.target.value }); setPendingDates(null); }} /></label>
        <label>End date<input type="date" min="2020-01-01" max="2100-12-31" required value={settings.end} onChange={e => { setSettings({ ...settings, end: e.target.value }); setPendingDates(null); }} /></label>
        <label>People<input type="number" min={1} max={limits.people} required value={settings.people} onChange={e => { setPendingDates(null); setSettings({ ...settings, people: Math.max(1, Math.min(limits.people, Number(e.target.value) || 1)) }); }} /></label>
        <label>Budget in PKR (optional)<input inputMode="decimal" maxLength={11} placeholder="Leave blank if undecided" value={settings.budget} onChange={e => { setPendingDates(null); setSettings({ ...settings, budget: e.target.value }); }} /></label>
        <fieldset><legend>Destinations</legend>{destinations.map(d => <label className="plan-check" key={d.id}><input type="checkbox" checked={settings.destinationIds.includes(d.id)} onChange={e => { setPendingDates(null); setSettings({ ...settings, destinationIds: e.target.checked ? [...settings.destinationIds, d.id].slice(0, limits.destinations) : settings.destinationIds.filter(id => id !== d.id) }); }} />{d.title}</label>)}
          {settings.destinationIds.filter(id => !destinations.some(d => d.id === id)).map(id => <label className="plan-check" key={id}><input type="checkbox" checked onChange={() => setSettings({ ...settings, destinationIds: settings.destinationIds.filter(d => d !== id) })} />Unavailable destination · untick to remove</label>)}
        </fieldset>
        <p>Up to {limits.days} calendar days and {limits.people} people. Dates use Asia/Karachi. Hotel nights end on the day before checkout.</p>
        <button type="submit" disabled={busy}>Continue to days</button>
      </form>
      {pendingDates && impact && <div className="plan-notice" role="region" aria-label="Confirm date changes"><h3>Check these date changes</h3>
        {!!impact.removed.length && <><p>These items fall outside the new dates and will be removed:</p><ul>{impact.removed.map(i => <li key={i.id}>{dateLabel(i.day)} · {title(i)}</li>)}</ul></>}
        {!!impact.checkout.length && <><p>These hotel choices become checkout-day choices and will charge zero nights:</p><ul>{impact.checkout.map(i => <li key={i.id}>{dateLabel(i.day)} · {title(i)}</li>)}</ul></>}
        <div className="plan-actions"><button type="button" onClick={() => applySettings(pendingDates)}>Apply date changes</button><button className="secondary" type="button" onClick={() => { setPendingDates(null); setSettings(draft.trip); }}>Keep current dates</button></div>
      </div>}
    </section>}
    {step === 2 && <section aria-labelledby="day-plan-title"><h2 id="day-plan-title">Plan your days</h2><p>{days.length} calendar days · {Math.max(0, days.length - 1)} hotel {days.length === 2 ? "night" : "nights"} · {draft.trip.people} people</p>
      <p>Add a hotel to each overnight day you want to include. Unselected hotel nights are not included in the estimate.</p>
      <div className="plan-day-picker"><label>Choose a day<select value={day} onChange={e => setActiveDay(e.target.value)}>{days.map((d, index) => <option key={d} value={d}>Day {index + 1} · {dateLabel(d)}</option>)}</select></label></div>
      <AssistantDrawer contextListingId={mapStopsForDay(day)[0]?.id ?? draft.trip.destinationIds[0]} />
      <form className="plan-add" onSubmit={e => { e.preventDefault(); addSelection(); }}>
        <h3>Add or replace an item</h3>
        <label>Item type<select value={kind} onChange={e => { const next = e.target.value as Selection["kind"]; setKind(next); setListingId(""); setRoomId(""); setQuantity(next === "activities" ? draft.trip.people : 1); }}>{Object.entries(categoryLabels).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label>
        <label>Choose {categoryLabels[kind].toLowerCase()}<select value={choices.some(l => l.id === listingId) ? listingId : ""} onChange={e => { const l = choices.find(l => l.id === e.target.value); setListingId(e.target.value); setRoomId(l?.rooms[0]?.id ?? ""); }} required><option value="">Choose an item</option>{choices.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
        {!choices.length && <p>No published choices for this destination and item type.</p>}
        {kind === "hotels" && <label>Room type<select value={roomId} required onChange={e => setRoomId(e.target.value)}><option value="">Choose a room</option>{listing?.rooms.map(r => <option key={r.id} value={r.id}>{r.title} · holds {r.capacity} · {r.nightlyMinor === null ? "price unknown" : money(r.nightlyMinor)} / room / night</option>)}</select></label>}
        {(kind === "hotels" || kind === "activities") && <label>{kind === "hotels" ? "Number of rooms" : "Activity participants"}<input type="number" min={1} max={kind === "activities" ? draft.trip.people : limits.rooms} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(kind === "activities" ? draft.trip.people : limits.rooms, Number(e.target.value) || 1)))} /></label>}
        {kind === "guides" && <p>One estimated group fee per service day. This does not request or confirm a guide.</p>}
        {kind === "hotels" && day === draft.trip.end && <p>Checkout day: zero hotel nights will be charged. Extend your trip dates if you need another night.</p>}
        <button disabled={busy || !listing || !choices.some(l => l.id === listing.id)} type="submit">{replacement ? "Replace selection" : "Add to day"}</button>
      </form>
      <div className="plan-days">{days.map((d, index) => <section className="plan-day" key={d}><h3>Day {index + 1} · {dateLabel(d)}</h3>
        {!!draft.items.some(i => i.day === d) && <MapDrawer label={`Open Day ${index + 1} map`} stops={mapStopsForDay(d)} />}
        {!draft.items.some(i => i.day === d) && <p>No items yet. <button className="text-button" type="button" onClick={() => setActiveDay(d)}>Choose this day</button></p>}
        {draft.items.filter(i => i.day === d).map(item => <article className="plan-item" key={item.id}><p><strong>{title(item)}</strong><br />{categoryLabels[item.kind]}{item.kind === "hotels" && d === draft.trip.end && " · checkout day, zero nights"}</p>
          {(item.kind === "hotels" || item.kind === "activities") && <label>{item.kind === "hotels" ? "Rooms" : "Participants"} for {title(item)}<input type="number" min={1} max={item.kind === "activities" ? draft.trip.people : limits.rooms} value={item.quantity} onChange={e => edit({ ...draft, items: draft.items.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, Math.min(item.kind === "activities" ? draft.trip.people : limits.rooms, Number(e.target.value) || 1)) } : i) })} /></label>}
          <button className="secondary" type="button" aria-label={`Remove ${title(item)} from ${dateLabel(d)}`} onClick={() => edit({ ...draft, items: draft.items.filter(i => i.id !== item.id) })}>Remove</button>
        </article>)}
      </section>)}</div>
      {draft.items.some(i => !days.includes(i.day)) && <section className="plan-notice"><h3>Items outside these dates</h3>{draft.items.filter(i => !days.includes(i.day)).map(item => <p key={item.id}>{dateLabel(item.day)} · {title(item)} <button type="button" className="text-button" onClick={() => edit({ ...draft, items: draft.items.filter(i => i.id !== item.id) })}>Remove outside-date item</button></p>)}</section>}
      <button type="button" disabled={busy} onClick={() => void review()}>Review current budget</button>
    </section>}
    {step === 3 && quote && <section aria-labelledby="budget-title"><h2 id="budget-title">Your estimated budget</h2>
      <p>{quote.days.length} calendar days · {quote.nights} hotel {quote.nights === 1 ? "night" : "nights"} · {draft.trip.people} people</p>
      <p>Only selected hotel nights and services are included below.</p>
      <p>Prices refreshed {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(new Date(quote.refreshedAt))} (Asia/Karachi).</p>
      {!draft.items.length && <p>No paid items selected yet. Add rooms, activities or a guide to build your estimate.</p>}
      {!quote.valid && <p className="plan-notice" role="status">Some choices need attention. Your valid selections are still editable.</p>}
      {quote.issues.map((issue, i) => <p className="plan-notice" key={i}>{issue}</p>)}
      {quote.days.map((d, index) => <section className="plan-day" key={d}><h3>Day {index + 1} · {dateLabel(d)}</h3>{!quote.lines.some(l => l.day === d) && <p>No items selected.</p>}
        {quote.lines.filter(l => l.day === d).map(line => <article key={line.id} className="plan-quote-item"><h4>{line.title}</h4>
          <p>{line.unitMinor === null ? "Price unknown" : line.unitMinor === 0 ? "Free" : money(line.unitMinor)} · {line.unit}</p>
          <p>{line.quantity} {line.unit.startsWith("per room") ? `room(s) × ${line.nights} night(s)` : line.unit === "per person" ? "participant(s)" : "group / visit"} · {line.issues.length ? "Needs attention" : line.totalMinor === null ? "Not included in known subtotal" : money(line.totalMinor)}</p>
          {line.changed && <p className="plan-notice">Price changed: {line.previousUnitMinor == null ? "unknown" : money(line.previousUnitMinor)} → {line.unitMinor === null ? "unknown" : money(line.unitMinor)} per unit.</p>}
          {line.issues.map((issue, i) => <p className="plan-notice" key={i}>{issue}</p>)}
        </article>)}
      </section>)}
      {quote.lines.filter(l => !quote.days.includes(l.day)).map(line => <p className="plan-notice" key={line.id}>{line.title}: outside the trip dates. Return to days to remove it or restore its date.</p>)}
      <div className="plan-total"><h3>Known subtotal · {money(quote.knownTotalMinor)}</h3><p>{quote.unknownCount} {quote.unknownCount === 1 ? "item has an unknown price" : "items have unknown prices"}. Unknown costs are not counted as free.</p>
        {quote.budgetMinor !== null && <p>Budget · {money(quote.budgetMinor)}. {quote.knownTotalMinor > quote.budgetMinor ? `Known costs exceed it by ${money(quote.knownTotalMinor - quote.budgetMinor)}.` : `${money(quote.budgetMinor - quote.knownTotalMinor)} remains before unknown costs.`}</p>}
        <p>Estimate only. Guide fees are estimated per group per day. Transport, meals and other unlisted costs are not included. Confirm availability and prices with providers.</p>
      </div>
      <div className="plan-actions"><button className="secondary" type="button" onClick={() => setStep(2)}>Edit daily choices</button><button disabled={busy} type="button" onClick={() => void review()}>Refresh prices</button></div>
      <p>Save your itinerary to reopen it later and print a summary. An account is needed to save.</p>
      <button type="button" disabled={busy || !quote.valid} onClick={() => void saveItinerary()}>{busy ? "Saving…" : "Save itinerary"}</button>
    </section>}
    <div className="plan-bottom"><Link className="text-link" href="/explore">Browse more places</Link><button className="text-button" type="button" onClick={() => setDiscarding(true)}>Discard this draft</button></div>
    {discarding && <div className="plan-notice" role="region" aria-label="Discard confirmation"><p>Remove this draft from this device? This clears all your day choices.</p><div className="plan-actions"><button type="button" onClick={() => {
      let note = "";
      try { window.localStorage.removeItem(storageKey); } catch { note = "Cleared in this tab. Your browser could not clear saved storage."; }
      if (initial.editing) {
        if (note) { setStorageMessage(note); setDiscarding(false); return; }
        setPersist(false); router.push(`/my-trips/${initial.editing.id}`); return;
      }
      const fresh = newDraft(initial.trip.start); setPersist(false); setDraft(fresh); setSettings(fresh.trip); setQuote(null); setStep(1); setMessage("Draft discarded."); setStorageMessage(note); setDiscarding(false);
    }}>Discard draft</button><button type="button" className="secondary" onClick={() => setDiscarding(false)}>Keep planning</button></div></div>}
  </fieldset>;
}
