import assert from "node:assert/strict";
import { rankListings, type RecommendationPreferences } from "./rank";
import type { Listing } from "@/features/catalogue/types";

function place(id: string, overrides: Partial<Listing> = {}): Listing {
  return { id, slug: id, category: "activities", title: "River viewpoint walk", location: "Bumburet", summary: "A nature walk beside the river.", description: "A short valley walk.", visitorNote: "Ask before entering a private area.", reviewed: "2026-01-01", status: "published", photo: { src: "/images/chitral.webp", width: 800, height: 600, alt: "A valley", caption: "", author: "", original: "https://example.test/photo", license: "4.0" }, destinationId: "dest", latitude: 35.7, longitude: 71.68, servicePriceMinor: 1000, ...overrides } as Listing;
}

function verify() {
  const destination = { ...place("dest", { category: "destinations", destinationId: undefined, title: "Bumburet Valley" }), latitude: 35.7, longitude: 71.68 } as Listing;
  const first = place("first"), tied = place("second");
  const scored = rankListings([destination, first, tied], { destinationId: "dest", interests: ["nature"], priceTargetMinor: 500 });
  assert.equal(scored[0].listing.id, "first");
  assert.equal(scored[0].score, 0.85, "Weighted 1.0, 0.5, 1.0 signals produce 0.85.");
  assert.deepEqual(scored.map((item) => item.listing.id), ["first", "second"], "Equal scores preserve catalogue order.");
  const missingPrice = rankListings([place("unknown", { servicePriceMinor: null })], { destinationId: "dest", interests: ["nature"], priceTargetMinor: 1000 });
  assert(missingPrice[0].missingSignals.some((signal) => signal.startsWith("Price not listed")));
  assert.equal(missingPrice[0].score, 1, "Missing price is omitted and remaining weights are renormalized.");
  const noSignals = rankListings([tied, first], { interests: [] });
  assert.deepEqual(noSignals.map((item) => item.listing.id), ["second", "first"]);
  assert.equal(noSignals[0].score, null, "No available signals use catalogue order without inventing a score.");
  assert.equal(rankListings([first], { destinationId: "other", interests: [] }).length, 0, "Destination constraints filter ineligible options.");


  // These easy-to-read, in-memory records demonstrate the page's real ranking function.
  // No fixture is written to PostgreSQL. roomCount represents hotel capacity; it is
  // intentionally not a ranking signal in Module 11.
  const demos: Listing[] = [
    { ...destination, id: "demo-dest-bumburet", slug: "demo-bumburet", title: "Demo Bumburet", latitude: 35.698814, longitude: 71.6858 },
    { ...destination, id: "demo-dest-town", slug: "demo-chitral-town", title: "Demo Chitral Town", latitude: 35.8462, longitude: 71.7858 },
    place("demo-trail", { title: "Forest hiking trail", summary: "A nature walk in the valley.", destinationId: "demo-dest-bumburet", servicePriceMinor: 250_000, latitude: 35.6989, longitude: 71.686 }),
    place("demo-museum", { title: "Chitral history museum", summary: "Regional heritage galleries.", destinationId: "demo-dest-town", servicePriceMinor: 80_000, latitude: 35.8462, longitude: 71.7858 }),
    place("demo-unpriced-walk", { title: "Family riverside picnic", summary: "A nature outing for families.", description: "A quiet picnic place beside the river.", visitorNote: "Check access before visiting.", destinationId: "demo-dest-bumburet", servicePriceMinor: null, latitude: 35.699, longitude: 71.686 }),
    place("demo-hotel", { category: "hotels", title: "Family riverside hotel", summary: "Family rooms beside the river.", description: "A family hotel with shared rooms.", visitorNote: "Confirm capacity and rates before you book.", destinationId: "demo-dest-bumburet", fromNightlyMinor: 900_000, roomCount: 12, latitude: 35.7, longitude: 71.687 }),
    place("demo-guide", { category: "guides", title: "Mountain hiking guide", summary: "Guided hikes around Bumburet.", description: "A local guide service.", visitorNote: "Confirm schedule before booking.", destinationId: "demo-dest-bumburet", servicePriceMinor: 400_000, latitude: 35.699, longitude: 71.686, guideProfile: { languages: ["Khowar", "English"], expertise: ["Hiking"], areasServed: ["Bumburet"], credentialSummary: "Demo profile", pricingUnit: "per_group_day" } }),
  ];
  const inputs: RecommendationPreferences[] = [
    { destinationId: "demo-dest-bumburet", interests: ["nature", "hiking"], priceTargetMinor: 500_000 },
    { destinationId: "demo-dest-town", interests: ["history"], priceTargetMinor: 300_000 },
  ];
  const demonstrations = inputs.map((input) => {
    const results = rankListings(demos, input);
    assert.deepEqual(rankListings(demos, input), results, "Identical inputs must return identical order and scores.");
    return { input: { ...input, priceTargetPKR: input.priceTargetMinor === undefined ? null : input.priceTargetMinor / 100 }, results: results.map(({ listing, score, reasons, missingSignals }) => ({ id: listing.id, score, reasons, missingSignals })) };
  });
  assert.deepEqual(demonstrations[0].results.map((result) => result.id), ["demo-trail", "demo-guide", "demo-unpriced-walk", "demo-hotel"]);
  assert.equal(demonstrations[0].results.find((result) => result.id === "demo-trail")?.score, 1);
  assert.equal(demonstrations[0].results.find((result) => result.id === "demo-guide")?.score, 0.75);
  assert.equal(demonstrations[0].results.find((result) => result.id === "demo-hotel")?.score, 0.62);
  assert.equal(demonstrations[0].results.find((result) => result.id === "demo-unpriced-walk")?.score, 0.64, "Missing price is omitted and remaining signals are renormalized.");
  assert.deepEqual(demonstrations[1].results.map((result) => result.id), ["demo-museum"]);
  assert.equal(demonstrations[1].results[0].score, 1);
  const smallerCapacity = demos.map((item) => item.id === "demo-hotel" ? { ...item, roomCount: 1 } as Listing : item);
  const scoreView = (rows: ReturnType<typeof rankListings>) => rows.map(({ listing, score, reasons, missingSignals }) => ({ id: listing.id, score, reasons, missingSignals }));
  assert.deepEqual(scoreView(rankListings(smallerCapacity, inputs[0])), scoreView(rankListings(demos, inputs[0])), "Changing room capacity alone does not affect the current score.");
  assert.deepEqual(rankListings(demos, { destinationId: "missing-destination", interests: [] }), [], "No eligible listings returns an empty list.");
  console.log("Module 11 isolated recommendation demo (money values are minor units in scores; PKR shown in inputs):");
  console.log(JSON.stringify(demonstrations, null, 2));
  console.log("Module 11 recommendation checks passed: repeated deterministic inputs; destination filtering; score reasons; no eligible listings; missing price; hotel capacity is not a ranking signal. No database rows were written.");
}

verify();
