BEGIN;
-- CreateEnum
CREATE TYPE "AuthTokenKind" AS ENUM ('email', 'recovery');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailVerified" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthCredential" (
    "accountId" UUID NOT NULL,
    "passwordHash" TEXT,
    "mfaSecretEncrypted" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTotpStep" BIGINT,

    CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "mfaVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" "AuthTokenKind" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthSession_accountId_idx" ON "AuthSession"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_accountId_kind_idx" ON "AuthToken"("accountId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- AddForeignKey
ALTER TABLE "AuthCredential" ADD CONSTRAINT "AuthCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve identities and bcrypt hashes before disconnecting the former provider.
UPDATE public."Account" a SET email = lower(u.email), "emailVerified" = u.email_confirmed_at
FROM auth.users u WHERE a.id = u.id;
ALTER TABLE public."Account" ALTER COLUMN email SET NOT NULL;
INSERT INTO public."AuthCredential" ("accountId", "passwordHash")
SELECT a.id, u.encrypted_password FROM public."Account" a JOIN auth.users u ON u.id = a.id;
ALTER TABLE public."Account" DROP CONSTRAINT account_auth_user;
DROP TRIGGER gochitral_create_account ON auth.users;
DROP FUNCTION public.gochitral_create_account();

CREATE ROLE gochitral_auth NOLOGIN;
GRANT gochitral_auth TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO gochitral_auth;
GRANT SELECT, INSERT, UPDATE ON public."Account" TO gochitral_auth;
CREATE POLICY account_auth_backend ON public."Account" FOR ALL TO gochitral_auth USING (true) WITH CHECK (true);
ALTER TABLE public."AuthCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuthToken" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AuthCredential", public."AuthSession", public."AuthToken" FROM PUBLIC, anon, authenticated, gochitral_public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."AuthCredential", public."AuthSession", public."AuthToken" TO gochitral_auth;
CREATE POLICY credential_backend ON public."AuthCredential" FOR ALL TO gochitral_auth USING (true) WITH CHECK (true);
CREATE POLICY session_backend ON public."AuthSession" FOR ALL TO gochitral_auth USING (true) WITH CHECK (true);
CREATE POLICY token_backend ON public."AuthToken" FOR ALL TO gochitral_auth USING (true) WITH CHECK (true);
GRANT EXECUTE ON FUNCTION public.gochitral_auth_attempt(text) TO gochitral_auth;

CREATE FUNCTION public.gochitral_claims() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public
AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb; $$;
CREATE FUNCTION public.gochitral_user_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = pg_catalog, public
AS $$ SELECT (public.gochitral_claims()->>'sub')::uuid; $$;
REVOKE ALL ON FUNCTION public.gochitral_claims(), public.gochitral_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gochitral_claims(), public.gochitral_user_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.gochitral_session_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ SELECT EXISTS (SELECT 1 FROM public."AuthSession"
  WHERE id::text = public.gochitral_claims()->>'session_id' AND "accountId" = public.gochitral_user_id()
  AND "revokedAt" IS NULL AND "expiresAt" > now()); $$;
CREATE OR REPLACE FUNCTION public.gochitral_account_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ SELECT role::text FROM public."Account" WHERE id = public.gochitral_user_id() AND public.gochitral_session_active(); $$;
CREATE OR REPLACE FUNCTION public.gochitral_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ SELECT public.gochitral_account_role() = 'administrator'
  AND public.gochitral_claims()->>'aal' = 'aal2'
  AND EXISTS (SELECT 1 FROM public."AuthSession" WHERE id::text = public.gochitral_claims()->>'session_id'
    AND "accountId" = public.gochitral_user_id() AND "mfaVerifiedAt" IS NOT NULL); $$;
DROP POLICY account_self_read ON public."Account";
CREATE POLICY account_self_read ON public."Account" FOR SELECT TO authenticated
  USING (id = public.gochitral_user_id() AND public.gochitral_session_active());
DROP POLICY ownership_self_read ON public."HotelOwnership";
CREATE POLICY ownership_self_read ON public."HotelOwnership" FOR SELECT TO authenticated
  USING ("ownerId" = public.gochitral_user_id()::text AND public.gochitral_account_role() = 'manager');
DROP POLICY manager_listing_read ON public."Listing";
CREATE POLICY manager_listing_read ON public."Listing" FOR SELECT TO authenticated
  USING (public.gochitral_account_role() = 'manager' AND EXISTS (
    SELECT 1 FROM public."HotelOwnership" WHERE "hotelId" = "Listing".id AND "ownerId" = public.gochitral_user_id()::text));
DROP POLICY administrator_listing_read ON public."Listing";
CREATE POLICY administrator_listing_read ON public."Listing" FOR SELECT TO authenticated USING (public.gochitral_is_admin());
CREATE OR REPLACE FUNCTION public.gochitral_audit_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ DECLARE
  change_action text := current_setting('gochitral.action', true);
  change_reason text := current_setting('gochitral.reason', true);
BEGIN
  -- Trusted operator migrations and development seeds have no end-user identity.
  IF public.gochitral_user_id() IS NULL THEN RETURN NEW; END IF;
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
    VALUES (gen_random_uuid()::text, NEW.id, public.gochitral_user_id(), change_action, change_reason, NEW.version, now(), 0);
  RETURN NEW;
END $$;

COMMIT;
