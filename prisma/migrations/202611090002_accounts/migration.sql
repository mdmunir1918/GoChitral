BEGIN;
-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('tourist', 'manager', 'administrator');

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'tourist',

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "key" TEXT NOT NULL,
    "window" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "Account" ADD CONSTRAINT account_auth_user FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthRateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Account", "AuthRateLimit" FROM PUBLIC, anon, authenticated, gochitral_public;
GRANT SELECT ON "Account" TO authenticated;

CREATE FUNCTION public.gochitral_session_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.sessions
    WHERE id::text = auth.jwt()->>'session_id' AND user_id = auth.uid()
      AND (not_after IS NULL OR not_after > now()));
$$;
REVOKE ALL ON FUNCTION public.gochitral_session_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gochitral_session_active() TO authenticated;

CREATE FUNCTION public.gochitral_account_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ SELECT role::text FROM public."Account" WHERE id = auth.uid() AND public.gochitral_session_active(); $$;
REVOKE ALL ON FUNCTION public.gochitral_account_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gochitral_account_role() TO authenticated;

CREATE POLICY account_self_read ON "Account" FOR SELECT TO authenticated
  USING (id = auth.uid() AND public.gochitral_session_active());

CREATE FUNCTION public.gochitral_create_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ BEGIN
  INSERT INTO public."Account" (id, role)
    VALUES (NEW.id, CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'manager'
      THEN 'manager'::public."AccountRole" ELSE 'tourist'::public."AccountRole" END);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_create_account() FROM PUBLIC;
CREATE TRIGGER gochitral_create_account AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.gochitral_create_account();
INSERT INTO "Account" (id, role) SELECT id, 'tourist'::"AccountRole" FROM auth.users ON CONFLICT DO NOTHING;

GRANT SELECT ON "HotelOwnership" TO authenticated;
CREATE POLICY ownership_self_read ON "HotelOwnership" FOR SELECT TO authenticated
  USING ("ownerId" = auth.uid()::text AND public.gochitral_account_role() = 'manager');
CREATE POLICY manager_listing_read ON "Listing" FOR SELECT TO authenticated
  USING (public.gochitral_account_role() = 'manager' AND EXISTS (
    SELECT 1 FROM public."HotelOwnership" WHERE "hotelId" = "Listing".id AND "ownerId" = auth.uid()::text
  ));
CREATE POLICY administrator_listing_read ON "Listing" FOR SELECT TO authenticated
  USING (public.gochitral_account_role() = 'administrator' AND auth.jwt()->>'aal' = 'aal2');

CREATE FUNCTION public.gochitral_auth_attempt(bucket text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ DECLARE count_attempts integer; BEGIN
  IF bucket !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  DELETE FROM public."AuthRateLimit" WHERE "window" < now() - interval '1 day';
  INSERT INTO public."AuthRateLimit" (key, "window", attempts)
    VALUES (bucket, date_bin('15 minutes', now(), '2000-01-01'::timestamp), 1)
  ON CONFLICT (key) DO UPDATE SET
    attempts = CASE WHEN public."AuthRateLimit"."window" = EXCLUDED."window" THEN public."AuthRateLimit".attempts + 1 ELSE 1 END,
    "window" = EXCLUDED."window"
  RETURNING attempts INTO count_attempts;
  RETURN count_attempts <= 8;
END $$;
REVOKE ALL ON FUNCTION public.gochitral_auth_attempt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gochitral_auth_attempt(text) TO gochitral_public, authenticated;

COMMIT;
