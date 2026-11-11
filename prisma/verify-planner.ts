import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { calendarDays, dateImpact, deviceDraftSchema, draftLifetime, newDraft, quotePlan, restoreDraft, reviewSchema, type PlannerListing, type Selection } from "../src/features/planner/model";

const catalogue: PlannerListing[] = [
  { id: "destination", title: "Test valley", category: "destinations", destinationId: null, servicePriceMinor: null, rooms: [] },
  { id: "hotel", title: "Test hotel", category: "hotels", destinationId: "destination", servicePriceMinor: null, rooms: [{ id: "room", title: "Double", capacity: 2, nightlyMinor: 600000 }, { id: "unknown-room", title: "Unpriced", capacity: 2, nightlyMinor: null }] },
  { id: "activity", title: "Test activity", category: "activities", destinationId: "destination", servicePriceMinor: 150000, rooms: [] },
  { id: "unknown", title: "Unpriced activity", category: "activities", destinationId: "destination", servicePriceMinor: null, rooms: [] },
  { id: "free", title: "Free activity", category: "activities", destinationId: "destination", servicePriceMinor: 0, rooms: [] },
  { id: "guide", title: "Test guide", category: "guides", destinationId: "destination", servicePriceMinor: 500000, rooms: [] },
];
const trip = { start: "2027-06-10", end: "2027-06-12", people: 2, destinationIds: ["destination"], budget: "20000" };
function item(kind: Selection["kind"], listingId: string, day = trip.start, quantity = 1): Selection {
  return { id: randomUUID(), day, kind, listingId, quantity, ...(kind === "hotels" ? { roomId: "room" } : {}) };
}
const hotel1 = item("hotels", "hotel"), hotel2 = item("hotels", "hotel", "2027-06-11");
const activity = item("activities", "activity", trip.start, 2);
const worked = quotePlan({ trip, items: [hotel1, hotel2, activity] }, catalogue);
assert.equal(worked.valid, true); assert.equal(worked.days.length, 3); assert.equal(worked.nights, 2);
assert.equal(worked.knownTotalMinor, 1500000, "Two room nights at 6,000 plus two activity participants at 1,500 = PKR 15,000.");
assert.deepEqual(worked.lines.map(l => l.totalMinor), [600000, 600000, 300000]);
const sameDay = quotePlan({ trip: { ...trip, end: trip.start }, items: [hotel1] }, catalogue);
assert.equal(sameDay.nights, 0); assert.equal(sameDay.knownTotalMinor, 0);
assert.deepEqual(calendarDays("2028-02-28", "2028-03-01"), ["2028-02-28", "2028-02-29", "2028-03-01"]);
assert.deepEqual(calendarDays("2027-01-31", "2027-02-01"), ["2027-01-31", "2027-02-01"]);
assert.deepEqual(calendarDays("2027-02-29", "2027-03-01"), []);
const mixed = quotePlan({ trip, items: [item("activities", "unknown"), item("activities", "free")] }, catalogue);
assert.equal(mixed.unknownCount, 1); assert.equal(mixed.lines[0].totalMinor, null); assert.equal(mixed.lines[1].totalMinor, 0);
assert.equal(quotePlan({ trip, items: [{ ...hotel1, roomId: "unknown-room" }] }, catalogue).unknownCount, 1);
const crowded = quotePlan({ trip: { ...trip, people: 3 }, items: [hotel1, activity] }, catalogue);
assert.equal(crowded.valid, false); assert.match(crowded.lines[0].issues.join(" "), /hold 2/);
assert.equal(crowded.lines[1].totalMinor, 300000, "A failed room check preserves the valid activity estimate.");
assert.equal(quotePlan({ trip: { ...trip, people: 3 }, items: [{ ...hotel1, quantity: 2 }] }, catalogue).valid, true);
const guide = item("guides", "guide");
assert.equal(quotePlan({ trip, items: [guide, item("guides", "guide", "2027-06-11")] }, catalogue).knownTotalMinor, 1000000);
const duplicate = quotePlan({ trip, items: [guide, item("guides", "guide")] }, catalogue);
assert.equal(duplicate.valid, false); assert.equal(duplicate.knownTotalMinor, 500000, "A duplicate group fee cannot be charged twice on one day.");
assert.equal(quotePlan({ trip, items: [{ ...guide, quantity: 2 }] }, catalogue).valid, false);
assert.equal(quotePlan({ trip, items: [item("activities", "activity", trip.start, 3)] }, catalogue).valid, false);
const impact = dateImpact([hotel1, hotel2, item("activities", "activity", "2027-06-12")], { ...trip, end: "2027-06-11" });
assert.equal(impact.removed.length, 1); assert.equal(impact.checkout[0].id, hotel2.id);
const unavailable = quotePlan({ trip, items: [item("activities", "hidden-id"), activity] }, catalogue);
assert.equal(unavailable.valid, false); assert.equal(unavailable.lines[0].title, "Unavailable selection"); assert.equal(unavailable.knownTotalMinor, 300000);
assert.equal(quotePlan({ trip, items: [{ ...hotel1, roomId: "hidden-room" }] }, catalogue).valid, false);
assert.equal(quotePlan({ trip, items: [item("activities", "activity", "2027-07-01")] }, catalogue).valid, false);
assert.equal(quotePlan({ trip: { ...trip, destinationIds: ["hidden-destination"] }, items: [activity] }, catalogue).valid, false);
const changed = quotePlan({ trip, items: [{ ...activity, previousUnitMinor: 1, unitPriceMinor: 1, subtotal: 2 }] }, catalogue);
assert.equal(changed.lines[0].changed, true); assert.equal(changed.knownTotalMinor, 300000, "Untrusted snapshots and submitted totals cannot set current prices.");
assert.equal(quotePlan({ trip, items: [{ ...activity, previousUnitMinor: null }] }, catalogue).lines[0].changed, true);
for (const invalid of [
  { trip: { ...trip, end: "2027-06-09" }, items: [] },
  { trip: { ...trip, end: "2027-07-12" }, items: [] },
  { trip: { ...trip, people: 21 }, items: [] },
  { trip: { ...trip, budget: "-1" }, items: [] },
  { trip, items: [{ ...activity, quantity: -1 }] },
  { trip, items: Array.from({ length: 121 }, () => item("activities", "activity")) },
  { trip, items: [activity, activity] },
]) assert.equal(reviewSchema.safeParse(invalid).success, false);
const now = Date.now(), stored = { ...newDraft(trip.start, now), trip, items: [hotel1, hotel2, activity] };
assert.equal(deviceDraftSchema.safeParse(stored).success, true);
assert.deepEqual(restoreDraft(JSON.stringify(stored), now).draft, stored);
assert.equal(restoreDraft(JSON.stringify(stored), now + draftLifetime).draft, null);
assert.equal(restoreDraft(JSON.stringify({ ...stored, version: 2 }), now).draft, null);
assert.equal(restoreDraft("<script>invalid</script>", now).draft, null);
console.log("Planner: PKR 15,000 worked example, same-day zero nights, month/leap boundaries, unknown/free, room capacity, guide once/day, date impact, unavailable records, price refresh/tampering, limits and draft expiry/restore passed.");
