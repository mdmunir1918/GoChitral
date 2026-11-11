export const categoryLabels = {
  destinations: "Destination",
  activities: "Activity",
  hotels: "Hotel",
  guides: "Guide",
} as const;

export type Category = keyof typeof categoryLabels;

export type Photo = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  author: string;
  original: string;
  license: "3.0" | "4.0" | "owner";
};

export type PublicGuideProfile = {
  languages: string[];
  expertise: string[];
  areasServed: string[];
  credentialSummary: string;
  pricingUnit: "per_group_day";
};

type ListingFields = {
  id: string;
  slug: string;
  title: string;
  location: string;
  summary: string;
  description: string;
  visitorNote: string;
  photo: Photo;
  source?: { title: string; url: string };
  reviewed: string;
  status: "published" | "draft" | "suspended";
  contactUrl?: string;
  latitude?: number;
  longitude?: number;
  roomCount?: number;
  fromNightlyMinor?: number;
  servicePriceMinor?: number | null;
  guideProfile?: PublicGuideProfile;
};

export type Listing = ListingFields & (
  | { category: "destinations"; destinationId?: never }
  | { category: "activities" | "hotels"; destinationId: string }
  | { category: "guides"; destinationId: string }
);

export function listingUrl(listing: Listing) {
  return `/${listing.category}/${listing.slug}`;
}
