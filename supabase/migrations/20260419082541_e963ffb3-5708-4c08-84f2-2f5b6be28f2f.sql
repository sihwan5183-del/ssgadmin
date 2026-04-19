ALTER TABLE public.ad_campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.ad_spend REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_spend;