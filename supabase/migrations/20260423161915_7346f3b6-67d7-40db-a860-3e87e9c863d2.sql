
-- Sales table indexes for dashboard, ledger, and search queries
CREATE INDEX IF NOT EXISTS idx_sales_open_date ON public.sales (open_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales (status);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales (created_by);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON public.sales (channel);
CREATE INDEX IF NOT EXISTS idx_sales_product ON public.sales (product);
CREATE INDEX IF NOT EXISTS idx_sales_approval_status ON public.sales (approval_status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_name ON public.sales (customer_name);
CREATE INDEX IF NOT EXISTS idx_sales_phone ON public.sales (phone);
CREATE INDEX IF NOT EXISTS idx_sales_open_date_status ON public.sales (open_date, status);
CREATE INDEX IF NOT EXISTS idx_sales_open_month ON public.sales (open_month);

-- Inquiries indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inquiries_channel ON public.inquiries (channel);
CREATE INDEX IF NOT EXISTS idx_inquiries_customer_name ON public.inquiries (customer_name);
CREATE INDEX IF NOT EXISTS idx_inquiries_phone ON public.inquiries (phone);
CREATE INDEX IF NOT EXISTS idx_inquiries_inquiry_date ON public.inquiries (inquiry_date);

-- Field options for admin pages
CREATE INDEX IF NOT EXISTS idx_field_options_field_sort ON public.field_options (field, sort_order);

-- Notifications for bell icon queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications (recipient_id, read_at);

-- Device inventory
CREATE INDEX IF NOT EXISTS idx_device_inventory_status ON public.device_inventory (status);
CREATE INDEX IF NOT EXISTS idx_device_inventory_serial ON public.device_inventory (serial_no);

-- Profiles for user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- Sales audit log
CREATE INDEX IF NOT EXISTS idx_sales_audit_sale_id ON public.sales_audit_log (sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_audit_changed_at ON public.sales_audit_log (changed_at);

-- Ad spend for finance dashboard
CREATE INDEX IF NOT EXISTS idx_ad_spend_date ON public.ad_spend (spend_date);
CREATE INDEX IF NOT EXISTS idx_ad_spend_month ON public.ad_spend (spend_month);
