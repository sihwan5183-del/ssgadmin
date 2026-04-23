
-- Calendar events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT '기타',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  assignee TEXT,
  store_id UUID REFERENCES public.stores(id),
  is_important BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view all events
CREATE POLICY "All authenticated users can view calendar events"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (true);

-- Managers can insert events for their store
CREATE POLICY "Managers and admins can insert calendar events"
  ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'ceo') OR
    public.has_role(auth.uid(), 'planner') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'team_lead')
  );

-- Admins/planners can update any event; managers can update their own
CREATE POLICY "Admins can update any event, managers own events"
  ON public.calendar_events FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'ceo') OR
    public.has_role(auth.uid(), 'planner') OR
    created_by = auth.uid()
  );

-- Only admins can delete
CREATE POLICY "Admins can delete calendar events"
  ON public.calendar_events FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'ceo') OR
    public.has_role(auth.uid(), 'planner')
  );
