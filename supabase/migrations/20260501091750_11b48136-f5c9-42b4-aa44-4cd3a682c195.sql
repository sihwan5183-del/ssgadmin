ALTER TABLE public.inquiries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;