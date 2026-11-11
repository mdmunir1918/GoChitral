BEGIN;
CREATE OR REPLACE FUNCTION public.gochitral_guard_guide_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$ DECLARE trip_row public."Trip"; guide_row public."Listing"; profile_row public."GuideProfile"; BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'pending' OR NEW."ownerId"<>public.gochitral_user_id() OR public.gochitral_account_role()<>'tourist'
      OR NOT public.gochitral_session_active() THEN RAISE EXCEPTION 'A tourist session is required' USING ERRCODE='42501'; END IF;
    SELECT * INTO trip_row FROM public."Trip" WHERE id=NEW."tripId" AND "ownerId"=NEW."ownerId";
    IF trip_row.id IS NULL THEN RAISE EXCEPTION 'Choose one of your saved trips' USING ERRCODE='42501'; END IF;
    IF NEW."startDate"<trip_row."startDate" OR NEW."endDate">trip_row."endDate" THEN RAISE EXCEPTION 'Guide dates must fit inside the saved trip' USING ERRCODE='23514'; END IF;
    SELECT * INTO guide_row FROM public."Listing" WHERE id=NEW."guideId" AND category='guides' AND status='published';
    SELECT * INTO profile_row FROM public."GuideProfile" WHERE "guideId"=NEW."guideId";
    IF guide_row.id IS NULL OR profile_row."guideId" IS NULL THEN RAISE EXCEPTION 'This guide is not available for requests' USING ERRCODE='23514'; END IF;
    IF NEW."priceMinor" IS DISTINCT FROM guide_row."servicePriceMinor" OR NEW."pricingUnit"<>profile_row."pricingUnit" THEN
      RAISE EXCEPTION 'Refresh the guide estimate and try again' USING ERRCODE='23514'; END IF;
    IF NEW."endDate"<NEW."startDate" OR NEW."endDate"-NEW."startDate">=31 THEN RAISE EXCEPTION 'Guide dates are invalid' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id<>OLD.id OR NEW.reference<>OLD.reference OR NEW."ownerId"<>OLD."ownerId" OR NEW."guideId"<>OLD."guideId"
    OR NEW."tripId"<>OLD."tripId" OR NEW."startDate"<>OLD."startDate" OR NEW."endDate"<>OLD."endDate"
    OR NEW."priceMinor" IS DISTINCT FROM OLD."priceMinor" OR NEW."pricingUnit"<>OLD."pricingUnit"
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
  INSERT INTO public."GuideRequestAudit" ("requestId","actorId","fromStatus","toStatus",reason)
    VALUES (NEW.id, public.gochitral_user_id(), OLD.status, NEW.status, current_setting('gochitral.guide_reason',true));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_guard_guide_request() FROM PUBLIC;
COMMIT;
