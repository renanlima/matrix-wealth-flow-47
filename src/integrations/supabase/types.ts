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
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          client_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_price_errors: {
        Row: {
          error_message: string
          id: string
          occurred_at: string
          symbol: string
        }
        Insert: {
          error_message: string
          id?: string
          occurred_at?: string
          symbol: string
        }
        Update: {
          error_message?: string
          id?: string
          occurred_at?: string
          symbol?: string
        }
        Relationships: []
      }
      coin_prices: {
        Row: {
          name: string | null
          percent_change_24h: number | null
          price_usd: number
          symbol: string
          updated_at: string
        }
        Insert: {
          name?: string | null
          percent_change_24h?: number | null
          price_usd: number
          symbol: string
          updated_at?: string
        }
        Update: {
          name?: string | null
          percent_change_24h?: number | null
          price_usd?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          client_id: string
          created_at: string
          file_path: string
          id: string
          is_active: boolean
          notes: string | null
          signed_date: string | null
          version: number
        }
        Insert: {
          client_id: string
          created_at?: string
          file_path: string
          id?: string
          is_active?: boolean
          notes?: string | null
          signed_date?: string | null
          version?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          file_path?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          signed_date?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount_usd: number
          client_id: string
          created_at: string
          deposit_date: string
          id: string
          notes: string | null
        }
        Insert: {
          amount_usd: number
          client_id: string
          created_at?: string
          deposit_date?: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount_usd?: number
          client_id?: string
          created_at?: string
          deposit_date?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_income: {
        Row: {
          asset_symbol: string | null
          created_at: string
          data_registro: string
          data_saida: string | null
          fund_id: string
          id: string
          last_price_update_at: string | null
          notes: string | null
          preco_entrada_usd: number | null
          product_name: string
          taxa_anual_pct: number
          ultimo_preco_usd: number | null
          updated_at: string
          valor_aplicado_usd: number
        }
        Insert: {
          asset_symbol?: string | null
          created_at?: string
          data_registro: string
          data_saida?: string | null
          fund_id: string
          id?: string
          last_price_update_at?: string | null
          notes?: string | null
          preco_entrada_usd?: number | null
          product_name: string
          taxa_anual_pct: number
          ultimo_preco_usd?: number | null
          updated_at?: string
          valor_aplicado_usd: number
        }
        Update: {
          asset_symbol?: string | null
          created_at?: string
          data_registro?: string
          data_saida?: string | null
          fund_id?: string
          id?: string
          last_price_update_at?: string | null
          notes?: string | null
          preco_entrada_usd?: number | null
          product_name?: string
          taxa_anual_pct?: number
          ultimo_preco_usd?: number | null
          updated_at?: string
          valor_aplicado_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_income_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "client_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_income_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      funds: {
        Row: {
          carried_deficit_usd: number
          client_id: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          performance_fee_pct: number
          start_date: string
          status: Database["public"]["Enums"]["fund_status"]
          updated_at: string
        }
        Insert: {
          carried_deficit_usd?: number
          client_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          performance_fee_pct?: number
          start_date?: string
          status?: Database["public"]["Enums"]["fund_status"]
          updated_at?: string
        }
        Update: {
          carried_deficit_usd?: number
          client_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          performance_fee_pct?: number
          start_date?: string
          status?: Database["public"]["Enums"]["fund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funds_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      futures_records: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          file_path: string | null
          file_type: string | null
          id: string
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "futures_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          pair: string
          rate: number
          updated_at: string
        }
        Insert: {
          pair: string
          rate: number
          updated_at?: string
        }
        Update: {
          pair?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          coin_name: string | null
          coin_symbol: string
          created_at: string
          entry_price_usd: number
          fund_id: string
          id: string
          is_futures: boolean
          notes: string | null
          purchase_date: string
          quantity: number
          status: Database["public"]["Enums"]["holding_status"]
          updated_at: string
        }
        Insert: {
          coin_name?: string | null
          coin_symbol: string
          created_at?: string
          entry_price_usd: number
          fund_id: string
          id?: string
          is_futures?: boolean
          notes?: string | null
          purchase_date?: string
          quantity: number
          status?: Database["public"]["Enums"]["holding_status"]
          updated_at?: string
        }
        Update: {
          coin_name?: string | null
          coin_symbol?: string
          created_at?: string
          entry_price_usd?: number
          fund_id?: string
          id?: string
          is_futures?: boolean
          notes?: string | null
          purchase_date?: string
          quantity?: number
          status?: Database["public"]["Enums"]["holding_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "client_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          file_path: string
          id: string
          notes: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          file_path: string
          id?: string
          notes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          file_path?: string
          id?: string
          notes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          items_failed: number | null
          items_processed: number | null
          job_name: string
          message: string | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          job_name: string
          message?: string | null
          started_at?: string
          status: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          job_name?: string
          message?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      mural_posts: {
        Row: {
          created_at: string
          file_path: string
          file_type: string
          id: string
          period_month: number
          period_year: number
          published_at: string
          title: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_type: string
          id?: string
          period_month: number
          period_year: number
          published_at?: string
          title: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_type?: string
          id?: string
          period_month?: number
          period_year?: number
          published_at?: string
          title?: string
        }
        Relationships: []
      }
      performance_history: {
        Row: {
          alocacoes_usd: number
          base_calculo_usd: number
          created_at: string
          deficit_anterior_usd: number
          desalocacoes_usd: number
          fechado_em: string | null
          fund_id: string
          id: string
          lucro_bruto_usd: number
          month: number
          novo_deficit_usd: number
          patrimonio_fim_usd: number
          patrimonio_inicio_usd: number
          taxa_aplicada_usd: number
          year: number
        }
        Insert: {
          alocacoes_usd?: number
          base_calculo_usd?: number
          created_at?: string
          deficit_anterior_usd?: number
          desalocacoes_usd?: number
          fechado_em?: string | null
          fund_id: string
          id?: string
          lucro_bruto_usd?: number
          month: number
          novo_deficit_usd?: number
          patrimonio_fim_usd?: number
          patrimonio_inicio_usd?: number
          taxa_aplicada_usd?: number
          year: number
        }
        Update: {
          alocacoes_usd?: number
          base_calculo_usd?: number
          created_at?: string
          deficit_anterior_usd?: number
          desalocacoes_usd?: number
          fechado_em?: string | null
          fund_id?: string
          id?: string
          lucro_bruto_usd?: number
          month?: number
          novo_deficit_usd?: number
          patrimonio_fim_usd?: number
          patrimonio_inicio_usd?: number
          taxa_aplicada_usd?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_history_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "client_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_history_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          action: string
          id: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          action: string
          id?: string
          occurred_at?: string
          user_id: string
        }
        Update: {
          action?: string
          id?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      realizations: {
        Row: {
          created_at: string
          exit_date: string
          exit_price_usd: number
          holding_id: string
          id: string
          notes: string | null
          profit_usd: number
          quantity: number
          total_usd: number
        }
        Insert: {
          created_at?: string
          exit_date?: string
          exit_price_usd: number
          holding_id: string
          id?: string
          notes?: string | null
          profit_usd: number
          quantity: number
          total_usd: number
        }
        Update: {
          created_at?: string
          exit_date?: string
          exit_price_usd?: number
          holding_id?: string
          id?: string
          notes?: string | null
          profit_usd?: number
          quantity?: number
          total_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "realizations_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_usd: number | null
          client_id: string
          created_at: string
          file_path: string
          id: string
          notes: string | null
          receipt_date: string | null
        }
        Insert: {
          amount_usd?: number | null
          client_id: string
          created_at?: string
          file_path: string
          id?: string
          notes?: string | null
          receipt_date?: string | null
        }
        Update: {
          amount_usd?: number | null
          client_id?: string
          created_at?: string
          file_path?: string
          id?: string
          notes?: string | null
          receipt_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount_usd: number
          client_id: string
          created_at: string
          id: string
          notes: string | null
          withdraw_date: string
        }
        Insert: {
          amount_usd: number
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          withdraw_date?: string
        }
        Update: {
          amount_usd?: number
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          withdraw_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_funds: {
        Row: {
          client_id: string | null
          created_at: string | null
          end_date: string | null
          id: string | null
          name: string | null
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["fund_status"] | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["fund_status"] | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["fund_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funds_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_performance_history: {
        Row: {
          alocacoes_usd: number | null
          created_at: string | null
          desalocacoes_usd: number | null
          fechado_em: string | null
          fund_id: string | null
          id: string | null
          lucro_bruto_usd: number | null
          month: number | null
          patrimonio_fim_usd: number | null
          patrimonio_inicio_usd: number | null
          year: number | null
        }
        Insert: {
          alocacoes_usd?: number | null
          created_at?: string | null
          desalocacoes_usd?: number | null
          fechado_em?: string | null
          fund_id?: string | null
          id?: string | null
          lucro_bruto_usd?: number | null
          month?: number | null
          patrimonio_fim_usd?: number | null
          patrimonio_inicio_usd?: number | null
          year?: number | null
        }
        Update: {
          alocacoes_usd?: number | null
          created_at?: string | null
          desalocacoes_usd?: number | null
          fechado_em?: string | null
          fund_id?: string | null
          id?: string | null
          lucro_bruto_usd?: number | null
          month?: number | null
          patrimonio_fim_usd?: number | null
          patrimonio_inicio_usd?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_history_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "client_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_history_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { _action: string; _max_per_minute?: number }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      realize_partial: {
        Args: {
          _exit_date: string
          _exit_price: number
          _holding_id: string
          _notes?: string
          _qty: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "client"
      fund_status: "ativo" | "encerrado"
      holding_status: "ativa" | "encerrada"
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
      app_role: ["admin", "client"],
      fund_status: ["ativo", "encerrado"],
      holding_status: ["ativa", "encerrada"],
    },
  },
} as const
