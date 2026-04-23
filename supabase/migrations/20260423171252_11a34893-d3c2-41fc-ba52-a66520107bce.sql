ALTER TABLE public.incentive_policies
ADD COLUMN bundle_only boolean NOT NULL DEFAULT false,
ADD COLUMN no_offer_only boolean NOT NULL DEFAULT false;