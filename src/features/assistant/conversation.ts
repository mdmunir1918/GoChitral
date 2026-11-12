import { z } from "zod";
import type { Listing, Category } from "@/features/catalogue/types";
import { rankListings, interests, type Interest } from "@/features/recommendations/rank";
import { calendarDays, limits, type PlannerListing } from "@/features/planner/model";
import { generateAssistantPlan, type AssistantPlan } from "@/features/planner/assistant";

const dateField = z.union([z.literal(""), z.iso.date()]);
const interest = z.enum(interests);
export const assistantContextSchema = z.object({
  mode: z.enum(["itinerary", "browse"]).nullable(),
  start: dateField,
  end: dateField,
  people: z.number().int().min(1).max(limits.people),
  days: z.number().int().min(1).max(limits.days).nullable(),
  budget: z.string().regex(/^\d{0,8}(\.\d{1,2})?$/),
  destinationIds: z.array(z.string().min(1).max(100)).max(limits.destinations),
  interests: z.array(interest).max(interests.length),
}).strict();
export const assistantMessageSchema = z.object({
  message: z.string().trim().min(1).max(500),
  context: assistantContextSchema,
}).strict();
export type AssistantContext = z.infer<typeof assistantContextSchema>;
export type AssistantCard = { id: string; category: Category; slug: string; title: string; location: string; summary: string; price: number | null; priceUnit: string; score: number | null; reasons: string[] };
export type AssistantTurn = { text: string; context: AssistantContext; cards?: AssistantCard[]; plan?: AssistantPlan };

const interestWords: Record<Interest, string[]> = {
  culture: ["culture", "kalasha", "tradition", "craft"],
  hiking: ["hiking", "hike", "trek", "trail"],
  nature: ["nature", "valley", "river", "forest", "landscape"],
  history: ["history", "historic", "museum", "heritage", "fort"],
  family: ["family", "children", "kids"],
  food: ["food", "restaurant", "meal", "cuisine"],
  photography: ["photography", "photograph", "photo", "viewpoint", "scenery"],
  wildlife: ["wildlife", "birds", "birdwatching", "animals"],
};

function numberValue(value: string) {
  const named: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  return named[value.toLowerCase()] ?? Number(value);
}
function extractPeople(message: string) {
  const match = message.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:people|persons?|travellers?|travelers?|guests?|adults?)\b/i)
    ?? message.match(/\bfamily\s+of\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  return match ? numberValue(match[1]) : undefined;
}
function extractDays(message: string) {
  const match = message.match(/\b(\d{1,2})\s*[- ]?\s*days?\b/i);
  const value = match ? Number(match[1]) : undefined;
  return value && value <= limits.days ? value : undefined;
}
function extractBudget(message: string) {
  const match = message.match(/\b(?:pkr|rs\.?|rupees?|budget(?:\s+(?:is|of|around))?)\s*([\d,]+(?:\.\d{1,2})?)\s*(k|thousand)?\b/i)
    ?? message.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(k|thousand)\b/i);
  if (!match) return undefined;
  const raw = match[1].replaceAll(",", "");
  const multiplier = /^(k|thousand)$/i.test(match[2] ?? "") ? 1000 : 1;
  const value = Number(raw) * multiplier;
  return Number.isFinite(value) && value > 0 ? String(value) : undefined;
}
function categoryFrom(message: string): Category | undefined {
  if (/\b(hotel|hotels|stay|stays|guesthouse|room|rooms|accommodation)\b/i.test(message)) return "hotels";
  if (/\b(guide|guides|hiking guide|local guide)\b/i.test(message)) return "guides";
  if (/\b(activity|activities|things to do|do in|visit|attraction|museum)\b/i.test(message)) return "activities";
  if (/\b(destination|destinations|place|places|valley|town)\b/i.test(message)) return "destinations";
  return undefined;
}
function matchingInterests(message: string): Interest[] {
  const lower = message.toLowerCase();
  return interests.filter((value) => interestWords[value].some((word) => lower.includes(word)));
}
function cardFor(listing: Listing, score: number | null, reasons: string[]): AssistantCard {
  const price = listing.category === "hotels" ? listing.fromNightlyMinor ?? null : listing.servicePriceMinor ?? null;
  return { id: listing.id, category: listing.category, slug: listing.slug, title: listing.title, location: listing.location, summary: listing.summary,
    price, priceUnit: listing.category === "hotels" ? "per night" : listing.category === "activities" || listing.category === "guides" ? "per service" : "", score, reasons };
}

export function replyToAssistant(message: string, previous: AssistantContext, listings: Listing[], plannerListings: PlannerListing[], dates: { start: string; end: string }): AssistantTurn {
  const text = message.trim();
  const lower = text.toLowerCase();
  const destinationRows = listings.filter((item) => item.category === "destinations" && item.status === "published");
  const foundDestinations = destinationRows.filter((item) => lower.includes(item.title.toLowerCase()) || lower.includes(item.slug.replaceAll("-", " ")) || lower.includes(item.slug.split("-")[0]));
  const next: AssistantContext = {
    ...previous,
    mode: /\b(plan|itinerary|trip|travel plan)\b/i.test(text) ? "itinerary" : previous.mode ?? "browse",
    start: dates.start || previous.start,
    end: dates.end || previous.end,
    people: extractPeople(text) ?? previous.people,
    days: extractDays(text) ?? previous.days,
    budget: extractBudget(text) ?? previous.budget,
    destinationIds: foundDestinations.length ? foundDestinations.map((item) => item.id) : previous.destinationIds,
    interests: matchingInterests(text).length ? matchingInterests(text) : previous.interests,
  };

  if (next.mode === "itinerary") {
    const missing: string[] = [];
    if (!next.start) missing.push("your start date (choose it above)");
    if (!next.budget) missing.push("your total budget in PKR");
    const validDestinations = next.destinationIds.filter((id) => destinationRows.some((item) => item.id === id));
    if (!validDestinations.length) missing.push(`which Chitral place you want to visit${destinationRows.length ? ` (${destinationRows.map((item) => item.title).join(" or ")})` : ""}`);
    let days = next.days;
    if (next.start && next.end) days = calendarDays(next.start, next.end).length || null;
    if (!days) missing.push("how many days you have");
    if (missing.length) return { context: next, text: `I can draft that trip. Please tell me ${missing.join(", ")}. For example: “3 days, 4 people, PKR 50,000, Bumburet Valley, nature and culture.”` };
    if (days! > 14) return { context: next, text: "I can draft trips up to 14 days at a time. Please choose a shorter date range or number of days." };
    if (next.people > limits.people) return { context: next, text: `I can plan for up to ${limits.people} people at a time.` };
    const end = next.end || new Date(Date.parse(`${next.start}T00:00:00Z`) + (days! - 1) * 86_400_000).toISOString().slice(0, 10);
    try {
      const plan = generateAssistantPlan({ start: next.start, days: days!, people: next.people, budget: next.budget, destinationIds: validDestinations, interests: next.interests.length ? next.interests : ["nature"] }, listings, plannerListings);
      return { context: { ...next, end, days }, plan, text: `I made a ${days}-day draft for ${validDestinations.map((id) => destinationRows.find((item) => item.id === id)?.title).filter(Boolean).join(" and ")}. Review the unpriced items before relying on the estimate. You can refine the trip by telling me what you want to change.` };
    } catch {
      return { context: next, text: "I couldn’t make that draft from the current published listings. Try another Chitral destination or check back after the catalogue is updated." };
    }
  }

  const category = categoryFrom(text);
  const destinationId = foundDestinations[0]?.id ?? next.destinationIds[0];
  const interestsMentioned = matchingInterests(text);
  const hasCatalogueIntent = Boolean(category || foundDestinations.length || interestsMentioned.length || next.destinationIds.length || next.interests.length || next.budget);
  if (!hasCatalogueIntent) return { context: next, text: "I can help find published Chitral stays, activities and guides, or draft a Chitral trip. I can’t book flights or answer questions outside the GoChitral catalogue in this local demo." };
  const priceTargetMinor = next.budget ? Math.round(Number(next.budget) * 100) : undefined;
  const ranked = rankListings(listings, { ...(destinationId ? { destinationId } : {}), interests: next.interests, ...(priceTargetMinor ? { priceTargetMinor } : {}) })
    .filter((entry) => !category || entry.listing.category === category)
    .filter((entry) => entry.listing.category !== "destinations")
    .slice(0, 3);
  if (ranked.length) return { context: next,
    text: `Here are published ${category ?? "local"} listings${destinationId ? ` for ${destinationRows.find((item) => item.id === destinationId)?.title ?? "your selected place"}` : ""}. The order uses your stated interests and budget where the catalogue has that information.`,
    cards: ranked.map((entry) => cardFor(entry.listing, entry.score, [...entry.reasons, ...entry.missingSignals])) };
  return { context: next, text: "I can help with published Chitral hotels, activities, guides and trip drafts. Tell me a place or try one of the sample questions below. This local demo does not have live availability or answers beyond GoChitral’s catalogue." };
}
