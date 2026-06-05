DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.app_settings;

CREATE POLICY "Only super admin can insert dashboard settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN key = 'dashboard.layout'
      OR key = 'dashboard.widgets'
      OR key LIKE 'grid.dashboard.%'
    THEN public.is_super_admin(auth.uid())
    ELSE public.is_admin(auth.uid())
  END
);

CREATE POLICY "Only super admin can update dashboard settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN key = 'dashboard.layout'
      OR key = 'dashboard.widgets'
      OR key LIKE 'grid.dashboard.%'
    THEN public.is_super_admin(auth.uid())
    ELSE public.is_admin(auth.uid())
  END
)
WITH CHECK (
  CASE
    WHEN key = 'dashboard.layout'
      OR key = 'dashboard.widgets'
      OR key LIKE 'grid.dashboard.%'
    THEN public.is_super_admin(auth.uid())
    ELSE public.is_admin(auth.uid())
  END
);

CREATE POLICY "Only super admin can delete dashboard settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (
  CASE
    WHEN key = 'dashboard.layout'
      OR key = 'dashboard.widgets'
      OR key LIKE 'grid.dashboard.%'
    THEN public.is_super_admin(auth.uid())
    ELSE public.is_admin(auth.uid())
  END
);