BEGIN;
-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('draft', 'pending', 'approved');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "contactUrl" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ListingRevision" (
    "listingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'draft',
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingRevision_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dependentTripCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEntry_listingId_createdAt_idx" ON "AuditEntry"("listingId", "createdAt");

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Listing" ADD CONSTRAINT listing_version CHECK (version > 0);
ALTER TABLE "Listing" ADD CONSTRAINT listing_coordinates CHECK (
  (latitude IS NULL AND longitude IS NULL) OR
  (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
);
ALTER TABLE "Listing" ADD CONSTRAINT listing_contact CHECK ("contactUrl" IS NULL OR "contactUrl" ~ '^https://[^[:space:]]+$');
ALTER TABLE "ListingRevision" ADD CONSTRAINT revision_version CHECK (version > 0);
ALTER TABLE "AuditEntry" ADD CONSTRAINT audit_reason CHECK (length(reason) BETWEEN 1 AND 1000);

CREATE FUNCTION public.gochitral_is_admin() RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, public
AS $$ SELECT public.gochitral_account_role() = 'administrator' AND auth.jwt()->>'aal' = 'aal2'; $$;
REVOKE ALL ON FUNCTION public.gochitral_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gochitral_is_admin() TO authenticated;

ALTER TABLE "ListingRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ListingRevision", "AuditEntry" FROM PUBLIC, anon, authenticated, gochitral_public;
GRANT SELECT, INSERT, UPDATE ON "ListingRevision" TO authenticated;
GRANT SELECT ON "AuditEntry" TO authenticated;
GRANT INSERT, UPDATE ON "Listing" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "GuideVerification" TO authenticated;

CREATE POLICY administrator_listing_insert ON "Listing" FOR INSERT TO authenticated WITH CHECK (public.gochitral_is_admin());
CREATE POLICY administrator_listing_update ON "Listing" FOR UPDATE TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY administrator_media_read ON "Media" FOR SELECT TO authenticated USING (public.gochitral_is_admin());
CREATE POLICY administrator_revision_access ON "ListingRevision" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY administrator_evidence_access ON "GuideVerification" FOR ALL TO authenticated USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY administrator_audit_read ON "AuditEntry" FOR SELECT TO authenticated USING (public.gochitral_is_admin());

CREATE FUNCTION public.gochitral_audit_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ DECLARE
  change_action text := current_setting('gochitral.action', true);
  change_reason text := current_setting('gochitral.reason', true);
BEGIN
  -- Trusted operator migrations and development seeds have no end-user identity.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.gochitral_is_admin() THEN
    RAISE EXCEPTION 'Administrator MFA is required' USING ERRCODE = '42501';
  END IF;
  IF change_action IS NULL OR change_action NOT IN ('save', 'publish', 'suspend', 'reactivate')
    OR change_reason IS NULL OR length(trim(change_reason)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Use a moderation action with a reason' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.version <> OLD.version + 1 OR NEW.category <> OLD.category OR NEW.slug <> OLD.slug THEN
      RAISE EXCEPTION 'Invalid version or changed listing URL' USING ERRCODE = '23514';
    END IF;
    IF change_action = 'save' AND (to_jsonb(NEW) - 'version') IS DISTINCT FROM (to_jsonb(OLD) - 'version') THEN
      RAISE EXCEPTION 'Save edits in a draft revision' USING ERRCODE = '23514';
    END IF;
    IF change_action = 'suspend' AND (OLD.status <> 'published' OR NEW.status <> 'suspended') THEN
      RAISE EXCEPTION 'Only published listings can be suspended' USING ERRCODE = '23514';
    END IF;
    IF change_action = 'reactivate' AND (OLD.status <> 'suspended' OR NEW.status <> 'published') THEN
      RAISE EXCEPTION 'Only suspended listings can be reactivated' USING ERRCODE = '23514';
    END IF;
    IF change_action = 'publish' AND OLD.status = 'suspended' THEN
      RAISE EXCEPTION 'Use reactivation for suspended listings' USING ERRCODE = '23514';
    END IF;
  ELSIF change_action NOT IN ('save', 'publish') THEN
    RAISE EXCEPTION 'Invalid initial listing action' USING ERRCODE = '23514';
  END IF;
  IF change_action IN ('publish', 'reactivate') AND (
    NEW.status <> 'published' OR NEW."sourceUrl" IS NULL OR NEW."sourceTitle" IS NULL
    OR length(trim(NEW."sourceTitle")) = 0 OR NEW."sourceUrl" !~ '^https://[^[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'Publishing requires a reviewed source' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public."AuditEntry" (id, "listingId", "actorId", action, reason, revision, "createdAt", "dependentTripCount")
    VALUES (gen_random_uuid()::text, NEW.id, auth.uid(), change_action, change_reason, NEW.version, now(), 0);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_audit_publication() FROM PUBLIC;
CREATE TRIGGER gochitral_publication_audit AFTER INSERT OR UPDATE ON "Listing"
  FOR EACH ROW EXECUTE FUNCTION public.gochitral_audit_publication();

COMMIT;
