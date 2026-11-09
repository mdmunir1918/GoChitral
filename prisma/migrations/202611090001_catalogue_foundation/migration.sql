BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('destinations', 'activities', 'hotels', 'guides');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('draft', 'published', 'suspended');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "visitorNote" TEXT NOT NULL,
    "reviewed" DATE NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'draft',
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "destinationId" TEXT,
    "destinationCategory" "Category",
    "photoId" TEXT NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "license" TEXT NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "hotelCategory" "Category" NOT NULL DEFAULT 'hotels',
    "title" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "nightlyMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" "PublicationStatus" NOT NULL DEFAULT 'draft',

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelOwnership" (
    "hotelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "HotelOwnership_pkey" PRIMARY KEY ("hotelId")
);

-- CreateTable
CREATE TABLE "GuideVerification" (
    "guideId" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,

    CONSTRAINT "GuideVerification_pkey" PRIMARY KEY ("guideId")
);

-- CreateIndex
CREATE INDEX "Listing_status_displayOrder_id_idx" ON "Listing"("status", "displayOrder", "id");

-- CreateIndex
CREATE INDEX "Listing_destinationId_idx" ON "Listing"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_id_category_key" ON "Listing"("id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_category_slug_key" ON "Listing"("category", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Media_src_key" ON "Media"("src");

-- CreateIndex
CREATE INDEX "Room_hotelId_idx" ON "Room"("hotelId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_destinationId_destinationCategory_fkey" FOREIGN KEY ("destinationId", "destinationCategory") REFERENCES "Listing"("id", "category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_hotelCategory_fkey" FOREIGN KEY ("hotelId", "hotelCategory") REFERENCES "Listing"("id", "category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelOwnership" ADD CONSTRAINT "HotelOwnership_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideVerification" ADD CONSTRAINT "GuideVerification_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Listing" ADD CONSTRAINT listing_destination CHECK (
  (category = 'destinations' AND "destinationId" IS NULL AND "destinationCategory" IS NULL)
  OR (category <> 'destinations' AND "destinationId" IS NOT NULL AND "destinationCategory" IS NOT DISTINCT FROM 'destinations'::"Category")
);
ALTER TABLE "Listing" ADD CONSTRAINT listing_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Media" ADD CONSTRAINT media_dimensions CHECK (width > 0 AND height > 0);
ALTER TABLE "Media" ADD CONSTRAINT media_license CHECK (license IN ('3.0', '4.0'));
ALTER TABLE "Room" ADD CONSTRAINT room_capacity CHECK (capacity > 0);
ALTER TABLE "Room" ADD CONSTRAINT room_price CHECK ("nightlyMinor" IS NULL OR "nightlyMinor" >= 0);
ALTER TABLE "Room" ADD CONSTRAINT room_currency CHECK (currency = 'PKR');
ALTER TABLE "Room" ADD CONSTRAINT room_hotel CHECK ("hotelCategory" = 'hotels');

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gochitral_public') THEN
    CREATE ROLE gochitral_public NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO gochitral_public;

-- This narrow function avoids recursive RLS when checking an entry's parent.
-- Its owner is the migration operator. It returns only a publication boolean.
CREATE FUNCTION public.gochitral_listing_visible(entry_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Listing" item
    LEFT JOIN public."Listing" parent ON parent.id = item."destinationId"
    WHERE item.id = entry_id AND item.status = 'published'
      AND (item.category = 'destinations' OR
        (parent.category = 'destinations' AND parent.status = 'published'))
  );
$$;
REVOKE ALL ON FUNCTION public.gochitral_listing_visible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gochitral_listing_visible(text) TO gochitral_public;

ALTER TABLE "Listing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HotelOwnership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GuideVerification" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON "Listing", "Media", "Room", "HotelOwnership", "GuideVerification" FROM PUBLIC;
GRANT SELECT ON "Listing", "Media", "Room" TO gochitral_public;
CREATE POLICY listing_public_read ON "Listing" FOR SELECT TO gochitral_public
  USING (public.gochitral_listing_visible(id));
CREATE POLICY media_public_read ON "Media" FOR SELECT TO gochitral_public
  USING (EXISTS (SELECT 1 FROM public."Listing" WHERE "photoId" = "Media".id));
CREATE POLICY room_public_read ON "Room" FOR SELECT TO gochitral_public
  USING (status = 'published' AND public.gochitral_listing_visible("hotelId"));

-- Hosted Supabase roles may already have broad default grants. Replace those grants
-- for these tables before enabling the same public reader policy for API clients.
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON "Listing", "Media", "Room", "HotelOwnership", "GuideVerification" FROM %I', role_name);
      EXECUTE format('GRANT gochitral_public TO %I', role_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
