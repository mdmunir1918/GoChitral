import { z } from "zod";

const contact = z.string().trim().max(500).refine((s) => !s || (() => { try { return new URL(s).protocol === "https:"; } catch { return false; } })(), "Use a full HTTPS contact website.");
export const roomSchema = z.object({
  id: z.uuid(), title: z.string().trim().min(1).max(100),
  capacity: z.coerce.number().int().min(1, "A room needs at least one guest.").max(20, "A room can have at most 20 guests."),
  nightlyRate: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter a PKR rate with at most two decimal places."),
  availabilityNote: z.string().trim().max(500), archived: z.boolean(),
});
export const hotelSchema = z.object({
  title: z.string().trim().min(1).max(160), destinationId: z.string().min(1).max(100),
  contactUrl: contact, summary: z.string().trim().max(500), description: z.string().trim().max(10000),
  visitorNote: z.string().trim().max(3000),
  amenities: z.array(z.string().trim().min(1).max(60)).max(20),
  rooms: z.array(roomSchema).max(20),
}).refine((s) => new Set(s.rooms.map((r) => r.id)).size === s.rooms.length, "Each room needs its own ID.");
export type HotelInput = z.infer<typeof hotelSchema>;
export type HotelResult = { id: string; version: number; message: string; conflict?: boolean; status?: string };
export const emptyHotel: HotelInput = { title: "", destinationId: "", contactUrl: "", summary: "", description: "", visitorNote: "", amenities: [], rooms: [] };
