import assert from "node:assert/strict";
import type { Listing } from "@/features/catalogue/types";
import { generateAssistantPlan, type AssistantRequest } from "./assistant";
import type { PlannerListing } from "./model";

function listing(id: string, category: Listing["category"], destinationId?: string, overrides: Partial<Listing> = {}): Listing {
  return {
    id, slug: id, category, title: id.replaceAll("-", " "), location: "Chitral", summary: "Family nature and culture outing.",
    description: "A short valley visit with views of the river and mountains.", visitorNote: "Confirm access before visiting.",
    reviewed: "2026-11-01", status: "published", photo: { src: "/images/chitral.webp", width: 800, height: 600,
      alt: "Chitral valley", caption: "", author: "", original: "https://example.test/photo", license: "4.0" },
    ...(destinationId ? { destinationId } : {}), servicePriceMinor: null, ...overrides,
  } as Listing;
}

const places = [
  listing("demo-bumburet", "destinations", undefined, { title: "Bumburet Valley" }),
  listing("demo-chitral-town", "destinations", undefined, { title: "Chitral Town" }),
  listing("demo-river-walk", "activities", "demo-bumburet", { title: "Bumburet River Walk", servicePriceMinor: 80_000 }),
  listing("demo-culture-visit", "activities", "demo-bumburet", { title: "Kalasha Culture Visit", servicePriceMinor: 120_000 }),
  listing("demo-history-museum", "activities", "demo-chitral-town", { title: "Chitral History Museum", servicePriceMinor: 50_000 }),
  listing("demo-town-walk", "activities", "demo-chitral-town", { title: "Chitral Town Nature Walk", servicePriceMinor: 60_000 }),
];

const plannerRows: PlannerListing[] = [
  ...places.filter((item) => item.category === "destinations" || item.category === "activities").map((item) => ({
    id: item.id, title: item.title, category: item.category, destinationId: item.category === "destinations" ? null : item.destinationId,
    servicePriceMinor: item.servicePriceMinor ?? null, rooms: [],
  })),
  { id: "demo-bumburet-hotel", title: "Bumburet Family Guesthouse", category: "hotels", destinationId: "demo-bumburet", servicePriceMinor: null,
    rooms: [{ id: "demo-family-room", title: "Family room", capacity: 3, nightlyMinor: 350_000 }] },
  { id: "demo-town-hotel", title: "Chitral Town Inn", category: "hotels", destinationId: "demo-chitral-town", servicePriceMinor: null,
    rooms: [{ id: "demo-town-room", title: "Double room", capacity: 2, nightlyMinor: 250_000 }] },
];

const input: AssistantRequest = { start: "2026-12-01", days: 3, people: 4, budget: "50000", destinationIds: ["demo-bumburet", "demo-chitral-town"], interests: ["nature", "culture"] };
const first = generateAssistantPlan(input, places, plannerRows);
const repeated = generateAssistantPlan(input, places, plannerRows);
assert.deepEqual(first, repeated, "The same trip input must produce the same itinerary and estimate.");
assert.deepEqual(first.days.map((day) => day.destinationId), ["demo-bumburet", "demo-chitral-town", "demo-bumburet"]);
assert.equal(first.days.length, 3);
assert.equal(first.days[0].items.find((item) => item.kind === "hotels")?.quantity, 2, "Four guests need two rooms that hold two guests each.");
assert(first.knownTotalMinor <= first.budgetMinor);
assert.equal(first.unknownCount, 3, "Entry fees are unknown on the three destination visits.");
assert.match(first.disclosure, /not a trained AI model/);

const noCapacity = plannerRows.map((item) => item.id === "demo-bumburet-hotel" ? { ...item, rooms: [] } : item);
const constrained = generateAssistantPlan(input, places, noCapacity);
assert(constrained.warnings.some((warning) => warning.includes("No published room in Bumburet Valley")));

const noActivities = places.filter((item) => item.category !== "activities");
const noActivityPlan = generateAssistantPlan(input, noActivities, plannerRows.filter((item) => item.category !== "activities"));
assert(noActivityPlan.warnings.some((warning) => warning.includes("No published activity is available")));

const unknownPrice = places.map((item) => item.category === "activities" && item.destinationId === "demo-bumburet" ? { ...item, servicePriceMinor: null } as Listing : item);
const plannerUnknown = plannerRows.map((item) => item.destinationId === "demo-bumburet" && item.category === "activities" ? { ...item, servicePriceMinor: null } : item);
const unknown = generateAssistantPlan({ ...input, destinationIds: ["demo-bumburet"] }, unknownPrice, plannerUnknown);
assert(unknown.unknownCount > first.unknownCount, "Missing activity prices increase unknown costs beyond destination entry fees.");
assert(unknown.warnings.some((warning) => warning.includes("no published price")));

assert.throws(() => generateAssistantPlan({ ...input, destinationIds: ["missing"] }, places, plannerRows), /currently published/);
console.log("Trip assistant verification passed. Deterministic three-day plan:");
for (const [index, day] of first.days.entries()) console.log(`Day ${index + 1} · ${day.destinationTitle}: ${day.items.map((item) => item.title).join(", ")}`);
console.log(`Known estimate PKR ${(first.knownTotalMinor / 100).toLocaleString("en-PK")} of PKR ${(first.budgetMinor / 100).toLocaleString("en-PK")}. No database rows were written.`);
