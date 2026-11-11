import type { Listing } from "@/features/catalogue/types";

export const interests = ["culture", "hiking", "nature", "history", "family", "food", "photography", "wildlife"] as const;
export type Interest = (typeof interests)[number];
const interestTerms: Record<Interest, string[]> = {
  culture: ["kalasha", "culture", "tradition", "village", "craft"],
  hiking: ["hike", "trail", "trek", "walk", "mountain"],
  nature: ["valley", "river", "forest", "pasture", "landscape", "nature"],
  history: ["museum", "heritage", "history", "fort", "historic"],
  family: ["family", "children", "family friendly", "easy walk"],
  food: ["food", "market", "restaurant", "meal", "local dishes"],
  photography: ["photo", "photography", "viewpoint", "scenery", "landscape"],
  wildlife: ["wildlife", "bird", "animal", "species", "nature"],
};

export type RecommendationPreferences = {
  destinationId?: string;
  interests: Interest[];
  priceTargetMinor?: number;
};
export type Recommendation = {
  listing: Listing;
  score: number | null;
  reasons: string[];
  missingSignals: string[];
  distanceKm?: number;
};

function normalized(value: string) {
  return value.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function hasPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${normalized(phrase)} `);
}
function distanceKm(a: { latitude?: number; longitude?: number }, b: { latitude?: number; longitude?: number }) {
  if (![a.latitude, a.longitude, b.latitude, b.longitude].every(Number.isFinite)) return undefined;
  const radians = Math.PI / 180;
  const lat1 = a.latitude! * radians, lat2 = b.latitude! * radians;
  const dLat = (b.latitude! - a.latitude!) * radians, dLon = (b.longitude! - a.longitude!) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function rankListings(catalogue: Listing[], preferences: RecommendationPreferences): Recommendation[] {
  const destination = catalogue.find((item) => item.category === "destinations" && item.id === preferences.destinationId);
  const candidates = catalogue.filter((item) => item.status === "published" &&
    (!preferences.destinationId || item.category !== "destinations") &&
    (!preferences.destinationId || item.destinationId === preferences.destinationId));
  return candidates.map((listing, index) => {
    const text = normalized([listing.title, listing.location, listing.summary, listing.description, listing.visitorNote,
      ...(listing.guideProfile?.expertise ?? [])].join(" "));
    const reasons: string[] = [], missingSignals: string[] = [];
    const signals: { score: number; weight: number }[] = [];
    if (preferences.interests.length) {
      const matches = preferences.interests.filter((interest) => interestTerms[interest].some((term) => hasPhrase(text, term)));
      const score = matches.length / preferences.interests.length;
      signals.push({ score, weight: 0.5 });
      reasons.push(matches.length ? `Matches ${matches.map((interest) => interest).join(", ")} interests` : "Limited match to your selected interests");
    } else missingSignals.push("No interests selected; interest did not affect this score.");

    if (preferences.priceTargetMinor !== undefined) {
      const price = listing.category === "hotels" ? listing.fromNightlyMinor : listing.servicePriceMinor ?? undefined;
      if (price === undefined || price === null) missingSignals.push("Price not listed; budget did not affect this score.");
      else {
        const score = price === 0 ? 1 : Math.min(1, preferences.priceTargetMinor / price);
        signals.push({ score, weight: 0.3 });
        reasons.push(price <= preferences.priceTargetMinor ? "Within your price target" : "Above your price target");
      }
    } else missingSignals.push("No price target entered; budget did not affect this score.");

    const distance = destination ? distanceKm(listing, destination) : undefined;
    if (preferences.destinationId && distance !== undefined) {
      const score = 1 / (1 + distance / 50);
      signals.push({ score, weight: 0.2 });
      reasons.push(distance < 1 ? "At your selected destination" : `${Math.round(distance)} km from your selected destination`);
    } else missingSignals.push(preferences.destinationId ? "Coordinates unavailable; distance did not affect this score." : "No destination selected; distance did not affect this score.");

    const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
    const score = totalWeight ? Number((signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0) / totalWeight).toFixed(2)) : null;
    return { listing, score, reasons, missingSignals, distanceKm: distance, index };
  }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.index - b.index || a.listing.id.localeCompare(b.listing.id))
    .map((item) => ({ listing: item.listing, score: item.score, reasons: item.reasons, missingSignals: item.missingSignals, distanceKm: item.distanceKm }));
}
