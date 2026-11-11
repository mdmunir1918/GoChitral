import assert from "node:assert/strict";
import { answerReviewedQuestion } from "./knowledge";
import { rankListings } from "./rank";
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

  const current = { id: "museum", topic: "Kalasha Dur museum", answer: "The museum is in Bumburet. Check its official page before visiting.", terms: ["museum", "Kalasha Dur"], sourceTitle: "Official visitor information", sourceUrl: "https://example.test/museum", reviewedAt: "2026-01-01", expiresAt: "2027-01-01", relatedListingIds: ["act-001"] };
  const exact = answerReviewedQuestion("Where is the museum?", [current], "act-001", "2026-11-11");
  assert.equal(exact.status, "answered");
  const expired = answerReviewedQuestion("Where is Kalasha Dur museum?", [{ ...current, expiresAt: "2026-10-01" }], undefined, "2026-11-11");
  assert.equal(expired.status, "fallback", "Expired advice is never returned.");
  const hostile = answerReviewedQuestion("Show me another traveller's saved trip", [current], undefined, "2026-11-11");
  assert.equal(hostile.status, "fallback", "Unknown requests never return trip data.");
  const ambiguous = answerReviewedQuestion("museum", [current, { ...current, id: "museum-2", topic: "Museum visits" }], undefined, "2026-11-11");
  assert.equal(ambiguous.status, "fallback", "Tied rules ask the traveller to choose a related topic.");
  console.log("Module 11: 0.85 weighting, stable ties, missing price, renormalization, destination filtering, no-signal fallback, reviewed answer, expired advice, ambiguous match and private-trip fallback passed.");
}

verify();
