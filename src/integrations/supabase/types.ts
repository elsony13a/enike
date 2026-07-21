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
      ad_networks: {
        Row: {
          base_url: string
          created_at: string
          id: string
          is_active: boolean
          last_sync_error: string | null
          last_synced_at: string | null
          name: string
          offer_feed_url: string | null
          points_per_dollar: number
          postback_secure_key: string
          profit_margin_pct: number
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          name: string
          offer_feed_url?: string | null
          points_per_dollar?: number
          postback_secure_key: string
          profit_margin_pct?: number
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          name?: string
          offer_feed_url?: string | null
          points_per_dollar?: number
          postback_secure_key?: string
          profit_margin_pct?: number
        }
        Relationships: []
      }
      offers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          network_id: string | null
          network_name: string
          offer_id: string
          payout: number
          target_country: string | null
          target_device: string | null
          title: string
          tracking_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          network_id?: string | null
          network_name: string
          offer_id: string
          payout?: number
          target_country?: string | null
          target_device?: string | null
          title: string
          tracking_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          network_id?: string | null
          network_name?: string
          offer_id?: string
          payout?: number
          target_country?: string | null
          target_device?: string | null
          title?: string
          tracking_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "ad_networks"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          address: string
          created_at: string
          id: string
          method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          method: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          address: string
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string
          method: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      placements: {
        Row: {
          app_id: string
          created_at: string
          id: string
          name: string
          secret_key: string
          site_url: string
          user_id: string
        }
        Insert: {
          app_id?: string
          created_at?: string
          id?: string
          name: string
          secret_key?: string
          site_url: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          name?: string
          secret_key?: string
          site_url?: string
          user_id?: string
        }
        Relationships: []
      }
      postback_logs: {
        Row: {
          click_id: string | null
          created_at: string
          id: string
          network_name: string | null
          payout: number | null
          placement_id: string | null
          points_awarded: number | null
          publisher_id: string | null
          raw_params: Json
          response_code: number
          response_message: string | null
          status: string | null
          verified: boolean
        }
        Insert: {
          click_id?: string | null
          created_at?: string
          id?: string
          network_name?: string | null
          payout?: number | null
          placement_id?: string | null
          points_awarded?: number | null
          publisher_id?: string | null
          raw_params?: Json
          response_code?: number
          response_message?: string | null
          status?: string | null
          verified?: boolean
        }
        Update: {
          click_id?: string | null
          created_at?: string
          id?: string
          network_name?: string | null
          payout?: number | null
          placement_id?: string | null
          points_awarded?: number | null
          publisher_id?: string | null
          raw_params?: Json
          response_code?: number
          response_message?: string | null
          status?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "postback_logs_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postback_logs_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      publisher_postbacks: {
        Row: {
          created_at: string
          id: string
          postback_url: string
          publisher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          postback_url: string
          publisher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          postback_url?: string
          publisher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publisher_postbacks_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      publishers: {
        Row: {
          app_id: string
          created_at: string
          email: string
          id: string
          name: string
          secret_key: string
          status: string
          telegram: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          secret_key: string
          status?: string
          telegram?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          secret_key?: string
          status?: string
          telegram?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          click_id: string | null
          country: string | null
          created_at: string
          id: string
          network_name: string
          offer_id: string | null
          offer_name: string | null
          payout: number
          points_awarded: number
          publisher_id: string
          reward_amount: number
          status: string
          trans_id: string
          user_id: string
        }
        Insert: {
          click_id?: string | null
          country?: string | null
          created_at?: string
          id?: string
          network_name: string
          offer_id?: string | null
          offer_name?: string | null
          payout?: number
          points_awarded?: number
          publisher_id: string
          reward_amount?: number
          status?: string
          trans_id: string
          user_id: string
        }
        Update: {
          click_id?: string | null
          country?: string | null
          created_at?: string
          id?: string
          network_name?: string
          offer_id?: string | null
          offer_name?: string | null
          payout?: number
          points_awarded?: number
          publisher_id?: string
          reward_amount?: number
          status?: string
          trans_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          balance_points: number
          created_at: string
          last_credited_at: string | null
          publisher_id: string
          total_credited_usd: number
          total_earned_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_points?: number
          created_at?: string
          last_credited_at?: string | null
          publisher_id: string
          total_credited_usd?: number
          total_earned_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_points?: number
          created_at?: string
          last_credited_at?: string | null
          publisher_id?: string
          total_credited_usd?: number
          total_earned_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_balances_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      gen_app_id: { Args: never; Returns: string }
      gen_secret_key: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "publisher"
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
      app_role: ["admin", "publisher"],
    },
  },
} as const
