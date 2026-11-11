BEGIN;
-- Only the server's credential verifier may clear failed sign-in attempts.
CREATE FUNCTION public.gochitral_auth_success(bucket text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ DELETE FROM public."AuthRateLimit" WHERE key = bucket; $$;
REVOKE ALL ON FUNCTION public.gochitral_auth_success(text) FROM PUBLIC, anon, authenticated, gochitral_public;
GRANT EXECUTE ON FUNCTION public.gochitral_auth_success(text) TO gochitral_auth;
COMMIT;
