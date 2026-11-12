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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          business_id: string
          changed_at: string
          changed_by: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          updated_at: string
        }
        Insert: {
          action: string
          business_id: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          updated_at?: string
        }
        Update: {
          action?: string
          business_id?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      breeding_events: {
        Row: {
          bred_on: string
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          mare_id: string
          method: string
          notes: string | null
          semen_details: string | null
          stallion_id: string | null
          stallion_name: string | null
          updated_at: string
        }
        Insert: {
          bred_on: string
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          mare_id: string
          method: string
          notes?: string | null
          semen_details?: string | null
          stallion_id?: string | null
          stallion_name?: string | null
          updated_at?: string
        }
        Update: {
          bred_on?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mare_id?: string
          method?: string
          notes?: string | null
          semen_details?: string | null
          stallion_id?: string | null
          stallion_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeding_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_events_mare_id_business_id_fkey"
            columns: ["mare_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "breeding_events_mare_id_business_id_fkey"
            columns: ["mare_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "breeding_events_mare_id_business_id_fkey"
            columns: ["mare_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "breeding_events_stallion_id_business_id_fkey"
            columns: ["stallion_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "breeding_events_stallion_id_business_id_fkey"
            columns: ["stallion_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "breeding_events_stallion_id_business_id_fkey"
            columns: ["stallion_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      business_features: {
        Row: {
          business_id: string
          created_at: string
          enabled: boolean
          feature: string
          id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          enabled?: boolean
          feature: string
          id?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          enabled?: boolean
          feature?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_features_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          bank_details: string | null
          country_code: string
          created_at: string
          created_by: string | null
          credit_note_prefix: string
          currency_code: string
          default_tax_rate: number
          email: string | null
          id: string
          invoice_prefix: string
          locale: string
          logo_path: string | null
          name: string
          next_credit_note_number: number
          next_invoice_number: number
          payment_terms_days: number
          phone: string | null
          registration_number: string | null
          setup_completed_at: string | null
          tax_name: string
          tax_number: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          credit_note_prefix?: string
          currency_code?: string
          default_tax_rate?: number
          email?: string | null
          id?: string
          invoice_prefix?: string
          locale?: string
          logo_path?: string | null
          name: string
          next_credit_note_number?: number
          next_invoice_number?: number
          payment_terms_days?: number
          phone?: string | null
          registration_number?: string | null
          setup_completed_at?: string | null
          tax_name?: string
          tax_number?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          credit_note_prefix?: string
          currency_code?: string
          default_tax_rate?: number
          email?: string | null
          id?: string
          invoice_prefix?: string
          locale?: string
          logo_path?: string | null
          name?: string
          next_credit_note_number?: number
          next_invoice_number?: number
          payment_terms_days?: number
          phone?: string | null
          registration_number?: string | null
          setup_completed_at?: string | null
          tax_name?: string
          tax_number?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      care_events: {
        Row: {
          business_id: string
          care_schedule_id: string | null
          care_type: string
          created_at: string
          done_by: string | null
          done_on: string
          horse_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          care_schedule_id?: string | null
          care_type: string
          created_at?: string
          done_by?: string | null
          done_on?: string
          horse_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          care_schedule_id?: string | null
          care_type?: string
          created_at?: string
          done_by?: string | null
          done_on?: string
          horse_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_events_care_schedule_id_business_id_fkey"
            columns: ["care_schedule_id", "business_id"]
            isOneToOne: false
            referencedRelation: "care_schedules"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "care_events_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "care_events_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "care_events_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      care_schedules: {
        Row: {
          active: boolean
          business_id: string
          care_type: string
          created_at: string
          created_by: string | null
          description: string | null
          horse_id: string
          id: string
          interval_days: number
          next_due_on: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          care_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          horse_id: string
          id?: string
          interval_days: number
          next_due_on: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          care_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          horse_id?: string
          id?: string
          interval_days?: number
          next_due_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_schedules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_schedules_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "care_schedules_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "care_schedules_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      cost_categories: {
        Row: {
          active: boolean
          business_id: string
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_entries: {
        Row: {
          amount: number
          billable: boolean
          business_id: string
          care_event_id: string | null
          category_id: string
          cost_on: string
          created_at: string
          created_by: string | null
          description: string | null
          horse_id: string
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          source: string
          source_id: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billable?: boolean
          business_id: string
          care_event_id?: string | null
          category_id: string
          cost_on?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          horse_id: string
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          source?: string
          source_id?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billable?: boolean
          business_id?: string
          care_event_id?: string | null
          category_id?: string
          cost_on?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          horse_id?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          source?: string
          source_id?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_care_event_id_business_id_fkey"
            columns: ["care_event_id", "business_id"]
            isOneToOne: false
            referencedRelation: "care_events"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "cost_entries_category_id_business_id_fkey"
            columns: ["category_id", "business_id"]
            isOneToOne: false
            referencedRelation: "cost_categories"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "cost_entries_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "cost_entries_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "cost_entries_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "cost_entries_product_id_business_id_fkey"
            columns: ["product_id", "business_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          credit_number: string | null
          id: string
          invoice_id: string
          issued_on: string
          reason: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          credit_number?: string | null
          id?: string
          invoice_id: string
          issued_on?: string
          reason: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          credit_number?: string | null
          id?: string
          invoice_id?: string
          issued_on?: string
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_business_id_fkey"
            columns: ["invoice_id", "business_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id", "business_id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_business_id_fkey"
            columns: ["invoice_id", "business_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          assigned_to: string | null
          business_id: string
          created_at: string
          created_by: string | null
          done_at: string | null
          done_by: string | null
          horse_id: string | null
          id: string
          task_on: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          horse_id?: string | null
          id?: string
          task_on?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          horse_id?: string | null
          id?: string
          task_on?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "daily_tasks_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "daily_tasks_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      feed_logs: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          fed_on: string
          horse_id: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          fed_on?: string
          horse_id: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          fed_on?: string
          horse_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_logs_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "feed_logs_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "feed_logs_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "feed_logs_product_id_business_id_fkey"
            columns: ["product_id", "business_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      feed_rates: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          daily_rate: number
          effective_from: string
          id: string
          purpose: Database["public"]["Enums"]["horse_purpose"] | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          daily_rate: number
          effective_from?: string
          id?: string
          purpose?: Database["public"]["Enums"]["horse_purpose"] | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          effective_from?: string
          id?: string
          purpose?: Database["public"]["Enums"]["horse_purpose"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      foalings: {
        Row: {
          breeding_event_id: string | null
          business_id: string
          created_at: string
          created_by: string | null
          foal_id: string | null
          foaled_on: string
          id: string
          mare_id: string
          notes: string | null
          outcome: string
          updated_at: string
        }
        Insert: {
          breeding_event_id?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          foal_id?: string | null
          foaled_on: string
          id?: string
          mare_id: string
          notes?: string | null
          outcome?: string
          updated_at?: string
        }
        Update: {
          breeding_event_id?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          foal_id?: string | null
          foaled_on?: string
          id?: string
          mare_id?: string
          notes?: string | null
          outcome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foalings_breeding_event_id_business_id_fkey"
            columns: ["breeding_event_id", "business_id"]
            isOneToOne: false
            referencedRelation: "breeding_events"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "foalings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foalings_foal_id_business_id_fkey"
            columns: ["foal_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "foalings_foal_id_business_id_fkey"
            columns: ["foal_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "foalings_foal_id_business_id_fkey"
            columns: ["foal_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "foalings_mare_id_business_id_fkey"
            columns: ["mare_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "foalings_mare_id_business_id_fkey"
            columns: ["mare_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "foalings_mare_id_business_id_fkey"
            columns: ["mare_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      horse_ownership: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          ended_on: string | null
          horse_id: string
          id: string
          owner_id: string
          started_on: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          horse_id: string
          id?: string
          owner_id: string
          started_on?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          horse_id?: string
          id?: string
          owner_id?: string
          started_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_ownership_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_ownership_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_ownership_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_ownership_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "horse_ownership_owner_id_business_id_fkey"
            columns: ["owner_id", "business_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      horse_photos: {
        Row: {
          business_id: string
          caption: string | null
          created_at: string
          created_by: string | null
          horse_id: string
          id: string
          is_main: boolean
          storage_path: string
          taken_on: string
          updated_at: string
        }
        Insert: {
          business_id: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          horse_id: string
          id?: string
          is_main?: boolean
          storage_path: string
          taken_on?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          horse_id?: string
          id?: string
          is_main?: boolean
          storage_path?: string
          taken_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_photos_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_photos_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_photos_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      horse_purpose_history: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          ended_on: string | null
          horse_id: string
          id: string
          purpose: Database["public"]["Enums"]["horse_purpose"]
          started_on: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          horse_id: string
          id?: string
          purpose: Database["public"]["Enums"]["horse_purpose"]
          started_on?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          horse_id?: string
          id?: string
          purpose?: Database["public"]["Enums"]["horse_purpose"]
          started_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_purpose_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_purpose_history_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_purpose_history_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_purpose_history_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      horse_sales: {
        Row: {
          business_id: string
          buyer_name: string | null
          buyer_owner_id: string | null
          commission_percent: number | null
          created_at: string
          created_by: string | null
          horse_id: string
          id: string
          notes: string | null
          on_behalf_of_client: boolean
          sale_price: number
          sold_on: string
          updated_at: string
        }
        Insert: {
          business_id: string
          buyer_name?: string | null
          buyer_owner_id?: string | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          horse_id: string
          id?: string
          notes?: string | null
          on_behalf_of_client?: boolean
          sale_price: number
          sold_on?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          buyer_name?: string | null
          buyer_owner_id?: string | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          horse_id?: string
          id?: string
          notes?: string | null
          on_behalf_of_client?: boolean
          sale_price?: number
          sold_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_sales_buyer_owner_id_business_id_fkey"
            columns: ["buyer_owner_id", "business_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "horse_sales_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_sales_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_sales_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      horse_stays: {
        Row: {
          arrived_on: string
          business_id: string
          created_at: string
          created_by: string | null
          departed_on: string | null
          horse_id: string
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          arrived_on: string
          business_id: string
          created_at?: string
          created_by?: string | null
          departed_on?: string | null
          horse_id: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          arrived_on?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          departed_on?: string | null
          horse_id?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_stays_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_stays_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_stays_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_stays_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      horse_valuations: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          horse_id: string
          id: string
          note: string | null
          updated_at: string
          valued_on: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          horse_id: string
          id?: string
          note?: string | null
          updated_at?: string
          valued_on?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          horse_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          valued_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_valuations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_valuations_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_valuations_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horse_valuations_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      horses: {
        Row: {
          archived_at: string | null
          breed: string | null
          business_id: string
          colour: string | null
          created_at: string
          created_by: string | null
          current_owner_id: string | null
          current_purpose: Database["public"]["Enums"]["horse_purpose"]
          dam_id: string | null
          dam_name: string | null
          date_of_birth: string | null
          entry_date: string
          id: string
          microchip_number: string | null
          microchipped: boolean
          name: string
          notes: string | null
          passport_number: string | null
          previous_owner: string | null
          sex: Database["public"]["Enums"]["horse_sex"] | null
          sire_id: string | null
          sire_name: string | null
          stock_number: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          breed?: string | null
          business_id: string
          colour?: string | null
          created_at?: string
          created_by?: string | null
          current_owner_id?: string | null
          current_purpose?: Database["public"]["Enums"]["horse_purpose"]
          dam_id?: string | null
          dam_name?: string | null
          date_of_birth?: string | null
          entry_date?: string
          id?: string
          microchip_number?: string | null
          microchipped?: boolean
          name: string
          notes?: string | null
          passport_number?: string | null
          previous_owner?: string | null
          sex?: Database["public"]["Enums"]["horse_sex"] | null
          sire_id?: string | null
          sire_name?: string | null
          stock_number?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          breed?: string | null
          business_id?: string
          colour?: string | null
          created_at?: string
          created_by?: string | null
          current_owner_id?: string | null
          current_purpose?: Database["public"]["Enums"]["horse_purpose"]
          dam_id?: string | null
          dam_name?: string | null
          date_of_birth?: string | null
          entry_date?: string
          id?: string
          microchip_number?: string | null
          microchipped?: boolean
          name?: string
          notes?: string | null
          passport_number?: string | null
          previous_owner?: string | null
          sex?: Database["public"]["Enums"]["horse_sex"] | null
          sire_id?: string | null
          sire_name?: string | null
          stock_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horses_current_owner_id_business_id_fkey"
            columns: ["current_owner_id", "business_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "horses_dam_id_business_id_fkey"
            columns: ["dam_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horses_dam_id_business_id_fkey"
            columns: ["dam_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horses_dam_id_business_id_fkey"
            columns: ["dam_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "horses_sire_id_business_id_fkey"
            columns: ["sire_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horses_sire_id_business_id_fkey"
            columns: ["sire_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "horses_sire_id_business_id_fkey"
            columns: ["sire_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          business_id: string
          cost_entry_id: string | null
          created_at: string
          description: string
          horse_id: string | null
          id: string
          invoice_id: string
          line_kind: string
          quantity: number
          sort_order: number
          tax_applies: boolean
          tax_rate: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          business_id: string
          cost_entry_id?: string | null
          created_at?: string
          description: string
          horse_id?: string | null
          id?: string
          invoice_id: string
          line_kind?: string
          quantity?: number
          sort_order?: number
          tax_applies?: boolean
          tax_rate?: number | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          cost_entry_id?: string | null
          created_at?: string
          description?: string
          horse_id?: string | null
          id?: string
          invoice_id?: string
          line_kind?: string
          quantity?: number
          sort_order?: number
          tax_applies?: boolean
          tax_rate?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_cost_entry_id_business_id_fkey"
            columns: ["cost_entry_id", "business_id"]
            isOneToOne: false
            referencedRelation: "cost_entries"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "invoice_lines_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "invoice_lines_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "invoice_lines_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_business_id_fkey"
            columns: ["invoice_id", "business_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id", "business_id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_business_id_fkey"
            columns: ["invoice_id", "business_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      invoices: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          currency_code: string
          due_on: string | null
          id: string
          invoice_number: string | null
          issued_on: string | null
          notes: string | null
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          due_on?: string | null
          id?: string
          invoice_number?: string | null
          issued_on?: string | null
          notes?: string | null
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          due_on?: string | null
          id?: string
          invoice_number?: string | null
          issued_on?: string | null
          notes?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_owner_id_business_id_fkey"
            columns: ["owner_id", "business_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      message_log: {
        Row: {
          business_id: string
          channel: string
          created_at: string
          horse_id: string | null
          id: string
          invoice_id: string | null
          kind: string
          owner_id: string
          sent_at: string
          sent_by: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          channel: string
          created_at?: string
          horse_id?: string | null
          id?: string
          invoice_id?: string | null
          kind: string
          owner_id: string
          sent_at?: string
          sent_by?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          channel?: string
          created_at?: string
          horse_id?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          owner_id?: string
          sent_at?: string
          sent_by?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "message_log_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "message_log_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "message_log_invoice_id_business_id_fkey"
            columns: ["invoice_id", "business_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id", "business_id"]
          },
          {
            foreignKeyName: "message_log_invoice_id_business_id_fkey"
            columns: ["invoice_id", "business_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "message_log_owner_id_business_id_fkey"
            columns: ["owner_id", "business_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      owners: {
        Row: {
          address: string | null
          archived_at: string | null
          business_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_self: boolean
          name: string
          notes: string | null
          phone: string | null
          tax_number: string | null
          updated_at: string
          updates_channel: string | null
          updates_consent: boolean
          updates_consent_at: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_self?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
          updates_channel?: string | null
          updates_consent?: boolean
          updates_consent_at?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_self?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
          updates_channel?: string | null
          updates_consent?: boolean
          updates_consent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owners_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          is_deposit: boolean
          method: string
          notes: string | null
          paid_on: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          is_deposit?: boolean
          method?: string
          notes?: string | null
          paid_on?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          is_deposit?: boolean
          method?: string
          notes?: string | null
          paid_on?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_business_id_fkey"
            columns: ["invoice_id", "business_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id", "business_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_business_id_fkey"
            columns: ["invoice_id", "business_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      pregnancy_checks: {
        Row: {
          breeding_event_id: string
          business_id: string
          checked_on: string
          created_at: string
          created_by: string | null
          expected_foaling_on: string | null
          id: string
          notes: string | null
          result: string
          updated_at: string
        }
        Insert: {
          breeding_event_id: string
          business_id: string
          checked_on: string
          created_at?: string
          created_by?: string | null
          expected_foaling_on?: string | null
          id?: string
          notes?: string | null
          result: string
          updated_at?: string
        }
        Update: {
          breeding_event_id?: string
          business_id?: string
          checked_on?: string
          created_at?: string
          created_by?: string | null
          expected_foaling_on?: string | null
          id?: string
          notes?: string | null
          result?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregnancy_checks_breeding_event_id_business_id_fkey"
            columns: ["breeding_event_id", "business_id"]
            isOneToOne: false
            referencedRelation: "breeding_events"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "pregnancy_checks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          product_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          product_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          product_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_business_id_fkey"
            columns: ["product_id", "business_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          business_id: string
          category_id: string
          created_at: string
          created_by: string | null
          dose_label: string
          doses_per_unit: number
          id: string
          included_in_feed_rate: boolean
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          category_id: string
          created_at?: string
          created_by?: string | null
          dose_label?: string
          doses_per_unit?: number
          id?: string
          included_in_feed_rate?: boolean
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          dose_label?: string
          doses_per_unit?: number
          id?: string
          included_in_feed_rate?: boolean
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_business_id_fkey"
            columns: ["category_id", "business_id"]
            isOneToOne: false
            referencedRelation: "cost_categories"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      progress_notes: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          horse_id: string
          id: string
          milestone: string | null
          note: string
          updated_at: string
          week_starting: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          horse_id: string
          id?: string
          milestone?: string | null
          note: string
          updated_at?: string
          week_starting: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          horse_id?: string
          id?: string
          milestone?: string | null
          note?: string
          updated_at?: string
          week_starting?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_notes_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "progress_notes_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "progress_notes_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      recurring_charges: {
        Row: {
          active: boolean
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          description: string
          ends_on: string | null
          horse_id: string | null
          id: string
          last_billed_month: string | null
          line_kind: string
          owner_id: string
          starts_on: string
          tax_applies: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          description: string
          ends_on?: string | null
          horse_id?: string | null
          id?: string
          last_billed_month?: string | null
          line_kind?: string
          owner_id: string
          starts_on?: string
          tax_applies?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_on?: string | null
          horse_id?: string | null
          id?: string
          last_billed_month?: string | null
          line_kind?: string
          owner_id?: string
          starts_on?: string
          tax_applies?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_charges_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_charges_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "recurring_charges_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "recurring_charges_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "recurring_charges_owner_id_business_id_fkey"
            columns: ["owner_id", "business_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      shared_cost_allocations: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          days_present: number
          horse_id: string
          id: string
          month: string
          pool_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          days_present: number
          horse_id: string
          id?: string
          month: string
          pool_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          days_present?: number
          horse_id?: string
          id?: string
          month?: string
          pool_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_cost_allocations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_cost_allocations_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "shared_cost_allocations_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "shared_cost_allocations_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "shared_cost_allocations_pool_id_business_id_fkey"
            columns: ["pool_id", "business_id"]
            isOneToOne: false
            referencedRelation: "shared_cost_pools"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      shared_cost_pools: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          locked: boolean
          month: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          locked?: boolean
          month: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locked?: boolean
          month?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_cost_pools_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      show_entries: {
        Row: {
          business_id: string
          class_name: string | null
          created_at: string
          created_by: string | null
          finish_position: number | null
          horse_id: string
          id: string
          result: string | null
          rider: string | null
          show_name: string
          show_on: string
          updated_at: string
        }
        Insert: {
          business_id: string
          class_name?: string | null
          created_at?: string
          created_by?: string | null
          finish_position?: number | null
          horse_id: string
          id?: string
          result?: string | null
          rider?: string | null
          show_name: string
          show_on: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          class_name?: string | null
          created_at?: string
          created_by?: string | null
          finish_position?: number | null
          horse_id?: string
          id?: string
          result?: string | null
          rider?: string | null
          show_name?: string
          show_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_entries_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "show_entries_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "show_entries_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          business_id: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          business_id: string
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stall_assignments: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          ended_on: string | null
          expected_end_on: string | null
          horse_id: string
          id: string
          stall_id: string
          started_on: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          expected_end_on?: string | null
          horse_id: string
          id?: string
          stall_id: string
          started_on?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          expected_end_on?: string | null
          horse_id?: string
          id?: string
          stall_id?: string
          started_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stall_assignments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stall_assignments_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "stall_assignments_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "stall_assignments_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "stall_assignments_stall_id_business_id_fkey"
            columns: ["stall_id", "business_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      stalls: {
        Row: {
          active: boolean
          business_id: string
          capacity: number
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          capacity?: number
          created_at?: string
          id?: string
          kind?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          capacity?: number
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stalls_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      training_schedules: {
        Row: {
          business_id: string
          created_at: string
          duration_minutes: number | null
          horse_id: string
          id: string
          notes: string | null
          planned_on: string
          session_type: string
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          duration_minutes?: number | null
          horse_id: string
          id?: string
          notes?: string | null
          planned_on: string
          session_type: string
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          duration_minutes?: number | null
          horse_id?: string
          id?: string
          notes?: string | null
          planned_on?: string
          session_type?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_schedules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_schedules_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "training_schedules_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "training_schedules_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          business_id: string
          created_at: string
          duration_minutes: number | null
          horse_id: string
          id: string
          notes: string | null
          schedule_id: string | null
          session_on: string
          session_type: string
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          duration_minutes?: number | null
          horse_id: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
          session_on?: string
          session_type: string
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          duration_minutes?: number | null
          horse_id?: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
          session_on?: string
          session_type?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "training_sessions_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horse_profitability_month"
            referencedColumns: ["horse_id", "business_id"]
          },
          {
            foreignKeyName: "training_sessions_horse_id_business_id_fkey"
            columns: ["horse_id", "business_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "training_sessions_schedule_id_business_id_fkey"
            columns: ["schedule_id", "business_id"]
            isOneToOne: false
            referencedRelation: "training_schedules"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      waiting_list: {
        Row: {
          business_id: string
          contact_name: string
          created_at: string
          created_by: string | null
          horse_count: number
          horse_description: string | null
          id: string
          notes: string | null
          owner_id: string | null
          priority: number
          requested_on: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          contact_name: string
          created_at?: string
          created_by?: string | null
          horse_count?: number
          horse_description?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          priority?: number
          requested_on?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          contact_name?: string
          created_at?: string
          created_by?: string | null
          horse_count?: number
          horse_description?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          priority?: number
          requested_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_owner_id_business_id_fkey"
            columns: ["owner_id", "business_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
    }
    Views: {
      horse_profitability: {
        Row: {
          business_id: string | null
          direct_costs: number | null
          feed_costs: number | null
          feed_days: number | null
          horse_id: string | null
          invoiced_income: number | null
          is_own_stock: boolean | null
          latest_valuation: number | null
          latest_valuation_on: string | null
          profit: number | null
          projected_profit: number | null
          sale_income: number | null
          shared_costs: number | null
          total_cost: number | null
          total_income: number | null
        }
        Relationships: [
          {
            foreignKeyName: "horses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_profitability_month: {
        Row: {
          business_id: string | null
          horse_id: string | null
          profit: number | null
          total_cost: number | null
          total_income: number | null
        }
        Relationships: [
          {
            foreignKeyName: "horses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_totals: {
        Row: {
          balance: number | null
          business_id: string | null
          credited: number | null
          invoice_id: string | null
          paid: number | null
          subtotal: number | null
          tax: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_staff_invite: { Args: { invite_code: string }; Returns: string }
      archive_horse: { Args: { horse: string }; Returns: undefined }
      assign_horse_to_stall: {
        Args: { expected_end?: string; horse: string; stall: string }
        Returns: undefined
      }
      create_business: {
        Args: {
          business_name: string
          country_code?: string
          currency_code?: string
          default_tax_rate?: number
          tax_name?: string
        }
        Returns: string
      }
      create_staff_invite: {
        Args: { bid: string; role: Database["public"]["Enums"]["member_role"] }
        Returns: {
          business_id: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_recurring_invoices: {
        Args: { bid: string; for_month: string }
        Returns: number
      }
      remove_horse_from_stall: { Args: { horse: string }; Returns: undefined }
      run_month_allocation: {
        Args: { bid: string; for_month: string }
        Returns: Json
      }
      sell_horse: {
        Args: {
          buyer_name?: string
          buyer_owner_id?: string
          commission_percent?: number
          horse: string
          notes?: string
          on_behalf_of_client?: boolean
          sale_price: number
          sold_on: string
        }
        Returns: string
      }
      set_daily_feed_rate: {
        Args: { bid: string; from_date: string; rate: number }
        Returns: undefined
      }
      set_horse_purchase_price: {
        Args: { horse: string; price: number }
        Returns: undefined
      }
      set_main_horse_photo: { Args: { photo: string }; Returns: undefined }
    }
    Enums: {
      horse_purpose: "broodstock" | "trading" | "training"
      horse_sex: "mare" | "stallion" | "gelding" | "colt" | "filly" | "rig"
      member_role: "manager" | "trainer" | "groom" | "casual"
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
      horse_purpose: ["broodstock", "trading", "training"],
      horse_sex: ["mare", "stallion", "gelding", "colt", "filly", "rig"],
      member_role: ["manager", "trainer", "groom", "casual"],
    },
  },
} as const
