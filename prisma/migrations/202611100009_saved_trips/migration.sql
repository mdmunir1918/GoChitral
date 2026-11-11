BEGIN;
CREATE TABLE public."Trip" (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "ownerId" UUID NOT NULL REFERENCES public."Account"(id) ON DELETE CASCADE,
 title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160), revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
 "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
 people INTEGER NOT NULL CHECK (people BETWEEN 1 AND 20),
 "destinationIds" TEXT[] NOT NULL CHECK (cardinality("destinationIds") BETWEEN 1 AND 10),
 "destinationTitles" TEXT[] NOT NULL,
 "budgetMinor" BIGINT CHECK ("budgetMinor" >= 0), "knownTotalMinor" BIGINT NOT NULL CHECK ("knownTotalMinor" >= 0),
 "unknownCount" INTEGER NOT NULL CHECK ("unknownCount" BETWEEN 0 AND 120),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK ("endDate" >= "startDate" AND "endDate" - "startDate" < 31),
 CHECK (cardinality("destinationIds") = cardinality("destinationTitles"))
);
CREATE INDEX "Trip_ownerId_updatedAt_idx" ON public."Trip"("ownerId", "updatedAt");
CREATE TABLE public."TripDay" (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tripId" UUID NOT NULL REFERENCES public."Trip"(id) ON DELETE CASCADE,
 date DATE NOT NULL,
 CONSTRAINT "TripDay_tripId_date_key" UNIQUE ("tripId", date),
 CONSTRAINT "TripDay_id_tripId_key" UNIQUE (id, "tripId")
);
CREATE TABLE public."TripItem" (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "tripId" UUID NOT NULL REFERENCES public."Trip"(id) ON DELETE CASCADE,
 "dayId" UUID NOT NULL, "selectionId" UUID NOT NULL, "listingId" TEXT NOT NULL, "roomId" TEXT,
 category public."Category" NOT NULL, title TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20), unit TEXT NOT NULL,
 "unitMinor" INTEGER CHECK ("unitMinor" >= 0), nights INTEGER NOT NULL CHECK (nights BETWEEN 0 AND 1),
 "totalMinor" BIGINT CHECK ("totalMinor" >= 0), estimated BOOLEAN NOT NULL,
 CONSTRAINT "TripItem_dayId_tripId_fkey" FOREIGN KEY ("dayId", "tripId") REFERENCES public."TripDay"(id, "tripId") ON DELETE CASCADE,
 CONSTRAINT "TripItem_tripId_selectionId_key" UNIQUE ("tripId", "selectionId"),
 CHECK (category = 'hotels' OR nights = 0),
 CHECK (category NOT IN ('guides','destinations') OR quantity = 1),
 CHECK (estimated = (category = 'guides')),
 CHECK ("totalMinor" IS NOT DISTINCT FROM CASE WHEN category='hotels' AND nights=0 THEN 0::bigint
   WHEN "unitMinor" IS NULL THEN NULL::bigint
   ELSE "unitMinor"::bigint * quantity * CASE WHEN category='hotels' THEN nights ELSE 1 END END)
);
CREATE INDEX "TripItem_dayId_tripId_idx" ON public."TripItem"("dayId", "tripId");
CREATE TABLE public."TripSave" (
 "ownerId" UUID NOT NULL REFERENCES public."Account"(id) ON DELETE CASCADE, key UUID NOT NULL,
 "tripId" UUID NOT NULL REFERENCES public."Trip"(id) ON DELETE CASCADE,
 "requestHash" TEXT NOT NULL CHECK ("requestHash" ~ '^[a-f0-9]{64}$'), revision INTEGER NOT NULL CHECK (revision > 0),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY ("ownerId", key)
);
CREATE INDEX "TripSave_tripId_idx" ON public."TripSave"("tripId");

ALTER TABLE public."Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TripDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TripItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TripSave" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Trip", public."TripDay", public."TripItem", public."TripSave" FROM PUBLIC, anon, authenticated, gochitral_public;
GRANT SELECT, INSERT, UPDATE ON public."Trip" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."TripDay", public."TripItem" TO authenticated;
GRANT SELECT, INSERT ON public."TripSave" TO authenticated;
CREATE POLICY trip_owner ON public."Trip" FOR ALL TO authenticated
 USING ("ownerId" = public.gochitral_user_id() AND public.gochitral_session_active())
 WITH CHECK ("ownerId" = public.gochitral_user_id() AND public.gochitral_session_active());
CREATE POLICY trip_day_owner ON public."TripDay" FOR ALL TO authenticated
 USING (EXISTS (SELECT 1 FROM public."Trip" t WHERE t.id="tripId"))
 WITH CHECK (EXISTS (SELECT 1 FROM public."Trip" t WHERE t.id="tripId"));
CREATE POLICY trip_item_owner ON public."TripItem" FOR ALL TO authenticated
 USING (EXISTS (SELECT 1 FROM public."Trip" t WHERE t.id="tripId"))
 WITH CHECK (EXISTS (SELECT 1 FROM public."Trip" t WHERE t.id="tripId"));
CREATE POLICY trip_save_owner ON public."TripSave" FOR ALL TO authenticated
 USING ("ownerId"=public.gochitral_user_id() AND EXISTS (SELECT 1 FROM public."Trip" t WHERE t.id="tripId"))
 WITH CHECK ("ownerId"=public.gochitral_user_id() AND EXISTS (SELECT 1 FROM public."Trip" t WHERE t.id="tripId"));

CREATE FUNCTION public.gochitral_trip_revision() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,public AS $$ BEGIN
 IF NEW.id<>OLD.id OR NEW."ownerId"<>OLD."ownerId" OR NEW."createdAt"<>OLD."createdAt" OR NEW.revision<>OLD.revision+1 THEN
   RAISE EXCEPTION 'Trip identity is immutable; use the current revision' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_trip_revision() FROM PUBLIC;
CREATE TRIGGER trip_revision_guard BEFORE UPDATE ON public."Trip" FOR EACH ROW EXECUTE FUNCTION public.gochitral_trip_revision();
COMMIT;
