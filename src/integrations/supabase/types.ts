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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      centres: {
        Row: {
          created_at: string
          geo_fence_radius_meters: number
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          created_at?: string
          geo_fence_radius_meters?: number
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          created_at?: string
          geo_fence_radius_meters?: number
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          centre_id: string
          checkin_date: string
          checkin_lat: number | null
          checkin_lng: number | null
          checkin_time: string | null
          checkout_lat: number | null
          checkout_lng: number | null
          checkout_time: string | null
          created_at: string
          gps_km: number | null
          id: string
          manual_end_km: number | null
          manual_km_approved: boolean | null
          manual_start_km: number | null
          status: string
          total_km: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          centre_id: string
          checkin_date?: string
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_time?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          checkout_time?: string | null
          created_at?: string
          gps_km?: number | null
          id?: string
          manual_end_km?: number | null
          manual_km_approved?: boolean | null
          manual_start_km?: number | null
          status?: string
          total_km?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          centre_id?: string
          checkin_date?: string
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_time?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          checkout_time?: string | null
          created_at?: string
          gps_km?: number | null
          id?: string
          manual_end_km?: number | null
          manual_km_approved?: boolean | null
          manual_start_km?: number | null
          status?: string
          total_km?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_claims: {
        Row: {
          admin_comments: string | null
          centre_id: string
          claim_month: string
          created_at: string
          da_eligible_days: number
          grand_total: number
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string | null
          total_da: number
          total_doctor_visits: number
          total_km: number
          total_ta: number
          updated_at: string
          user_id: string
          working_days: number
        }
        Insert: {
          admin_comments?: string | null
          centre_id: string
          claim_month: string
          created_at?: string
          da_eligible_days?: number
          grand_total?: number
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          total_da?: number
          total_doctor_visits?: number
          total_km?: number
          total_ta?: number
          updated_at?: string
          user_id: string
          working_days?: number
        }
        Update: {
          admin_comments?: string | null
          centre_id?: string
          claim_month?: string
          created_at?: string
          da_eligible_days?: number
          grand_total?: number
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          total_da?: number
          total_doctor_visits?: number
          total_km?: number
          total_ta?: number
          updated_at?: string
          user_id?: string
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_claims_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          centre_id: string | null
          created_at: string
          employee_id: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          centre_id?: string | null
          created_at?: string
          employee_id: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          centre_id?: string | null
          created_at?: string
          employee_id?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          centre_id: string
          checkin_id: string | null
          created_at: string
          estimated_value: number | null
          id: string
          notes: string | null
          patient_name: string | null
          referral_centre: string | null
          referral_date: string
          referral_received: boolean
          service_type: Database["public"]["Enums"]["service_type"] | null
          user_id: string
        }
        Insert: {
          centre_id: string
          checkin_id?: string | null
          created_at?: string
          estimated_value?: number | null
          id?: string
          notes?: string | null
          patient_name?: string | null
          referral_centre?: string | null
          referral_date?: string
          referral_received?: boolean
          service_type?: Database["public"]["Enums"]["service_type"] | null
          user_id: string
        }
        Update: {
          centre_id?: string
          checkin_id?: string | null
          created_at?: string
          estimated_value?: number | null
          id?: string
          notes?: string | null
          patient_name?: string | null
          referral_centre?: string | null
          referral_date?: string
          referral_received?: boolean
          service_type?: Database["public"]["Enums"]["service_type"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "daily_checkins"
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
      visits: {
        Row: {
          centre_id: string
          checkin_id: string
          checkin_time: string | null
          checkout_time: string | null
          contact_number: string | null
          created_at: string
          designation: string | null
          id: string
          notes: string | null
          photo_urls: string[] | null
          purpose: string | null
          updated_at: string
          user_id: string
          visit_date: string
          visit_lat: number | null
          visit_lng: number | null
          visitor_name: string
          visitor_type: Database["public"]["Enums"]["visitor_type"]
        }
        Insert: {
          centre_id: string
          checkin_id: string
          checkin_time?: string | null
          checkout_time?: string | null
          contact_number?: string | null
          created_at?: string
          designation?: string | null
          id?: string
          notes?: string | null
          photo_urls?: string[] | null
          purpose?: string | null
          updated_at?: string
          user_id: string
          visit_date?: string
          visit_lat?: number | null
          visit_lng?: number | null
          visitor_name: string
          visitor_type: Database["public"]["Enums"]["visitor_type"]
        }
        Update: {
          centre_id?: string
          checkin_id?: string
          checkin_time?: string | null
          checkout_time?: string | null
          contact_number?: string | null
          created_at?: string
          designation?: string | null
          id?: string
          notes?: string | null
          photo_urls?: string[] | null
          purpose?: string | null
          updated_at?: string
          user_id?: string
          visit_date?: string
          visit_lat?: number | null
          visit_lng?: number | null
          visitor_name?: string
          visitor_type?: Database["public"]["Enums"]["visitor_type"]
        }
        Relationships: [
          {
            foreignKeyName: "visits_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "daily_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_monthly_claims: {
        Args: { _claim_month: string }
        Returns: {
          claims_created: number
          claims_updated: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
      claim_status: "draft" | "submitted" | "approved" | "rejected"
      km_entry_type: "gps" | "manual"
      service_type: "lab" | "opd" | "scan" | "admission"
      visitor_type: "doctor" | "lab" | "ambulance_driver" | "hospital" | "other"
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
      app_role: ["admin", "staff"],
      claim_status: ["draft", "submitted", "approved", "rejected"],
      km_entry_type: ["gps", "manual"],
      service_type: ["lab", "opd", "scan", "admission"],
      visitor_type: ["doctor", "lab", "ambulance_driver", "hospital", "other"],
    },
  },
} as const
