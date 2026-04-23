-- Sales performance indexes
CREATE INDEX IF NOT EXISTS idx_sales_open_date ON public.sales (open_date);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales (created_by);
CREATE INDEX IF NOT EXISTS idx_sales_approval_status ON public.sales (approval_status);
CREATE INDEX IF NOT EXISTS idx_sales_open_month_user ON public.sales (open_month, created_by);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON public.sales (channel);
CREATE INDEX IF NOT EXISTS idx_sales_product ON public.sales (product);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

-- Incentive policies
CREATE INDEX IF NOT EXISTS idx_incentive_policies_active ON public.incentive_policies (active);

-- Device inventory
CREATE INDEX IF NOT EXISTS idx_device_inventory_status ON public.device_inventory (status);
CREATE INDEX IF NOT EXISTS idx_device_inventory_store ON public.device_inventory (current_store_id);
CREATE INDEX IF NOT EXISTS idx_device_inventory_serial ON public.device_inventory (serial_no);

-- Inquiries
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_by ON public.inquiries (created_by);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications (recipient_id, read_at);

-- Sales audit log
CREATE INDEX IF NOT EXISTS idx_sales_audit_sale ON public.sales_audit_log (sale_id);