BEGIN;

-- This schema is intentionally not exposed through Supabase's Data API.
-- The function returns counts only and checks the current Auth.js-backed role.
CREATE SCHEMA IF NOT EXISTS gochitral_private;
REVOKE ALL ON SCHEMA gochitral_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA gochitral_private TO authenticated;

CREATE OR REPLACE FUNCTION gochitral_private.admin_dashboard_metrics() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, gochitral_private
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.gochitral_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'accounts', jsonb_build_object(
      'total', (SELECT count(*)::integer FROM public."Account"),
      'byRole', COALESCE((SELECT jsonb_object_agg(role, total) FROM (
        SELECT role::text AS role, count(*)::integer AS total FROM public."Account" GROUP BY role
      ) counts), '{}'::jsonb)
    ),
    'trips', jsonb_build_object(
      'total', (SELECT count(*)::integer FROM public."Trip"),
      'savedLast30Days', (SELECT count(*)::integer FROM public."Trip" WHERE "createdAt" >= now() - interval '30 days')
    ),
    'listings', jsonb_build_object(
      'total', (SELECT count(*)::integer FROM public."Listing"),
      'byStatus', COALESCE((SELECT jsonb_object_agg(status, total) FROM (
        SELECT status::text AS status, count(*)::integer AS total FROM public."Listing" GROUP BY status
      ) counts), '{}'::jsonb),
      'byCategory', COALESCE((SELECT jsonb_object_agg(category, total) FROM (
        SELECT category::text AS category, count(*)::integer AS total FROM public."Listing" GROUP BY category
      ) counts), '{}'::jsonb),
      'pendingRevisions', (SELECT count(*)::integer FROM public."ListingRevision" WHERE status = 'pending')
    ),
    'hotelSubmissions', COALESCE((SELECT jsonb_object_agg(status, total) FROM (
      SELECT status::text AS status, count(*)::integer AS total FROM public."HotelDraft" GROUP BY status
    ) counts), '{}'::jsonb),
    'guideRequests', COALESCE((SELECT jsonb_object_agg(status, total) FROM (
      SELECT status::text AS status, count(*)::integer AS total FROM public."GuideRequest" GROUP BY status
    ) counts), '{}'::jsonb),
    'moderation', jsonb_build_object(
      'listingActionsLast30Days', (SELECT count(*)::integer FROM public."AuditEntry" WHERE "createdAt" >= now() - interval '30 days'),
      'guideDecisionsLast30Days', (SELECT count(*)::integer FROM public."GuideRequestAudit" WHERE "createdAt" >= now() - interval '30 days')
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION gochitral_private.admin_dashboard_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION gochitral_private.admin_dashboard_metrics() TO authenticated;

COMMIT;
