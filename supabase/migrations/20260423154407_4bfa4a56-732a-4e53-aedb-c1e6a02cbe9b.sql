ALTER TABLE public.sales
  ADD COLUMN trade_in_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN trade_in_model text DEFAULT NULL,
  ADD COLUMN trade_in_estimate numeric DEFAULT 0,
  ADD COLUMN trade_in_confirmed numeric DEFAULT 0;