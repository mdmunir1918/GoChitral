BEGIN;
-- Hotels use Room.nightlyMinor. Activity prices are per person and guide
-- estimates are per group/service day. NULL is unknown; zero means free.
ALTER TABLE public."Listing" ADD COLUMN "servicePriceMinor" INTEGER;
ALTER TABLE public."Listing" ADD CONSTRAINT listing_service_price
  CHECK ("servicePriceMinor" IS NULL OR
    (category IN ('activities', 'guides') AND "servicePriceMinor" >= 0));
COMMIT;
