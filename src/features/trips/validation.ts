import { z } from "zod";
import { reviewSchema } from "@/features/planner/model";

export const saveTripSchema = z.object({
  key: z.uuid(), tripId: z.uuid().optional(), revision: z.number().int().positive().max(2147483646).optional(),
  title: z.string().trim().min(1, "Give your trip a name.").max(160), plan: reviewSchema,
}).refine(value => Boolean(value.tripId) === Boolean(value.revision), "Use the saved trip's revision when editing.");
export type SaveTripInput = z.infer<typeof saveTripSchema>;
