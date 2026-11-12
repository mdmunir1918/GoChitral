import assert from "node:assert/strict";
import type { Listing } from "@/features/catalogue/types";
import { replyToAssistant, type AssistantContext } from "./conversation";
import type { PlannerListing } from "@/features/planner/model";

function listing(id: string, category: Listing["category"], destinationId?: string, extra: Partial<Listing> = {}): Listing {
  return { id, slug: id, category, title: id === "bumburet" ? "Bumburet Valley" : id.replaceAll("-", " "), location: "Chitral",
    summary: "A family-friendly nature and hiking choice.", description: "A local demo listing.", visitorNote: "Confirm details before travel.", reviewed: "2026-11-01", status: "published",
    photo: { src: "/images/chitral.webp", width: 800, height: 600, alt: "Chitral", caption: "", author: "", original: "https://example.test/photo", license: "4.0" },
    ...(destinationId ? { destinationId } : {}), servicePriceMinor: null, ...extra } as Listing;
}

const catalogue: Listing[] = [
  listing("bumburet", "destinations"),
  listing("river-trail", "activities", "bumburet", { title: "Bumburet River Hiking Trail", servicePriceMinor: 80_000 }),
  listing("demo-family-hotel", "hotels", "bumburet", { title: "Bumburet Family Hotel", fromNightlyMinor: 300_000 }),
];
const planner: PlannerListing[] = [
  { id: "bumburet", title: "Bumburet Valley", category: "destinations", destinationId: null, servicePriceMinor: null, rooms: [] },
  { id: "river-trail", title: "Bumburet River Hiking Trail", category: "activities", destinationId: "bumburet", servicePriceMinor: 80_000, rooms: [] },
  { id: "demo-family-hotel", title: "Bumburet Family Hotel", category: "hotels", destinationId: "bumburet", servicePriceMinor: null,
    rooms: [{ id: "family-room", title: "Family room", capacity: 2, nightlyMinor: 300_000 }] },
];
const empty: AssistantContext = { mode: null, start: "", end: "", people: 2, days: null, budget: "", destinationIds: [], interests: [] };

const followup = replyToAssistant("I want a 3-day trip", empty, catalogue, planner, { start: "2026-12-01", end: "" });
assert.equal(followup.context.mode, "itinerary");
assert.match(followup.text, /budget in PKR/);
assert.match(followup.text, /which Chitral place/);

const answer = replyToAssistant("PKR 50,000 for 4 people in Bumburet Valley. We like nature and hiking.", followup.context, catalogue, planner, { start: "2026-12-01", end: "" });
assert(answer.plan);
assert.equal(answer.plan.days.length, 3);
assert.equal(answer.plan.trip.people, 4);
assert.equal(answer.plan.trip.budget, "50000");
assert.deepEqual(answer.plan.trip.destinationIds, ["bumburet"]);
assert.deepEqual(answer.plan, replyToAssistant("PKR 50,000 for 4 people in Bumburet Valley. We like nature and hiking.", followup.context, catalogue, planner, { start: "2026-12-01", end: "" }).plan);

const hotelResults = replyToAssistant("Show me family hotels in Bumburet Valley", empty, catalogue, planner, { start: "", end: "" });
assert.equal(hotelResults.cards?.[0].category, "hotels");
assert.equal(hotelResults.cards?.[0].id, "demo-family-hotel");

const unsupported = replyToAssistant("Can you book me a flight to Mars?", empty, catalogue, planner, { start: "", end: "" });
assert.equal(unsupported.plan, undefined);
assert.equal(unsupported.cards, undefined);
assert.match(unsupported.text, /can’t book flights/);
console.log("Assistant conversation verification passed: follow-up questions, multi-turn trip details, repeatable plan draft, hotel suggestions and unsupported request fallback. No database rows were written.");
