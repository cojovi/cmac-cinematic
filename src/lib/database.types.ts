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
      activities: {
        Row: {
          activity_type: string
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          employee_id: string | null
          id: string
          lead_id: string | null
          metadata: Json
          title: string
        }
        Insert: {
          activity_type: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          employee_id?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          title: string
        }
        Update: {
          activity_type?: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          employee_id?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_employee_id: string | null
          billing_address: string | null
          city: string | null
          company: string | null
          created_at: string
          created_by: string | null
          display_name: string
          email: string
          first_name: string
          id: string
          last_name: string
          lifecycle_stage: string
          phone: string | null
          postal_code: string | null
          project_address: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          assigned_employee_id?: string | null
          billing_address?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          email: string
          first_name: string
          id?: string
          last_name?: string
          lifecycle_stage?: string
          phone?: string | null
          postal_code?: string | null
          project_address?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          assigned_employee_id?: string | null
          billing_address?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          lifecycle_stage?: string
          phone?: string | null
          postal_code?: string | null
          project_address?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          completed_at: string | null
          completion_certificate_path: string | null
          contact_id: string
          created_at: string
          deal_id: string
          declined_at: string | null
          delivered_at: string | null
          employee_id: string
          error_message: string | null
          id: string
          provider: string
          provider_envelope_id: string | null
          sent_at: string | null
          signed_at: string | null
          signed_document_path: string | null
          status: string
          template_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completion_certificate_path?: string | null
          contact_id: string
          created_at?: string
          deal_id: string
          declined_at?: string | null
          delivered_at?: string | null
          employee_id: string
          error_message?: string | null
          id?: string
          provider?: string
          provider_envelope_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_document_path?: string | null
          status?: string
          template_id: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completion_certificate_path?: string | null
          contact_id?: string
          created_at?: string
          deal_id?: string
          declined_at?: string | null
          delivered_at?: string | null
          employee_id?: string
          error_message?: string | null
          id?: string
          provider?: string
          provider_envelope_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_document_path?: string | null
          status?: string
          template_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_units: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          deal_id: string
          external_product_type: string
          external_unit_id: string
          id: string
          source: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          deal_id: string
          external_product_type: string
          external_unit_id: string
          id?: string
          source?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          deal_id?: string
          external_product_type?: string
          external_unit_id?: string
          id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_units_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_units_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          base_amount: number
          closed_at: string | null
          contact_id: string
          created_at: string
          deal_number: string
          delivery_amount: number
          delivery_estimate: string | null
          deposit_percent: number
          id: string
          lead_id: string | null
          notes: string | null
          project_address: string | null
          project_name: string | null
          sales_rep_id: string
          signed_at: string | null
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          base_amount?: number
          closed_at?: string | null
          contact_id: string
          created_at?: string
          deal_number?: string
          delivery_amount?: number
          delivery_estimate?: string | null
          deposit_percent?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          project_address?: string | null
          project_name?: string | null
          sales_rep_id: string
          signed_at?: string | null
          stage?: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_amount?: number
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          deal_number?: string
          delivery_amount?: number
          delivery_estimate?: string | null
          deposit_percent?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          project_address?: string | null
          project_name?: string | null
          sales_rep_id?: string
          signed_at?: string | null
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          provider: string | null
          provider_template_id: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          provider?: string | null
          provider_template_id?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          provider?: string | null
          provider_template_id?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          display_name: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          rep_code: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          display_name: string
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          rep_code?: string
          role: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          rep_code?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_employee_id: string | null
          contact_id: string
          converted_at: string | null
          created_at: string
          desired_timing: string | null
          id: string
          lost_reason: string | null
          project_location: string | null
          project_type: string | null
          source: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          assigned_employee_id?: string | null
          contact_id: string
          converted_at?: string | null
          created_at?: string
          desired_timing?: string | null
          id?: string
          lost_reason?: string | null
          project_location?: string | null
          project_type?: string | null
          source?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          assigned_employee_id?: string | null
          contact_id?: string
          converted_at?: string | null
          created_at?: string
          desired_timing?: string | null
          id?: string
          lost_reason?: string | null
          project_location?: string | null
          project_type?: string | null
          source?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_materials: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          default_body: string | null
          default_subject: string | null
          description: string | null
          display_order: number
          file_name: string
          file_size: number
          id: string
          is_active: boolean
          mime_type: string
          slug: string
          storage_path: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          default_body?: string | null
          default_subject?: string | null
          description?: string | null
          display_order?: number
          file_name: string
          file_size: number
          id?: string
          is_active?: boolean
          mime_type: string
          slug: string
          storage_path: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          default_body?: string | null
          default_subject?: string | null
          description?: string | null
          display_order?: number
          file_name?: string
          file_size?: number
          id?: string
          is_active?: boolean
          mime_type?: string
          slug?: string
          storage_path?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_send_items: {
        Row: {
          id: string
          marketing_material_id: string
          marketing_send_id: string
        }
        Insert: {
          id?: string
          marketing_material_id: string
          marketing_send_id: string
        }
        Update: {
          id?: string
          marketing_material_id?: string
          marketing_send_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_send_items_marketing_material_id_fkey"
            columns: ["marketing_material_id"]
            isOneToOne: false
            referencedRelation: "marketing_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_send_items_marketing_send_id_fkey"
            columns: ["marketing_send_id"]
            isOneToOne: false
            referencedRelation: "marketing_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sends: {
        Row: {
          body: string
          contact_id: string
          created_at: string
          employee_id: string
          error_message: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          lead_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          contact_id: string
          created_at?: string
          employee_id: string
          error_message?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          lead_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          contact_id?: string
          created_at?: string
          employee_id?: string
          error_message?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          lead_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sends_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          line_total: number | null
          quantity: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number
          id?: string
          line_total?: number | null
          quantity?: number
          quote_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          line_total?: number | null
          quantity?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          contact_id: string
          created_at: string
          deal_id: string | null
          delivery_amount: number
          employee_id: string
          expired_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          quote_number: string
          sent_at: string | null
          status: string
          subtotal: number
          tax: number
          total: number | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          contact_id: string
          created_at?: string
          deal_id?: string | null
          delivery_amount?: number
          employee_id: string
          expired_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          contact_id?: string
          created_at?: string
          deal_id?: string | null
          delivery_amount?: number
          employee_id?: string
          expired_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_at: string
          employee_id: string
          id: string
          lead_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_at: string
          employee_id: string
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_at?: string
          employee_id?: string
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_sales: {
        Row: {
          created_at: string
          deal_id: string
          employee_id: string
          external_product_type: string
          external_unit_id: string
          id: string
          sold_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          employee_id: string
          external_product_type: string
          external_unit_id: string
          id?: string
          sold_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          employee_id?: string
          external_product_type?: string
          external_unit_id?: string
          id?: string
          sold_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_sales_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_sales_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_manage_employee: {
        Args: {
          p_action: string
          p_actor_employee_id: string
          p_employee?: Json
          p_employee_id?: string
        }
        Returns: Json
      }
      complete_deal_sale: {
        Args: {
          p_actor_employee_id: string
          p_deal_id: string
          p_override_reason?: string
        }
        Returns: Json
      }
      manage_lead: {
        Args: {
          p_action: string
          p_actor_employee_id: string
          p_lead_id?: string
          p_payload?: Json
        }
        Returns: Json
      }
      process_contract_event: {
        Args: {
          p_envelope_id: string
          p_event_type: string
          p_occurred_at: string
          p_payload: Json
          p_provider_event_id: string
        }
        Returns: Json
      }
      submit_public_lead: {
        Args: {
          p_desired_timing: string
          p_display_name: string
          p_email: string
          p_email_hash: string
          p_first_name: string
          p_ip_hash: string
          p_last_name: string
          p_phone: string
          p_project_location: string
          p_project_type: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

export type EmployeeRole = 'admin' | 'sales_rep'
export type EmployeeRow = Omit<Tables<'employees'>, 'role'> & { role: EmployeeRole }
export type ContactRow = Tables<'contacts'>
export type LeadRow = Tables<'leads'>
export type PublicTableName = keyof Database['public']['Tables']

export interface InventorySummary {
  available_inventory: number
  allocated_boss: number
  last_synced_at: string
}

export type JsonRecord = Record<string, unknown>
