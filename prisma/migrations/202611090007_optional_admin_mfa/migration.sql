BEGIN;
-- This setting is supplied only by the trusted server after Auth.js verification.
-- Missing settings retain MFA enforcement; the app allows opt-out only on loopback.
CREATE OR REPLACE FUNCTION public.gochitral_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ SELECT public.gochitral_account_role() = 'administrator' AND (
  COALESCE(public.gochitral_claims()->>'admin_mfa_required' = 'false', false)
  OR (public.gochitral_claims()->>'aal' = 'aal2' AND EXISTS (
    SELECT 1 FROM public."AuthSession"
    WHERE id::text = public.gochitral_claims()->>'session_id'
      AND "accountId" = public.gochitral_user_id() AND "mfaVerifiedAt" IS NOT NULL
  ))
); $$;
REVOKE ALL ON FUNCTION public.gochitral_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gochitral_is_admin() TO authenticated;
COMMIT;
