BEGIN;
CREATE TYPE public."GuideRequestStatus" AS ENUM ('pending', 'confirmed', 'declined');
CREATE TYPE public."GuidePricingUnit" AS ENUM ('per_group_day');

CREATE TABLE public."GuideProfile" (
  "guideId" TEXT PRIMARY KEY REFERENCES public."Listing"(id) ON DELETE CASCADE,
  languages TEXT[] NOT NULL CHECK (cardinality(languages) BETWEEN 1 AND 20),
  expertise TEXT[] NOT NULL CHECK (cardinality(expertise) BETWEEN 1 AND 20),
  "areasServed" TEXT[] NOT NULL CHECK (cardinality("areasServed") BETWEEN 1 AND 20),
  "credentialSummary" TEXT NOT NULL CHECK (length(trim("credentialSummary")) BETWEEN 1 AND 1000),
  "pricingUnit" public."GuidePricingUnit" NOT NULL DEFAULT 'per_group_day',
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE TABLE public."GuideRequest" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE CHECK (reference ~ '^GC-[A-F0-9]{8}$'),
  "ownerId" UUID NOT NULL REFERENCES public."Account"(id) ON DELETE CASCADE,
  "guideId" TEXT NOT NULL REFERENCES public."Listing"(id) ON DELETE RESTRICT,
  "tripId" UUID NOT NULL REFERENCES public."Trip"(id) ON DELETE CASCADE,
  "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
  status public."GuideRequestStatus" NOT NULL DEFAULT 'pending',
  "priceMinor" INTEGER CHECK ("priceMinor" >= 0),
  "pricingUnit" public."GuidePricingUnit" NOT NULL,
  key UUID NOT NULL,
  "requestHash" TEXT NOT NULL CHECK ("requestHash" ~ '^[a-f0-9]{64}$'),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE ("ownerId", key),
  CHECK ("endDate" >= "startDate" AND "endDate" - "startDate" < 31)
);
CREATE INDEX "GuideRequest_ownerId_createdAt_idx" ON public."GuideRequest"("ownerId", "createdAt" DESC);
CREATE INDEX "GuideRequest_guideId_status_startDate_endDate_idx" ON public."GuideRequest"("guideId", status, "startDate", "endDate");
CREATE INDEX "GuideRequest_tripId_status_idx" ON public."GuideRequest"("tripId", status);
CREATE TABLE public."GuideRequestAudit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL REFERENCES public."GuideRequest"(id) ON DELETE CASCADE,
  "actorId" UUID NOT NULL REFERENCES public."Account"(id) ON DELETE RESTRICT,
  "fromStatus" public."GuideRequestStatus" NOT NULL,
  "toStatus" public."GuideRequestStatus" NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "GuideRequestAudit_requestId_createdAt_idx" ON public."GuideRequestAudit"("requestId", "createdAt");

ALTER TABLE public."GuideProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GuideRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GuideRequestAudit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."GuideProfile", public."GuideRequest", public."GuideRequestAudit" FROM PUBLIC, anon, authenticated, gochitral_public;
GRANT SELECT ON public."GuideProfile" TO gochitral_public;
GRANT SELECT, INSERT, UPDATE ON public."GuideProfile" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public."GuideRequest" TO authenticated;
GRANT SELECT ON public."GuideRequestAudit" TO authenticated;
CREATE POLICY guide_profile_published_read ON public."GuideProfile" FOR SELECT TO gochitral_public, authenticated
  USING (EXISTS (SELECT 1 FROM public."Listing" l WHERE l.id="guideId" AND l.category='guides' AND l.status='published'));
CREATE POLICY guide_profile_admin_manage ON public."GuideProfile" FOR ALL TO authenticated
  USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY guide_request_owner_read ON public."GuideRequest" FOR SELECT TO authenticated
  USING ("ownerId"=public.gochitral_user_id() AND public.gochitral_session_active());
CREATE POLICY guide_request_admin_read ON public."GuideRequest" FOR SELECT TO authenticated USING (public.gochitral_is_admin());
CREATE POLICY guide_request_owner_create ON public."GuideRequest" FOR INSERT TO authenticated
  WITH CHECK ("ownerId"=public.gochitral_user_id() AND public.gochitral_account_role()='tourist' AND public.gochitral_session_active());
CREATE POLICY guide_request_admin_decide ON public."GuideRequest" FOR UPDATE TO authenticated
  USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
CREATE POLICY guide_request_audit_owner_read ON public."GuideRequestAudit" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public."GuideRequest" r WHERE r.id="requestId" AND r."ownerId"=public.gochitral_user_id()));
CREATE POLICY guide_request_audit_admin_read ON public."GuideRequestAudit" FOR SELECT TO authenticated USING (public.gochitral_is_admin());

-- Every submission rechecks ownership, guide publication and date containment in PostgreSQL.
CREATE FUNCTION public.gochitral_guard_guide_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$ DECLARE trip_row public."Trip"; guide_row public."Listing"; profile_row public."GuideProfile"; BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'pending' OR NEW."ownerId"<>public.gochitral_user_id() OR public.gochitral_account_role()<>'tourist'
      OR NOT public.gochitral_session_active() THEN RAISE EXCEPTION 'A tourist session is required' USING ERRCODE='42501'; END IF;
    SELECT * INTO trip_row FROM public."Trip" WHERE id=NEW."tripId" AND "ownerId"=NEW."ownerId";
    IF trip_row.id IS NULL THEN RAISE EXCEPTION 'Choose one of your saved trips' USING ERRCODE='42501'; END IF;
    IF NEW."startDate"<trip_row."startDate" OR NEW."endDate">trip_row."endDate" THEN RAISE EXCEPTION 'Guide dates must fit inside the saved trip' USING ERRCODE='23514'; END IF;
    SELECT * INTO guide_row FROM public."Listing" WHERE id=NEW."guideId" AND category='guides' AND status='published';
    SELECT * INTO profile_row FROM public."GuideProfile" WHERE "guideId"=NEW."guideId";
    IF guide_row.id IS NULL OR profile_row."guideId" IS NULL THEN
      RAISE EXCEPTION 'This guide is not available for requests' USING ERRCODE='23514'; END IF;
    IF NEW.priceMinor IS DISTINCT FROM guide_row."servicePriceMinor" OR NEW."pricingUnit"<>profile_row."pricingUnit" THEN
      RAISE EXCEPTION 'Refresh the guide estimate and try again' USING ERRCODE='23514'; END IF;
    IF NEW."endDate"<NEW."startDate" OR NEW."endDate"-NEW."startDate">=31 THEN RAISE EXCEPTION 'Guide dates are invalid' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id<>OLD.id OR NEW.reference<>OLD.reference OR NEW."ownerId"<>OLD."ownerId" OR NEW."guideId"<>OLD."guideId"
    OR NEW."tripId"<>OLD."tripId" OR NEW."startDate"<>OLD."startDate" OR NEW."endDate"<>OLD."endDate"
    OR NEW.priceMinor IS DISTINCT FROM OLD.priceMinor OR NEW."pricingUnit"<>OLD."pricingUnit"
    OR NEW.key<>OLD.key OR NEW."requestHash"<>OLD."requestHash" OR NEW."createdAt"<>OLD."createdAt"
    OR OLD.status<>'pending' OR NEW.status NOT IN ('confirmed','declined') OR NOT public.gochitral_is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may decide a pending guide request' USING ERRCODE='42501';
  END IF;
  IF length(trim(COALESCE(current_setting('gochitral.guide_reason',true),''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'A decision reason is required' USING ERRCODE='23514';
  END IF;
  IF NEW.status='confirmed' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW."guideId",0));
    IF EXISTS (SELECT 1 FROM public."GuideRequest" r WHERE r."guideId"=NEW."guideId" AND r.status='confirmed'
      AND r.id<>NEW.id AND r."startDate"<=NEW."endDate" AND r."endDate">=NEW."startDate") THEN
      RAISE EXCEPTION 'Another confirmed request overlaps these dates' USING ERRCODE='23P01';
    END IF;
  END IF;
  NEW."updatedAt":=now();
  -- Internal audit write is protected by a non-callable, fixed-search-path trigger.
  INSERT INTO public."GuideRequestAudit" ("requestId","actorId","fromStatus","toStatus",reason)
    VALUES (NEW.id, public.gochitral_user_id(), OLD.status, NEW.status, current_setting('gochitral.guide_reason',true));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_guard_guide_request() FROM PUBLIC;
CREATE TRIGGER guide_request_guard BEFORE INSERT OR UPDATE ON public."GuideRequest" FOR EACH ROW EXECUTE FUNCTION public.gochitral_guard_guide_request();

CREATE FUNCTION public.gochitral_guide_request_attempt() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$ DECLARE bucket text; count_attempts integer; BEGIN
  IF NOT public.gochitral_session_active() OR public.gochitral_account_role()<>'tourist' THEN RETURN false; END IF;
  bucket:=encode(sha256(convert_to(public.gochitral_user_id()::text||':guide-request','UTF8')),'hex');
  DELETE FROM public."AuthRateLimit" WHERE "window"<now()-interval '1 day';
  INSERT INTO public."AuthRateLimit" (key,"window",attempts) VALUES (bucket,date_bin('15 minutes',now(),'2000-01-01'::timestamp),1)
  ON CONFLICT (key) DO UPDATE SET "window"=EXCLUDED."window",attempts=CASE
    WHEN public."AuthRateLimit"."window"=EXCLUDED."window" THEN public."AuthRateLimit".attempts+1 ELSE 1 END
  RETURNING attempts INTO count_attempts;
  RETURN count_attempts<=8;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_guide_request_attempt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gochitral_guide_request_attempt() TO authenticated;

CREATE FUNCTION public.gochitral_trip_guide_date_guard() RETURNS trigger LANGUAGE plpgsql
  SET search_path=pg_catalog,public AS $$ BEGIN
  IF NEW."startDate"<>OLD."startDate" OR NEW."endDate"<>OLD."endDate" THEN
    IF EXISTS (SELECT 1 FROM public."GuideRequest" r WHERE r."tripId"=OLD.id AND r.status IN ('pending','confirmed')
      AND (r."startDate"<NEW."startDate" OR r."endDate">NEW."endDate")) THEN
      RAISE EXCEPTION 'Resolve guide requests outside the new trip dates first' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_trip_guide_date_guard() FROM PUBLIC;
CREATE TRIGGER trip_guide_date_guard BEFORE UPDATE ON public."Trip" FOR EACH ROW EXECUTE FUNCTION public.gochitral_trip_guide_date_guard();

COMMIT;
