import { z } from "zod";

export function reviewDateToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const httpsUrl = z.string().trim().max(500).refine((value) => {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use a full HTTPS URL.");
const coordinate = (min: number, max: number) => z.string().trim().max(30).refine(
  (value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max),
  `Use a coordinate between ${min} and ${max}.`,
);

export const contentSchema = z.object({
  category: z.enum(["destinations", "activities", "hotels", "guides"]),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(10000),
  visitorNote: z.string().trim().min(1).max(3000),
  reviewed: z.iso.date().refine((value) => value <= reviewDateToday(), "Review dates cannot be in the future."),
  photoId: z.string().min(1).max(200),
  destinationId: z.string().max(100),
  sourceTitle: z.string().trim().max(200),
  sourceUrl: httpsUrl,
  contactUrl: httpsUrl,
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  servicePrice: z.string().trim().regex(/^(\d{1,7}(\.\d{1,2})?)?$/, "Enter a nonnegative PKR price with up to two decimals, or leave it blank.").optional(),
  guideLanguages: z.string().trim().max(500).default(""),
  guideExpertise: z.string().trim().max(1000).default(""),
  guideAreasServed: z.string().trim().max(500).default(""),
  guideCredentialSummary: z.string().trim().max(1000).default(""),
  guidePricingUnit: z.literal("per_group_day").default("per_group_day"),
}).refine((value) => value.category === "destinations" || value.destinationId !== "", {
  message: "Choose a parent destination.", path: ["destinationId"],
}).refine((value) => Boolean(value.latitude) === Boolean(value.longitude), {
  message: "Supply both coordinates together.", path: ["latitude"],
}).refine((value) => value.category !== "guides" || [value.guideLanguages, value.guideExpertise, value.guideAreasServed].every((items) => {
  const list = items.split(",").map(item => item.trim()).filter(Boolean); return list.length >= 1 && list.length <= 20;
}) && Boolean(value.guideCredentialSummary), {
  message: "Add guide languages, expertise, service area, and a public credential summary before publishing.", path: ["guideLanguages"],
});

export type ListingContent = z.infer<typeof contentSchema>;
export type EditorResult = {
  listingId: string;
  version: number;
  message: string;
  conflict?: boolean;
  url?: string;
  status?: "draft" | "published" | "suspended";
};

export function listingFields(content: ListingContent) {
  return {
    category: content.category,
    slug: content.slug,
    title: content.title,
    location: content.location,
    summary: content.summary,
    description: content.description,
    visitorNote: content.visitorNote,
    reviewed: new Date(content.reviewed),
    photoId: content.photoId,
    destinationId: content.category === "destinations" ? null : content.destinationId,
    destinationCategory: content.category === "destinations" ? null : "destinations" as const,
    sourceTitle: content.sourceTitle || null,
    sourceUrl: content.sourceUrl || null,
    contactUrl: content.contactUrl || null,
    latitude: content.latitude === "" ? null : Number(content.latitude),
    longitude: content.longitude === "" ? null : Number(content.longitude),
    servicePriceMinor: ["activities", "guides"].includes(content.category) && content.servicePrice ? Math.round(Number(content.servicePrice) * 100) : null,
  };
}

export function guideProfileFields(content: ListingContent) {
  return {
    languages: content.guideLanguages.split(",").map(value => value.trim()).filter(Boolean),
    expertise: content.guideExpertise.split(",").map(value => value.trim()).filter(Boolean),
    areasServed: content.guideAreasServed.split(",").map(value => value.trim()).filter(Boolean),
    credentialSummary: content.guideCredentialSummary,
    pricingUnit: content.guidePricingUnit,
  };
}
