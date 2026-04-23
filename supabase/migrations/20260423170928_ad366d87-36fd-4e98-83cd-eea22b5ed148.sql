
ALTER TABLE public.sales
ADD COLUMN customer_support_amount numeric DEFAULT 0,
ADD COLUMN corp_card_amount numeric DEFAULT 0;
