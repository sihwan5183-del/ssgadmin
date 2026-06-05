
-- inquiries: scoped SELECT
DROP POLICY IF EXISTS "Authenticated can view inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "auth view inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries_select_all" ON public.inquiries;
CREATE POLICY "Scoped view inquiries" ON public.inquiries
FOR SELECT TO authenticated
USING (
  public.can_view_user_data(auth.uid(), created_by)
  OR public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
);

-- inquiry_logs: scoped via parent inquiry
DROP POLICY IF EXISTS "Authenticated can view inquiry logs" ON public.inquiry_logs;
DROP POLICY IF EXISTS "auth view inquiry_logs" ON public.inquiry_logs;
DROP POLICY IF EXISTS "inquiry_logs_select_all" ON public.inquiry_logs;
CREATE POLICY "Scoped view inquiry_logs" ON public.inquiry_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE i.id = inquiry_logs.inquiry_id
      AND (
        public.can_view_user_data(auth.uid(), i.created_by)
        OR public.is_admin(auth.uid())
        OR public.is_ceo(auth.uid())
        OR public.is_planner(auth.uid())
      )
  )
);

-- lead_notes: scoped via parent leads
DROP POLICY IF EXISTS "Authenticated can view lead notes" ON public.lead_notes;
DROP POLICY IF EXISTS "auth view lead_notes" ON public.lead_notes;
DROP POLICY IF EXISTS "lead_notes_select_all" ON public.lead_notes;
CREATE POLICY "Scoped view lead_notes" ON public.lead_notes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_notes.lead_id
      AND (
        l.assigned_to IS NULL
        OR public.can_view_user_data(auth.uid(), l.assigned_to)
        OR public.is_admin(auth.uid())
        OR public.is_ceo(auth.uid())
        OR public.is_planner(auth.uid())
      )
  )
);

-- sales_addon_tasks: scoped via parent sale
DROP POLICY IF EXISTS "auth view addon_tasks" ON public.sales_addon_tasks;
DROP POLICY IF EXISTS "Authenticated can view addon tasks" ON public.sales_addon_tasks;
CREATE POLICY "Scoped view addon_tasks" ON public.sales_addon_tasks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sales_addon_tasks.sale_id
      AND (
        public.can_view_user_data(auth.uid(), s.created_by)
        OR public.is_admin(auth.uid())
        OR public.is_ceo(auth.uid())
        OR public.is_planner(auth.uid())
      )
  )
);

-- seg_activities: mirror seg_partners scope
DROP POLICY IF EXISTS "Authenticated can view seg activities" ON public.seg_activities;
DROP POLICY IF EXISTS "auth view seg_activities" ON public.seg_activities;
DROP POLICY IF EXISTS "seg_activities_select_all" ON public.seg_activities;
CREATE POLICY "Scoped view seg_activities" ON public.seg_activities
FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = assignee
  OR public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.seg_partners p
    WHERE p.id = seg_activities.partner_id
      AND (auth.uid() = p.created_by OR auth.uid() = p.assignee)
  )
);

-- seg_attachments: mirror seg_partners scope
DROP POLICY IF EXISTS "Authenticated can view seg attachments" ON public.seg_attachments;
DROP POLICY IF EXISTS "auth view seg_attachments" ON public.seg_attachments;
DROP POLICY IF EXISTS "seg_attachments_select_all" ON public.seg_attachments;
CREATE POLICY "Scoped view seg_attachments" ON public.seg_attachments
FOR SELECT TO authenticated
USING (
  auth.uid() = uploaded_by
  OR public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.seg_partners p
    WHERE p.id = seg_attachments.partner_id
      AND (auth.uid() = p.created_by OR auth.uid() = p.assignee)
  )
  OR EXISTS (
    SELECT 1 FROM public.seg_activities a
    WHERE a.id = seg_attachments.activity_id
      AND (auth.uid() = a.created_by OR auth.uid() = a.assignee)
  )
);

-- leads: restrict INSERT to prevent arbitrary assignment
DROP POLICY IF EXISTS "Authenticated insert leads" ON public.leads;
CREATE POLICY "Authenticated insert leads" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  assigned_to IS NULL
  OR auth.uid() = assigned_to
  OR public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
);
