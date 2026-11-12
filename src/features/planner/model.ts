import { z } from "zod";

export const limits = { days: 31, people: 20, items: 120, destinations: 10, rooms: 20 } as const;
export const draftLifetime = 24 * 60 * 60 * 1000;
export const draftKey = "gochitral.plan.v1";
const identifier = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/);
const date = z.iso.date().refine(s => s >= "2020-01-01" && s <= "2100-12-31", "Use a date between 2020 and 2100.");
const budget = z.string().trim().regex(/^(\d{1,8}(\.\d{1,2})?)?$/, "Use a nonnegative budget with at most two decimal places.");

// The device may store unfinished settings. Only reviewSchema can be quoted.
export const settingsSchema = z.object({
  start: z.string().max(10), end: z.string().max(10),
  people: z.number().int().min(1).max(limits.people),
  destinationIds: z.array(identifier).max(limits.destinations), budget,
});
export const tripSchema = settingsSchema.extend({ start: date, end: date, destinationIds: z.array(identifier).min(1, "Choose at least one destination.").max(limits.destinations) }).superRefine((trip, ctx) => {
  const days = Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / 86400000) + 1;
  if (days < 1 || days > limits.days) ctx.addIssue({ code: "custom", message: `Choose an end date on or after the start, with at most ${limits.days} calendar days.`, path: ["end"] });
  if (new Set(trip.destinationIds).size !== trip.destinationIds.length) ctx.addIssue({ code: "custom", message: "Choose each destination once.", path: ["destinationIds"] });
});
export const selectionSchema = z.object({
  id: z.uuid(), day: date, kind: z.enum(["destinations", "hotels", "activities", "guides"]),
  listingId: identifier, roomId: identifier.optional(), quantity: z.number().int().min(1).max(limits.people),
  previousUnitMinor: z.number().int().min(0).max(2147483647).nullable().optional(),
});
const selections = z.array(selectionSchema).max(limits.items);
export const deviceDraftSchema = z.object({ version: z.literal(1), expiresAt: z.number().int().positive(), trip: settingsSchema, items: selections,
  saveKey: z.uuid().optional(), title: z.string().max(160).optional(), editing: z.object({ id: z.uuid(), revision: z.number().int().positive() }).optional(),
});
export const reviewSchema = z.object({ trip: tripSchema, items: selections }).superRefine((draft, ctx) => {
  if (new Set(draft.items.map(i => i.id)).size !== draft.items.length) ctx.addIssue({ code: "custom", message: "Each selection needs a unique ID.", path: ["items"] });
});
export type Settings = z.infer<typeof settingsSchema>;
export type Selection = z.infer<typeof selectionSchema>;
export type DeviceDraft = z.infer<typeof deviceDraftSchema>;
export type Plan = z.infer<typeof reviewSchema>;
export type PlannerListing = {
  id: string; title: string; category: Selection["kind"]; destinationId: string | null;
  servicePriceMinor: number | null; latitude?: number | null; longitude?: number | null;
  location?: string; summary?: string; description?: string; visitorNote?: string; reviewed?: string;
  rooms: { id: string; title: string; capacity: number; nightlyMinor: number | null }[];
};
export type QuoteLine = { id: string; day: string; title: string; unit: string; unitMinor: number | null; quantity: number; nights: number; totalMinor: number | null; issues: string[]; changed: boolean; previousUnitMinor?: number | null };
export type Quote = { days: string[]; nights: number; lines: QuoteLine[]; issues: string[]; knownTotalMinor: number; unknownCount: number; budgetMinor: number | null; valid: boolean; refreshedAt: string };

export function calendarDays(start: string, end: string) {
  const a = date.safeParse(start), b = date.safeParse(end);
  if (!a.success || !b.success) return [];
  const count = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (count < 1 || count > limits.days) return [];
  // Date-only values are Karachi calendar dates. UTC arithmetic avoids host
  // timezone/DST shifts; no browser-local midnight is ever serialized.
  return Array.from({ length: count }, (_, index) => new Date(Date.parse(start) + index * 86400000).toISOString().slice(0, 10));
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`));
}
export function money(minor: number) { return `PKR ${new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)}`; }
export function newDraft(today: string, now = Date.now()): DeviceDraft {
  return { version: 1, expiresAt: now + draftLifetime, saveKey: crypto.randomUUID(), trip: { start: today, end: today, people: 2, destinationIds: [], budget: "" }, items: [] };
}
export function restoreDraft(raw: string | null, now = Date.now()): { draft: DeviceDraft | null; message: string } {
  if (!raw) return { draft: null, message: "" };
  try {
    if (raw.length > 64000) throw new Error();
    const result = deviceDraftSchema.safeParse(JSON.parse(raw));
    if (!result.success) return { draft: null, message: "The saved draft could not be read. Start a new plan." };
    if (result.data.expiresAt <= now || result.data.expiresAt > now + draftLifetime + 60000) return { draft: null, message: "Your saved draft has expired. Start a new plan." };
    return { draft: result.data, message: "Your draft was restored from this device." };
  } catch { return { draft: null, message: "The saved draft could not be read. Start a new plan." }; }
}
export function dateImpact(items: Selection[], next: Settings) {
  const days = calendarDays(next.start, next.end);
  return { removed: items.filter(i => !days.includes(i.day)), checkout: items.filter(i => i.kind === "hotels" && i.day === next.end && days.includes(i.day)) };
}

export function quotePlan(input: unknown, catalogue: PlannerListing[], now = new Date()): Quote {
  const { trip, items } = reviewSchema.parse(input);
  const days = calendarDays(trip.start, trip.end);
  const byId = new Map(catalogue.map(item => [item.id, item]));
  const issues = trip.destinationIds.filter(id => byId.get(id)?.category !== "destinations").map(() => "A selected destination is no longer available. Choose another in Trip details.");
  const seen = new Set<string>();
  const lines = items.map((item): QuoteLine => {
    const listing = byId.get(item.listingId);
    const problems: string[] = [];
    const available = listing?.category === item.kind;
    const destinationId = listing?.category === "destinations" ? listing.id : listing?.destinationId;
    if (!available) problems.push("This selection is no longer available. Remove or replace it.");
    if (!days.includes(item.day)) problems.push("This day is outside your trip dates.");
    if (available && (!destinationId || !trip.destinationIds.includes(destinationId))) problems.push("Include this item's destination in Trip details or replace the item.");
    const key = `${item.day}:${item.kind}:${["hotels", "guides"].includes(item.kind) ? "one-per-day" : item.listingId}`;
    if (seen.has(key)) problems.push(item.kind === "guides" ? "Choose one guide per day; the group fee is charged once." : "This day already has this selection. Replace it or update its quantity.");
    seen.add(key);
    let unitMinor: number | null = null, unit = "Visit · no planner charge", nights = 0;
    let title = available ? listing!.title : "Unavailable selection";
    if (item.kind === "hotels") {
      const room = listing?.rooms.find(r => r.id === item.roomId);
      unit = "per room per night"; nights = days.includes(item.day) && item.day < trip.end ? 1 : 0;
      if (!room || !available) problems.push("Choose a currently published room for this hotel.");
      if (room && available) {
        unitMinor = room.nightlyMinor; title += ` · ${room.title}`;
        if (room.capacity * item.quantity < trip.people) problems.push(`${item.quantity} room(s) hold ${room.capacity * item.quantity} guests; your group has ${trip.people}. Add rooms or choose another room type.`);
      }
    } else if (item.kind === "activities") {
      unit = "per person"; unitMinor = available ? listing!.servicePriceMinor : null;
      if (item.quantity > trip.people) problems.push("Participants cannot exceed your group size.");
    } else if (item.kind === "guides") {
      unit = "per group per service day · estimated"; unitMinor = available ? listing!.servicePriceMinor : null;
      if (item.quantity !== 1) problems.push("A guide group fee is charged once per service day.");
    } else {
      unit = "visit · entry fees unknown";
      if (item.quantity !== 1) problems.push("Add a destination once per day.");
    }
    const totalMinor = problems.length ? null : item.kind === "hotels" && nights === 0 ? 0 : unitMinor === null ? null : unitMinor * item.quantity * (item.kind === "hotels" ? nights : 1);
    return { id: item.id, day: item.day, title, unit, unitMinor, quantity: item.quantity, nights, totalMinor, issues: problems, changed: item.previousUnitMinor !== undefined && item.previousUnitMinor !== unitMinor && available, previousUnitMinor: item.previousUnitMinor };
  });
  return {
    days, nights: Math.max(0, days.length - 1), lines, issues,
    knownTotalMinor: lines.reduce((sum, line) => sum + (line.totalMinor ?? 0), 0),
    unknownCount: lines.filter(l => !l.issues.length && l.totalMinor === null).length,
    budgetMinor: trip.budget ? Math.round(Number(trip.budget) * 100) : null,
    valid: !issues.length && lines.every(l => !l.issues.length), refreshedAt: now.toISOString(),
  };
}
