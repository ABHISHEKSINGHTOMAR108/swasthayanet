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
      alerts: {
        Row: {
          created_at: string
          days_remaining: number
          id: string
          medicine_id: string
          phc_id: string
          resolved: boolean
          severity: string
        }
        Insert: {
          created_at?: string
          days_remaining: number
          id?: string
          medicine_id: string
          phc_id: string
          resolved?: boolean
          severity: string
        }
        Update: {
          created_at?: string
          days_remaining?: number
          id?: string
          medicine_id?: string
          phc_id?: string
          resolved?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_phc_id_fkey"
            columns: ["phc_id"]
            isOneToOne: false
            referencedRelation: "phcs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bed_status: {
        Row: {
          beds_occupied: number
          id: string
          phc_id: string
          recorded_at: string
        }
        Insert: {
          beds_occupied: number
          id?: string
          phc_id: string
          recorded_at?: string
        }
        Update: {
          beds_occupied?: number
          id?: string
          phc_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bed_status_phc_id_fkey"
            columns: ["phc_id"]
            isOneToOne: false
            referencedRelation: "phcs"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          base_qty: number
          daily_burn: number
          id: string
          name: string
          unit: string
        }
        Insert: {
          base_qty?: number
          daily_burn?: number
          id?: string
          name: string
          unit: string
        }
        Update: {
          base_qty?: number
          daily_burn?: number
          id?: string
          name?: string
          unit?: string
        }
        Relationships: []
      }
      phcs: {
        Row: {
          beds_total: number
          created_at: string
          district: string
          id: string
          lat: number
          lng: number
          name: string
          state: string
        }
        Insert: {
          beds_total?: number
          created_at?: string
          district: string
          id?: string
          lat: number
          lng: number
          name: string
          state: string
        }
        Update: {
          beds_total?: number
          created_at?: string
          district?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          state?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          district: string | null
          email: string
          id: string
          name: string
          phc_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          state: string | null
        }
        Insert: {
          created_at?: string
          district?: string | null
          email?: string
          id: string
          name?: string
          phc_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
        }
        Update: {
          created_at?: string
          district?: string | null
          email?: string
          id?: string
          name?: string
          phc_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_phc_id_fkey"
            columns: ["phc_id"]
            isOneToOne: false
            referencedRelation: "phcs"
            referencedColumns: ["id"]
          },
        ]
      }
      redistribution_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          distance_km: number
          from_phc_id: string
          id: string
          medicine_id: string
          status: string
          to_phc_id: string
          units: number
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          distance_km: number
          from_phc_id: string
          id?: string
          medicine_id: string
          status?: string
          to_phc_id: string
          units: number
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          distance_km?: number
          from_phc_id?: string
          id?: string
          medicine_id?: string
          status?: string
          to_phc_id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "redistribution_requests_from_phc_id_fkey"
            columns: ["from_phc_id"]
            isOneToOne: false
            referencedRelation: "phcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redistribution_requests_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redistribution_requests_to_phc_id_fkey"
            columns: ["to_phc_id"]
            isOneToOne: false
            referencedRelation: "phcs"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          id: string
          phc_id: string
          recorded_at: string
          staff_present_pct: number
        }
        Insert: {
          id?: string
          phc_id: string
          recorded_at?: string
          staff_present_pct: number
        }
        Update: {
          id?: string
          phc_id?: string
          recorded_at?: string
          staff_present_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_phc_id_fkey"
            columns: ["phc_id"]
            isOneToOne: false
            referencedRelation: "phcs"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_entries: {
        Row: {
          id: string
          medicine_id: string
          phc_id: string
          quantity: number
          recorded_at: string
          recorded_by: string | null
        }
        Insert: {
          id?: string
          medicine_id: string
          phc_id: string
          quantity: number
          recorded_at?: string
          recorded_by?: string | null
        }
        Update: {
          id?: string
          medicine_id?: string
          phc_id?: string
          quantity?: number
          recorded_at?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_phc_id_fkey"
            columns: ["phc_id"]
            isOneToOne: false
            referencedRelation: "phcs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      my_phc_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "staff" | "officer" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["staff", "officer", "admin"],
    },
  },
} as const
