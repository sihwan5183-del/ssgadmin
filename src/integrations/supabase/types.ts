export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          ip: string | null
          last_seen_at: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_campaign_daily: {
        Row: {
          campaign_id: string
          clicks: number
          conversions: number
          created_at: string
          id: string
          impressions: number
          log_date: string
          note: string | null
          spend: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          log_date: string
          note?: string | null
          spend?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          log_date?: string
          note?: string | null
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaign_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          channel: string | null
          clicks: number
          conversions: number
          created_at: string
          created_by: string
          end_date: string
          id: string
          image_url: string | null
          impressions: number
          landing_url: string | null
          media: string
          note: string | null
          start_date: string
          status: string
          topic: string
          total_budget: number
          updated_at: string
        }
        Insert: {
          channel?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          image_url?: string | null
          impressions?: number
          landing_url?: string | null
          media: string
          note?: string | null
          start_date: string
          status?: string
          topic: string
          total_budget?: number
          updated_at?: string
        }
        Update: {
          channel?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          image_url?: string | null
          impressions?: number
          landing_url?: string | null
          media?: string
          note?: string | null
          start_date?: string
          status?: string
          topic?: string
          total_budget?: number
          updated_at?: string
        }
        Relationships: []
      }
      ad_spend: {
        Row: {
          amount: number
          campaign: string | null
          category: string
          channel: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          expense_type: string | null
          id: string
          media: string
          note: string | null
          spend_date: string
          spend_month: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          campaign?: string | null
          category?: string
          channel?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          expense_type?: string | null
          id?: string
          media: string
          note?: string | null
          spend_date: string
          spend_month?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          campaign?: string | null
          category?: string
          channel?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          expense_type?: string | null
          id?: string
          media?: string
          note?: string | null
          spend_date?: string
          spend_month?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      auth_attempts: {
        Row: {
          created_at: string
          detail: string | null
          email: string | null
          id: string
          ip: string | null
          kind: string
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          kind: string
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          kind?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          active: boolean
          category_type: string
          created_at: string
          created_by: string | null
          dashboard_included: boolean
          description: string | null
          field_mapping: string | null
          id: string
          is_included_in_base: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_type?: string
          created_at?: string
          created_by?: string | null
          dashboard_included?: boolean
          description?: string | null
          field_mapping?: string | null
          id?: string
          is_included_in_base?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_type?: string
          created_at?: string
          created_by?: string | null
          dashboard_included?: boolean
          description?: string | null
          field_mapping?: string | null
          id?: string
          is_included_in_base?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          assignee: string | null
          category: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          is_important: boolean
          location: string | null
          start_date: string
          store_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          assignee?: string | null
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          is_important?: boolean
          location?: string | null
          start_date: string
          store_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          assignee?: string | null
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          is_important?: boolean
          location?: string | null
          start_date?: string
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      device_inventory: {
        Row: {
          activated_at: string | null
          activated_sale_id: string | null
          capacity: string | null
          color: string | null
          created_at: string
          created_by: string
          current_store_id: string | null
          custom_fields: Json
          device_kind: string
          id: string
          model: string
          note: string | null
          purchase_price: number | null
          serial_no: string | null
          status: string
          stock_in_date: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_sale_id?: string | null
          capacity?: string | null
          color?: string | null
          created_at?: string
          created_by: string
          current_store_id?: string | null
          custom_fields?: Json
          device_kind?: string
          id?: string
          model: string
          note?: string | null
          purchase_price?: number | null
          serial_no?: string | null
          status?: string
          stock_in_date?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_sale_id?: string | null
          capacity?: string | null
          color?: string | null
          created_at?: string
          created_by?: string
          current_store_id?: string | null
          custom_fields?: Json
          device_kind?: string
          id?: string
          model?: string
          note?: string | null
          purchase_price?: number | null
          serial_no?: string | null
          status?: string
          stock_in_date?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      device_models: {
        Row: {
          active: boolean
          aliases: string[]
          created_at: string
          created_by: string | null
          id: string
          is_strategy: boolean
          manufacturer: string
          model_name: string
          official_name: string | null
          retail_price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          is_strategy?: boolean
          manufacturer?: string
          model_name: string
          official_name?: string | null
          retail_price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          is_strategy?: boolean
          manufacturer?: string
          model_name?: string
          official_name?: string | null
          retail_price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      device_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          device_id: string
          from_store_id: string | null
          id: string
          note: string | null
          reason: string | null
          requested_at: string
          requested_by: string
          status: string
          to_store_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          device_id: string
          from_store_id?: string | null
          id?: string
          note?: string | null
          reason?: string | null
          requested_at?: string
          requested_by: string
          status?: string
          to_store_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          device_id?: string
          from_store_id?: string | null
          id?: string
          note?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string
          status?: string
          to_store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_transfers_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_transfers_from_store_id_fkey"
            columns: ["from_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_transfers_to_store_id_fkey"
            columns: ["to_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      download_history: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_name: string
          file_size: number | null
          filters: Json
          id: string
          label: string
          row_count: number
          status: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          category: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          file_size?: number | null
          filters?: Json
          id?: string
          label: string
          row_count?: number
          status?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_size?: number | null
          filters?: Json
          id?: string
          label?: string
          row_count?: number
          status?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      excel_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          mapping: Json
          preset_name: string
          table_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          mapping: Json
          preset_name: string
          table_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          mapping?: Json
          preset_name?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_definitions: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          default_value: string | null
          field_key: string
          field_type: string
          id: string
          label: string
          options: Json | null
          required: boolean
          section: string | null
          sort_order: number
          table_name: string
          updated_at: string
          visible_in_form: boolean
          visible_in_list: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          field_key: string
          field_type?: string
          id?: string
          label: string
          options?: Json | null
          required?: boolean
          section?: string | null
          sort_order?: number
          table_name: string
          updated_at?: string
          visible_in_form?: boolean
          visible_in_list?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          required?: boolean
          section?: string | null
          sort_order?: number
          table_name?: string
          updated_at?: string
          visible_in_form?: boolean
          visible_in_list?: boolean
        }
        Relationships: []
      }
      field_labels: {
        Row: {
          display_name: string
          field_key: string
          id: string
          section: string | null
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          display_name: string
          field_key: string
          id?: string
          section?: string | null
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          display_name?: string
          field_key?: string
          id?: string
          section?: string | null
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      field_options: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          field: string
          id: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          field: string
          id?: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          field?: string
          id?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      incentive_rates: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          created_by: string | null
          grade_bonus: Json
          id: string
          label: string
          match_model: string | null
          match_product: string | null
          match_sale_type: string | null
          note: string | null
          pay_percent: number
          pay_type: string
          priority: number
          scope: string
          tiered_rates: Json
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          created_by?: string | null
          grade_bonus?: Json
          id?: string
          label: string
          match_model?: string | null
          match_product?: string | null
          match_sale_type?: string | null
          note?: string | null
          pay_percent?: number
          pay_type?: string
          priority?: number
          scope?: string
          tiered_rates?: Json
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          created_by?: string | null
          grade_bonus?: Json
          id?: string
          label?: string
          match_model?: string | null
          match_product?: string | null
          match_sale_type?: string | null
          note?: string | null
          pay_percent?: number
          pay_type?: string
          priority?: number
          scope?: string
          tiered_rates?: Json
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          channel: string
          content: string | null
          converted_sale_id: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          customer_name: string | null
          fail_reason: string | null
          id: string
          inquiry_date: string
          last_action_at: string | null
          manager: string | null
          note: string | null
          phone: string | null
          retry_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          content?: string | null
          converted_sale_id?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          customer_name?: string | null
          fail_reason?: string | null
          id?: string
          inquiry_date?: string
          last_action_at?: string | null
          manager?: string | null
          note?: string | null
          phone?: string | null
          retry_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          content?: string | null
          converted_sale_id?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          customer_name?: string | null
          fail_reason?: string | null
          id?: string
          inquiry_date?: string
          last_action_at?: string | null
          manager?: string | null
          note?: string | null
          phone?: string | null
          retry_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inquiry_logs: {
        Row: {
          action: string
          content: string | null
          created_at: string
          created_by: string
          id: string
          inquiry_id: string
        }
        Insert: {
          action?: string
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          inquiry_id: string
        }
        Update: {
          action?: string
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          inquiry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_logs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          issued_by: string | null
          purpose: string
          token_hash: string
          used_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          issued_by?: string | null
          purpose?: string
          token_hash: string
          used_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          issued_by?: string | null
          purpose?: string
          token_hash?: string
          used_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      master_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changes: Json
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      menu_groups: {
        Row: {
          active: boolean
          created_at: string
          icon: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          visible_roles: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          visible_roles?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          visible_roles?: string[]
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          active: boolean
          created_at: string
          group_id: string | null
          icon: string
          id: string
          is_admin_only: boolean
          label: string
          path: string
          sort_order: number
          updated_at: string
          visible_roles: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_id?: string | null
          icon?: string
          id?: string
          is_admin_only?: boolean
          label: string
          path: string
          sort_order?: number
          updated_at?: string
          visible_roles?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          group_id?: string | null
          icon?: string
          id?: string
          is_admin_only?: boolean
          label?: string
          path?: string
          sort_order?: number
          updated_at?: string
          visible_roles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "menu_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          link: string | null
          message: string | null
          metadata: Json | null
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: []
      }
      product_rate_plans: {
        Row: {
          active: boolean
          allowed_sale_types: string[] | null
          created_at: string
          created_by: string | null
          default_sale_type: string | null
          default_vas1: string | null
          default_vas2: string | null
          id: string
          product: string
          rate_plan: string
          sort_order: number
          updated_at: string
          vas_required: boolean
          vas1_duration: number | null
          vas1_locked: boolean
          vas2_duration: number | null
          vas2_locked: boolean
        }
        Insert: {
          active?: boolean
          allowed_sale_types?: string[] | null
          created_at?: string
          created_by?: string | null
          default_sale_type?: string | null
          default_vas1?: string | null
          default_vas2?: string | null
          id?: string
          product: string
          rate_plan: string
          sort_order?: number
          updated_at?: string
          vas_required?: boolean
          vas1_duration?: number | null
          vas1_locked?: boolean
          vas2_duration?: number | null
          vas2_locked?: boolean
        }
        Update: {
          active?: boolean
          allowed_sale_types?: string[] | null
          created_at?: string
          created_by?: string | null
          default_sale_type?: string | null
          default_vas1?: string | null
          default_vas2?: string | null
          id?: string
          product?: string
          rate_plan?: string
          sort_order?: number
          updated_at?: string
          vas_required?: boolean
          vas1_duration?: number | null
          vas1_locked?: boolean
          vas2_duration?: number | null
          vas2_locked?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          phone: string | null
          position: string | null
          status: string
          store: string | null
          team: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          phone?: string | null
          position?: string | null
          status?: string
          store?: string | null
          team?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          position?: string | null
          status?: string
          store?: string | null
          team?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_links: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          icon: string
          id: string
          label: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      regulars: {
        Row: {
          birth_date: string | null
          channel: string
          converted: boolean
          coupon_sent: boolean
          created_at: string
          created_by: string
          customer_name: string
          id: string
          manager: string | null
          note: string | null
          phone: string | null
          registered_date: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          channel: string
          converted?: boolean
          coupon_sent?: boolean
          created_at?: string
          created_by: string
          customer_name: string
          id?: string
          manager?: string | null
          note?: string | null
          phone?: string | null
          registered_date?: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          channel?: string
          converted?: boolean
          coupon_sent?: boolean
          created_at?: string
          created_by?: string
          customer_name?: string
          id?: string
          manager?: string | null
          note?: string | null
          phone?: string | null
          registered_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_documents: {
        Row: {
          created_at: string
          doc_type: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          sale_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          sale_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          sale_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          approval_override_reason: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          birth_date: string | null
          bundle: string | null
          cash_account: string | null
          cash_bank: string | null
          cash_holder: string | null
          cash_open: boolean | null
          cash_support_amount: number | null
          channel: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          customer_name: string | null
          delivery_type: string | null
          device_model: string | null
          device_serial: string | null
          distributor_amount: number | null
          extra_subsidy: number | null
          id: string
          locked: boolean
          manager: string | null
          moyo_excluded: boolean | null
          net_fee: number | null
          note: string | null
          open_date: string | null
          open_method: string | null
          open_month: string | null
          pending_items: Json
          pending_note: string | null
          pending_resolved: boolean
          phone: string | null
          product: string | null
          rate_plan: string | null
          re_review_requested_at: string | null
          receivable_amount: number | null
          receivable_paid: string | null
          revision_fields: string[] | null
          revision_reason: string | null
          revision_requested_at: string | null
          revision_requested_by: string | null
          sale_type: string | null
          seq: number | null
          status: string | null
          tracking_no: string | null
          trade_in_confirmed: number | null
          trade_in_enabled: boolean
          trade_in_estimate: number | null
          trade_in_model: string | null
          unit_price: number | null
          updated_at: string
          usim_model: string | null
          usim_serial: string | null
          vas_fee: number | null
          vas1: string | null
          vas2: string | null
          voucher: string | null
          voucher_returned: string | null
        }
        Insert: {
          approval_override_reason?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string | null
          bundle?: string | null
          cash_account?: string | null
          cash_bank?: string | null
          cash_holder?: string | null
          cash_open?: boolean | null
          cash_support_amount?: number | null
          channel?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          customer_name?: string | null
          delivery_type?: string | null
          device_model?: string | null
          device_serial?: string | null
          distributor_amount?: number | null
          extra_subsidy?: number | null
          id?: string
          locked?: boolean
          manager?: string | null
          moyo_excluded?: boolean | null
          net_fee?: number | null
          note?: string | null
          open_date?: string | null
          open_method?: string | null
          open_month?: string | null
          pending_items?: Json
          pending_note?: string | null
          pending_resolved?: boolean
          phone?: string | null
          product?: string | null
          rate_plan?: string | null
          re_review_requested_at?: string | null
          receivable_amount?: number | null
          receivable_paid?: string | null
          revision_fields?: string[] | null
          revision_reason?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          sale_type?: string | null
          seq?: number | null
          status?: string | null
          tracking_no?: string | null
          trade_in_confirmed?: number | null
          trade_in_enabled?: boolean
          trade_in_estimate?: number | null
          trade_in_model?: string | null
          unit_price?: number | null
          updated_at?: string
          usim_model?: string | null
          usim_serial?: string | null
          vas_fee?: number | null
          vas1?: string | null
          vas2?: string | null
          voucher?: string | null
          voucher_returned?: string | null
        }
        Update: {
          approval_override_reason?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string | null
          bundle?: string | null
          cash_account?: string | null
          cash_bank?: string | null
          cash_holder?: string | null
          cash_open?: boolean | null
          cash_support_amount?: number | null
          channel?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          customer_name?: string | null
          delivery_type?: string | null
          device_model?: string | null
          device_serial?: string | null
          distributor_amount?: number | null
          extra_subsidy?: number | null
          id?: string
          locked?: boolean
          manager?: string | null
          moyo_excluded?: boolean | null
          net_fee?: number | null
          note?: string | null
          open_date?: string | null
          open_method?: string | null
          open_month?: string | null
          pending_items?: Json
          pending_note?: string | null
          pending_resolved?: boolean
          phone?: string | null
          product?: string | null
          rate_plan?: string | null
          re_review_requested_at?: string | null
          receivable_amount?: number | null
          receivable_paid?: string | null
          revision_fields?: string[] | null
          revision_reason?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          sale_type?: string | null
          seq?: number | null
          status?: string | null
          tracking_no?: string | null
          trade_in_confirmed?: number | null
          trade_in_enabled?: boolean
          trade_in_estimate?: number | null
          trade_in_model?: string | null
          unit_price?: number | null
          updated_at?: string
          usim_model?: string | null
          usim_serial?: string | null
          vas_fee?: number | null
          vas1?: string | null
          vas2?: string | null
          voucher?: string | null
          voucher_returned?: string | null
        }
        Relationships: []
      }
      sales_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changes: Json
          id: string
          sale_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: string
          sale_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_audit_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          manager: string | null
          name: string
          phone: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          manager?: string | null
          name: string
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          manager?: string | null
          name?: string
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_label: string | null
          expires_at: string
          id: string
          ip: string | null
          last_used_at: string
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          expires_at: string
          id?: string
          ip?: string | null
          last_used_at?: string
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          expires_at?: string
          id?: string
          ip?: string | null
          last_used_at?: string
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      upload_batches: {
        Row: {
          created_at: string
          error_report: Json
          error_rows: number
          file_name: string
          id: string
          mapping_preset: string | null
          success_rows: number
          table_name: string
          template_version: string | null
          total_rows: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          error_report?: Json
          error_rows?: number
          file_name: string
          id?: string
          mapping_preset?: string | null
          success_rows?: number
          table_name: string
          template_version?: string | null
          total_rows?: number
          uploaded_by: string
        }
        Update: {
          created_at?: string
          error_report?: Json
          error_rows?: number
          file_name?: string
          id?: string
          mapping_preset?: string | null
          success_rows?: number
          table_name?: string
          template_version?: string | null
          total_rows?: number
          uploaded_by?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_download_history: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ceo: { Args: { _user_id: string }; Returns: boolean }
      is_planner: { Args: { _user_id: string }; Returns: boolean }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      normalize_device_model: { Args: { _raw: string }; Returns: string }
      normalize_serial_no: { Args: { _raw: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "user"
        | "ceo"
        | "planner"
        | "team_lead"
        | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "manager",
        "user",
        "ceo",
        "planner",
        "team_lead",
        "staff",
      ],
    },
  },
} as const
