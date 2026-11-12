import { z } from "zod";
import { rankListings, interests as availableInterests, type Interest } from "@/features/recommendations/rank";
import type { Listing } from "@/features/catalogue/types";
import { calendarDays, limits, money, quotePlan, type PlannerListing, type Selection } from "./model";

const date = z.iso.date().refine((value) => value >= "2020-01-01" && value <= "2100-12-31");
const decimal = z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number.isFinite(Number(value)));
function endDate(start: string, days: number) {
  const timestamp = Date.parse(`${start}T00:00:00Z`);
  return Number.isFinite(timestamp) ? new Date(timestamp + (days - 1) * 86_400_000).toISOString().slice(0, 10) : "";
}
export const assistantRequestSchema = z.object({
  start: date,
  days: z.number().int().min(1).max(14),
  people: z.number().int().min(1).max(limits.people),
  budget: decimal,
  destinationIds: z.array(z.string().min(1).max(100)).min(1).max(limits.destinations),
  interests: z.array(z.enum(availableInterests)).max(availableInterests.length),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.destinationIds).size !== input.destinationIds.length) ctx.addIssue({ code: "custom", message: "Choose each destination once.", path: ["destinationIds"] });
  if (new Set(input.interests).size !== input.interests.length) ctx.addIssue({ code: "custom", message: "Choose each interest once.", path: ["interests"] });
  if (calendarDays(input.start, endDate(input.start, input.days)).length !== input.days) {
    ctx.addIssue({ code: "custom", message: "The selected trip dates are not valid.", path: ["start"] });
  }
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantPlanItem = { id: string; day: string; kind: Selection["kind"]; listingId: string; title: string; roomId?: string; quantity: number; unitMinor: number | null; unit: string };
export type AssistantPlanDay = { day: string; destinationId: string; destinationTitle: string; items: AssistantPlanItem[] };
export type AssistantPlan = {
  trip: { start: string; end: string; people: number; budget: string; destinationIds: string[] };
  days: AssistantPlanDay[];
  knownTotalMinor: number;
  budgetMinor: number;
  unknownCount: number;
  warnings: string[];
  disclosure: string;
};

function selectionId(index: number) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

export function generateAssistantPlan(input: AssistantRequest, publicListings: Listing[], plannerListings: PlannerListing[]): AssistantPlan {
  const parsed = assistantRequestSchema.parse(input);
  const dates = calendarDays(parsed.start, endDate(parsed.start, parsed.days));
  const destinationById = new Map(publicListings.filter((item) => item.category === "destinations" && item.status === "published").map((item) => [item.id, item]));
  const destinations = parsed.destinationIds.map((id) => destinationById.get(id));
  if (destinations.some((item) => !item)) throw new Error("Choose destinations that are currently published.");
  const budgetMinor = Math.round(Number(parsed.budget) * 100);
  const people = parsed.people;
  const warnings: string[] = [];
  const days: AssistantPlanDay[] = [];
  let itemIndex = 0;

  const hotelsByNight = dates.slice(0, -1).map((day, index) => {
    const destination = destinations[index % destinations.length]!;
    const hotels = plannerListings.filter((item) => item.category === "hotels" && item.destinationId === destination.id);
    const choices = hotels.flatMap((hotel) => hotel.rooms.map((room) => ({ hotel, room, roomCount: Math.ceil(people / room.capacity), total: room.nightlyMinor === null ? null : room.nightlyMinor * Math.ceil(people / room.capacity) })))
      .filter((choice) => choice.room.capacity > 0 && choice.roomCount <= limits.rooms)
      .sort((a, b) => (a.total ?? Number.MAX_SAFE_INTEGER) - (b.total ?? Number.MAX_SAFE_INTEGER) || a.hotel.title.localeCompare(b.hotel.title) || a.room.id.localeCompare(b.room.id));
    if (!choices.length) warnings.push(`No published room in ${destination.title} can fit your group for the night of ${day}.`);
    return { day, choice: choices.find((choice) => choice.total !== null) ?? choices[0] };
  });

  const hotelTotal = hotelsByNight.reduce((total, night) => total + (night.choice?.total ?? 0), 0);
  if (hotelsByNight.some((night) => night.choice?.total === null)) warnings.push("At least one selected room has no published price; that cost is not counted in the estimate.");
  let activityBudget = Math.max(0, budgetMinor - hotelTotal);
  const usedActivityIds = new Set<string>();

  for (let index = 0; index < dates.length; index++) {
    const day = dates[index];
    const destination = destinations[index % destinations.length]!;
    const dailyItems: AssistantPlanItem[] = [{ id: selectionId(itemIndex++), day, kind: "destinations", listingId: destination.id, title: destination.title, quantity: 1, unitMinor: null, unit: "Visit · no planner charge" }];
    const ranked = rankListings(publicListings, { destinationId: destination.id, interests: parsed.interests as Interest[], priceTargetMinor: Math.floor(budgetMinor / people / dates.length) })
      .filter((result) => result.listing.category === "activities");
    const fresh = ranked.filter((result) => !usedActivityIds.has(result.listing.id));
    const options = fresh.length ? fresh : ranked;
    const priced = options.filter((result) => result.listing.servicePriceMinor !== null && result.listing.servicePriceMinor !== undefined);
    const perPersonLimit = Math.floor(activityBudget / Math.max(1, dates.length - index) / people);
    const affordable = priced.filter((result) => result.listing.servicePriceMinor! <= perPersonLimit);
    const chosen = affordable[0] ?? [...priced].sort((a, b) => a.listing.servicePriceMinor! - b.listing.servicePriceMinor! || (b.score ?? 0) - (a.score ?? 0))[0] ?? options[0];
    if (chosen) {
      usedActivityIds.add(chosen.listing.id);
      const price = chosen.listing.servicePriceMinor ?? null;
      dailyItems.push({ id: selectionId(itemIndex++), day, kind: "activities", listingId: chosen.listing.id, title: chosen.listing.title, quantity: people, unitMinor: price, unit: "per person" });
      if (price === null) warnings.push(`${chosen.listing.title} has no published price. Its cost is not counted in the estimate.`);
      else activityBudget = Math.max(0, activityBudget - price * people);
    } else warnings.push(`No published activity is available in ${destination.title} for ${day}.`);

    const hotelNight = hotelsByNight.find((night) => night.day === day)?.choice;
    if (hotelNight) dailyItems.push({ id: selectionId(itemIndex++), day, kind: "hotels", listingId: hotelNight.hotel.id, roomId: hotelNight.room.id, title: `${hotelNight.hotel.title} · ${hotelNight.room.title}`, quantity: hotelNight.roomCount, unitMinor: hotelNight.room.nightlyMinor, unit: "per room per night" });
    days.push({ day, destinationId: destination.id, destinationTitle: destination.title, items: dailyItems });
  }

  const trip = { start: parsed.start, end: dates.at(-1)!, people, budget: parsed.budget, destinationIds: parsed.destinationIds };
  const selections = days.flatMap((day) => day.items.map(({ id, day: dateValue, kind, listingId, roomId, quantity }) => ({ id, day: dateValue, kind, listingId, ...(roomId ? { roomId } : {}), quantity })));
  const quote = quotePlan({ trip, items: selections }, plannerListings, new Date(`${parsed.start}T12:00:00.000Z`));
  if (quote.knownTotalMinor > budgetMinor) warnings.push(`Known costs are ${money(quote.knownTotalMinor - budgetMinor)} above your budget. Edit the plan before saving.`);
  else warnings.push("The estimate leaves room for unlisted costs such as transport, meals and access fees. Confirm prices and availability with providers.");
  return { trip, days, knownTotalMinor: quote.knownTotalMinor, budgetMinor, unknownCount: quote.unknownCount, warnings: [...new Set(warnings)],
    disclosure: "This demo assistant uses published GoChitral listings and their current prices with simple planning rules. It is not a trained AI model, and it does not book anything." };
}
