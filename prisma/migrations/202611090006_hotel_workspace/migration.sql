BEGIN;
-- CreateEnum
CREATE TYPE "HotelReviewStatus" AS ENUM ('draft', 'pending', 'approved', 'changes_requested');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "availabilityNote" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "HotelDraft" (
    "id" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "HotelReviewStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "contactUrl" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "visitorNote" TEXT NOT NULL DEFAULT '',
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelRoomDraft" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "nightlyMinor" INTEGER NOT NULL,
    "availabilityNote" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HotelRoomDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelPhoto" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "inDraft" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelDetails" (
    "hotelId" TEXT NOT NULL,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "HotelDetails_pkey" PRIMARY KEY ("hotelId")
);

-- CreateIndex
CREATE INDEX "HotelDraft_ownerId_updatedAt_idx" ON "HotelDraft"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "HotelDraft_status_updatedAt_idx" ON "HotelDraft"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "HotelRoomDraft_hotelId_idx" ON "HotelRoomDraft"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelPhoto_key_key" ON "HotelPhoto"("key");

-- CreateIndex
CREATE INDEX "HotelPhoto_hotelId_createdAt_idx" ON "HotelPhoto"("hotelId", "createdAt");

-- AddForeignKey
ALTER TABLE "HotelRoomDraft" ADD CONSTRAINT "HotelRoomDraft_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "HotelDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelPhoto" ADD CONSTRAINT "HotelPhoto_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "HotelDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelDetails" ADD CONSTRAINT "HotelDetails_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."Media" DROP CONSTRAINT media_license;
ALTER TABLE public."Media" ADD CONSTRAINT media_license CHECK (license IN ('3.0','4.0','owner'));
ALTER TABLE public."HotelDraft" ADD CONSTRAINT hotel_version CHECK (version > 0);
ALTER TABLE public."HotelRoomDraft" ADD CONSTRAINT draft_room_values CHECK (capacity BETWEEN 1 AND 20 AND "nightlyMinor" BETWEEN 0 AND 999999999);
ALTER TABLE public."HotelPhoto" ADD CONSTRAINT hotel_photo_values CHECK (width BETWEEN 1 AND 1600 AND height BETWEEN 1 AND 1600 AND bytes BETWEEN 1 AND 2097152);
CREATE INDEX "HotelOwnership_ownerId_idx" ON public."HotelOwnership" ("ownerId");
ALTER TABLE public."HotelDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HotelRoomDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HotelPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HotelDetails" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HotelDraft",public."HotelRoomDraft",public."HotelPhoto",public."HotelDetails" FROM PUBLIC,anon,authenticated,gochitral_public;
GRANT SELECT,INSERT,UPDATE ON public."HotelDraft" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."HotelRoomDraft",public."HotelPhoto" TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public."HotelDetails" TO authenticated;
GRANT SELECT ON public."HotelPhoto",public."HotelDetails" TO gochitral_public;
GRANT INSERT,UPDATE ON public."Media",public."Room",public."HotelOwnership" TO authenticated;
GRANT SELECT ON public."Room" TO authenticated;
CREATE POLICY hotel_draft_owner ON public."HotelDraft" FOR ALL TO authenticated
 USING ("ownerId"=public.gochitral_user_id() AND public.gochitral_account_role()='manager')
 WITH CHECK ("ownerId"=public.gochitral_user_id() AND public.gochitral_account_role()='manager');
CREATE POLICY hotel_draft_admin ON public."HotelDraft" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY room_draft_owner ON public."HotelRoomDraft" FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public."HotelDraft" h WHERE h.id="hotelId" AND h."ownerId"=public.gochitral_user_id() AND public.gochitral_account_role()='manager'))
 WITH CHECK (EXISTS(SELECT 1 FROM public."HotelDraft" h WHERE h.id="hotelId" AND h."ownerId"=public.gochitral_user_id() AND public.gochitral_account_role()='manager'));
CREATE POLICY room_draft_admin ON public."HotelRoomDraft" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY hotel_photo_owner ON public."HotelPhoto" FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public."HotelDraft" h WHERE h.id="hotelId" AND h."ownerId"=public.gochitral_user_id() AND public.gochitral_account_role()='manager'))
 WITH CHECK (EXISTS(SELECT 1 FROM public."HotelDraft" h WHERE h.id="hotelId" AND h."ownerId"=public.gochitral_user_id() AND public.gochitral_account_role()='manager'));
CREATE POLICY hotel_photo_admin ON public."HotelPhoto" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY hotel_photo_public ON public."HotelPhoto" FOR SELECT TO gochitral_public USING (approved AND public.gochitral_listing_visible("hotelId"));
CREATE POLICY hotel_details_public ON public."HotelDetails" FOR SELECT TO gochitral_public USING (public.gochitral_listing_visible("hotelId"));
CREATE POLICY hotel_details_admin ON public."HotelDetails" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY room_admin ON public."Room" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY media_admin_write ON public."Media" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY ownership_admin ON public."HotelOwnership" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());

CREATE FUNCTION public.gochitral_guard_hotel_draft() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF public.gochitral_user_id() IS NULL OR public.gochitral_is_admin() THEN RETURN NEW; END IF;
 IF public.gochitral_account_role()<>'manager' THEN RAISE EXCEPTION 'Manager required' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'draft' OR NEW.version<>1 OR NEW."reviewNote"<>'' THEN RAISE EXCEPTION 'Create an owned draft' USING ERRCODE='42501'; END IF;
 ELSE
   IF NEW.id<>OLD.id OR NEW."ownerId"<>OLD."ownerId" OR NEW.version<>OLD.version+1 OR NEW."reviewNote"<>OLD."reviewNote" OR NEW.status NOT IN ('draft','pending') THEN
     RAISE EXCEPTION 'Ownership and approval are protected' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_guard_hotel_draft() FROM PUBLIC;
CREATE TRIGGER hotel_draft_guard BEFORE INSERT OR UPDATE ON public."HotelDraft" FOR EACH ROW EXECUTE FUNCTION public.gochitral_guard_hotel_draft();

CREATE FUNCTION public.gochitral_guard_hotel_child() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE h public."HotelDraft"; item_hotel text; BEGIN
 IF public.gochitral_user_id() IS NULL OR public.gochitral_is_admin() THEN
   IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 item_hotel:=CASE WHEN TG_OP='DELETE' THEN OLD."hotelId" ELSE NEW."hotelId" END;
 SELECT * INTO h FROM public."HotelDraft" WHERE id=item_hotel FOR UPDATE;
 IF h.id IS NULL OR h."ownerId"<>public.gochitral_user_id() OR h.status<>'draft' OR public.gochitral_account_role()<>'manager' THEN
   RAISE EXCEPTION 'Save an owned draft before changing rooms or photos' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW."hotelId"<>OLD."hotelId") THEN RAISE EXCEPTION 'Room/photo identity is protected' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='HotelPhoto' THEN
   IF TG_OP='INSERT' THEN
     PERFORM pg_advisory_xact_lock(hashtextextended(h."ownerId"::text,0));
     IF NEW.approved OR NOT NEW."inDraft" OR NEW.key<>h."ownerId"::text||'/'||h.id||'/'||NEW.id||'.webp' OR
       (SELECT count(*) FROM public."HotelPhoto" WHERE "hotelId"=h.id AND "inDraft")>=8 OR
       (SELECT count(*) FROM public."HotelPhoto" p JOIN public."HotelDraft" d ON d.id=p."hotelId" WHERE d."ownerId"=h."ownerId")>=50 THEN
       RAISE EXCEPTION 'Photo limit or invalid storage path' USING ERRCODE='42501';
     END IF;
   ELSIF TG_OP='UPDATE' THEN
     IF (to_jsonb(NEW)-'inDraft') IS DISTINCT FROM (to_jsonb(OLD)-'inDraft') THEN RAISE EXCEPTION 'Photo approval and storage are protected' USING ERRCODE='42501'; END IF;
   ELSIF OLD.approved THEN RAISE EXCEPTION 'Approved photos cannot be deleted' USING ERRCODE='42501';
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_guard_hotel_child() FROM PUBLIC;
CREATE TRIGGER hotel_room_guard BEFORE INSERT OR UPDATE OR DELETE ON public."HotelRoomDraft" FOR EACH ROW EXECUTE FUNCTION public.gochitral_guard_hotel_child();
CREATE TRIGGER hotel_photo_guard BEFORE INSERT OR UPDATE OR DELETE ON public."HotelPhoto" FOR EACH ROW EXECUTE FUNCTION public.gochitral_guard_hotel_child();
COMMIT;
