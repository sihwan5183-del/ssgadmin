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
      ad_spend: {
        Row: {
          amount: number
          campaign: string | null
          category: string
          channel: string | null
          created_at: string
          created_by: string
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
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          team: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          team?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          team?: string | null
          updated_at?: string
          user_id?: string
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
      sales: {
        Row: {
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
          customer_name: string | null
          delivery_type: string | null
          device_model: string | null
          device_serial: string | null
          distributor_amount: number | null
          extra_subsidy: number | null
          id: string
          manager: string | null
          moyo_excluded: boolean | null
          net_fee: number | null
          note: string | null
          open_date: string | null
          open_method: string | null
          open_month: string | null
          phone: string | null
          product: string | null
          rate_plan: string | null
          receivable_amount: number | null
          receivable_paid: string | null
          sale_type: string | null
          seq: number | null
          status: string | null
          tracking_no: string | null
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
          customer_name?: string | null
          delivery_type?: string | null
          device_model?: string | null
          device_serial?: string | null
          distributor_amount?: number | null
          extra_subsidy?: number | null
          id?: string
          manager?: string | null
          moyo_excluded?: boolean | null
          net_fee?: number | null
          note?: string | null
          open_date?: string | null
          open_method?: string | null
          open_month?: string | null
          phone?: string | null
          product?: string | null
          rate_plan?: string | null
          receivable_amount?: number | null
          receivable_paid?: string | null
          sale_type?: string | null
          seq?: number | null
          status?: string | null
          tracking_no?: string | null
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
          customer_name?: string | null
          delivery_type?: string | null
          device_model?: string | null
          device_serial?: string | null
          distributor_amount?: number | null
          extra_subsidy?: number | null
          id?: string
          manager?: string | null
          moyo_excluded?: boolean | null
          net_fee?: number | null
          note?: string | null
          open_date?: string | null
          open_method?: string | null
          open_month?: string | null
          phone?: string | null
          product?: string | null
          rate_plan?: string | null
          receivable_amount?: number | null
          receivable_paid?: string | null
          sale_type?: string | null
          seq?: number | null
          status?: string | null
          tracking_no?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
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
      app_role: ["admin", "manager", "user"],
    },
  },
} as const
