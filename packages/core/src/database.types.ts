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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          entity_id: string
          entity_type: string
          id: number
          new_value: Json | null
          old_value: Json | null
          org_id: string
          ts: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          entity_id: string
          entity_type: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          org_id: string
          ts?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          org_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          id: string
          mode: Database["public"]["Enums"]["pay_mode"]
          org_id: string
          paid_at: string
          paid_by: string | null
          ref_no: string | null
          trip_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          id?: string
          mode?: Database["public"]["Enums"]["pay_mode"]
          org_id: string
          paid_at?: string
          paid_by?: string | null
          ref_no?: string | null
          trip_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["pay_mode"]
          org_id?: string
          paid_at?: string
          paid_by?: string | null
          ref_no?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string | null
          freight_amount: number
          gst_amount: number
          id: string
          invoice_no: string | null
          org_id: string
          other_charges: number
          received_amount: number
          status: Database["public"]["Enums"]["billing_track_status"]
          total: number
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date?: string | null
          freight_amount?: number
          gst_amount?: number
          id?: string
          invoice_no?: string | null
          org_id: string
          other_charges?: number
          received_amount?: number
          status?: Database["public"]["Enums"]["billing_track_status"]
          total?: number
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string | null
          freight_amount?: number
          gst_amount?: number
          id?: string
          invoice_no?: string | null
          org_id?: string
          other_charges?: number
          received_amount?: number
          status?: Database["public"]["Enums"]["billing_track_status"]
          total?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: string | null
          contact_person: string | null
          created_at: string
          credit_days: number
          gstin: string | null
          id: string
          kind: Database["public"]["Enums"]["customer_kind"]
          marketpe_id: string | null
          name: string
          org_id: string
          phone: string | null
        }
        Insert: {
          billing_address?: string | null
          contact_person?: string | null
          created_at?: string
          credit_days?: number
          gstin?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["customer_kind"]
          marketpe_id?: string | null
          name: string
          org_id: string
          phone?: string | null
        }
        Update: {
          billing_address?: string | null
          contact_person?: string | null
          created_at?: string
          credit_days?: number
          gstin?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["customer_kind"]
          marketpe_id?: string | null
          name?: string
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_settlements: {
        Row: {
          advances_deducted: number
          bonus: number
          created_at: string
          driver_id: string
          gross_amount: number
          id: string
          marketpe_payment_id: string | null
          mode: Database["public"]["Enums"]["pay_mode"] | null
          net_payable: number
          org_id: string
          paid_at: string | null
          paid_by: string | null
          penalty: number
          penalty_reason: string | null
          ref_no: string | null
          status: Database["public"]["Enums"]["settlement_row_status"]
          trip_id: string
        }
        Insert: {
          advances_deducted?: number
          bonus?: number
          created_at?: string
          driver_id: string
          gross_amount?: number
          id?: string
          marketpe_payment_id?: string | null
          mode?: Database["public"]["Enums"]["pay_mode"] | null
          net_payable?: number
          org_id: string
          paid_at?: string | null
          paid_by?: string | null
          penalty?: number
          penalty_reason?: string | null
          ref_no?: string | null
          status?: Database["public"]["Enums"]["settlement_row_status"]
          trip_id: string
        }
        Update: {
          advances_deducted?: number
          bonus?: number
          created_at?: string
          driver_id?: string
          gross_amount?: number
          id?: string
          marketpe_payment_id?: string | null
          mode?: Database["public"]["Enums"]["pay_mode"] | null
          net_payable?: number
          org_id?: string
          paid_at?: string | null
          paid_by?: string | null
          penalty?: number
          penalty_reason?: string | null
          ref_no?: string | null
          status?: Database["public"]["Enums"]["settlement_row_status"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_settlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_settlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_settlements_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          alt_phone: string | null
          bank_acc: string | null
          created_at: string
          id: string
          ifsc: string | null
          license_expiry: string | null
          license_no: string | null
          marketpe_id: string | null
          marketpe_raw: Json | null
          name: string
          org_id: string
          phone: string
          photo_url: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          alt_phone?: string | null
          bank_acc?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          license_expiry?: string | null
          license_no?: string | null
          marketpe_id?: string | null
          marketpe_raw?: Json | null
          name: string
          org_id: string
          phone: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          alt_phone?: string | null
          bank_acc?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          license_expiry?: string | null
          license_no?: string | null
          marketpe_id?: string | null
          marketpe_raw?: Json | null
          name?: string
          org_id?: string
          phone?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      eway_bills: {
        Row: {
          consignee_id: string | null
          consignee_name: string | null
          consignor_id: string | null
          consignor_name: string | null
          created_at: string
          destination: string | null
          ewb_no: string
          fetched_at: string
          generated_at: string | null
          id: string
          invoice_no: string | null
          invoice_value: number | null
          material: string | null
          org_id: string
          origin: string | null
          raw_json: Json | null
          status: Database["public"]["Enums"]["ewb_status"]
          valid_until: string | null
          weight_kg: number | null
        }
        Insert: {
          consignee_id?: string | null
          consignee_name?: string | null
          consignor_id?: string | null
          consignor_name?: string | null
          created_at?: string
          destination?: string | null
          ewb_no: string
          fetched_at?: string
          generated_at?: string | null
          id?: string
          invoice_no?: string | null
          invoice_value?: number | null
          material?: string | null
          org_id: string
          origin?: string | null
          raw_json?: Json | null
          status?: Database["public"]["Enums"]["ewb_status"]
          valid_until?: string | null
          weight_kg?: number | null
        }
        Update: {
          consignee_id?: string | null
          consignee_name?: string | null
          consignor_id?: string | null
          consignor_name?: string | null
          created_at?: string
          destination?: string | null
          ewb_no?: string
          fetched_at?: string
          generated_at?: string | null
          id?: string
          invoice_no?: string | null
          invoice_value?: number | null
          material?: string | null
          org_id?: string
          origin?: string | null
          raw_json?: Json | null
          status?: Database["public"]["Enums"]["ewb_status"]
          valid_until?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eway_bills_consignee_id_fkey"
            columns: ["consignee_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eway_bills_consignor_id_fkey"
            columns: ["consignor_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eway_bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_contracts: {
        Row: {
          category: string
          contract_no: string
          created_at: string
          customer_name: string | null
          dest_city: string
          dest_code: string | null
          id: string
          org_id: string
          origin_code: string | null
          origin_name: string
          rate_per_mt: number
          source_file: string | null
          transit_days: number | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          category: string
          contract_no: string
          created_at?: string
          customer_name?: string | null
          dest_city: string
          dest_code?: string | null
          id?: string
          org_id: string
          origin_code?: string | null
          origin_name: string
          rate_per_mt: number
          source_file?: string | null
          transit_days?: number | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          category?: string
          contract_no?: string
          created_at?: string
          customer_name?: string | null
          dest_city?: string
          dest_code?: string | null
          id?: string
          org_id?: string
          origin_code?: string | null
          origin_name?: string
          rate_per_mt?: number
          source_file?: string | null
          transit_days?: number | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_events: {
        Row: {
          auto_status_applied: Database["public"]["Enums"]["trip_status"] | null
          event: Database["public"]["Enums"]["geofence_event_kind"]
          geofence_id: string
          id: string
          lat: number | null
          lng: number | null
          org_id: string
          trip_id: string
          ts: string
        }
        Insert: {
          auto_status_applied?:
            | Database["public"]["Enums"]["trip_status"]
            | null
          event: Database["public"]["Enums"]["geofence_event_kind"]
          geofence_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          org_id: string
          trip_id: string
          ts?: string
        }
        Update: {
          auto_status_applied?:
            | Database["public"]["Enums"]["trip_status"]
            | null
          event?: Database["public"]["Enums"]["geofence_event_kind"]
          geofence_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          org_id?: string
          trip_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      geofences: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["geofence_kind"]
          name: string
          org_id: string
          radius_m: number
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["geofence_kind"]
          name: string
          org_id: string
          radius_m?: number
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["geofence_kind"]
          name?: string
          org_id?: string
          radius_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "geofences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_logs: {
        Row: {
          acc: number | null
          alt_m: number | null
          device_id: string | null
          heading: number | null
          id: number
          lat: number
          lng: number
          org_id: string
          raw: Json | null
          received_at: string
          refid: string | null
          satellites: number | null
          speed_kmh: number | null
          trip_id: string | null
          ts: string
          vehicle_id: string
        }
        Insert: {
          acc?: number | null
          alt_m?: number | null
          device_id?: string | null
          heading?: number | null
          id?: never
          lat: number
          lng: number
          org_id: string
          raw?: Json | null
          received_at?: string
          refid?: string | null
          satellites?: number | null
          speed_kmh?: number | null
          trip_id?: string | null
          ts: string
          vehicle_id: string
        }
        Update: {
          acc?: number | null
          alt_m?: number | null
          device_id?: string | null
          heading?: number | null
          id?: never
          lat?: number
          lng?: number
          org_id?: string
          raw?: Json | null
          received_at?: string
          refid?: string | null
          satellites?: number | null
          speed_kmh?: number | null
          trip_id?: string | null
          ts?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_trip_rates: {
        Row: {
          created_at: string
          created_by: string | null
          diesel: number
          driver_allowance: number
          effective_from: string
          effective_to: string | null
          fastag: number
          freight: number
          fuel_liters: number | null
          fuel_type: string | null
          id: string
          loading_charges: number
          misc: number
          org_id: string
          route_id: string
          toll: number
          unloading_charges: number
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          diesel?: number
          driver_allowance?: number
          effective_from?: string
          effective_to?: string | null
          fastag?: number
          freight?: number
          fuel_liters?: number | null
          fuel_type?: string | null
          id?: string
          loading_charges?: number
          misc?: number
          org_id: string
          route_id: string
          toll?: number
          unloading_charges?: number
          vehicle_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          diesel?: number
          driver_allowance?: number
          effective_from?: string
          effective_to?: string | null
          fastag?: number
          freight?: number
          fuel_liters?: number | null
          fuel_type?: string | null
          id?: string
          loading_charges?: number
          misc?: number
          org_id?: string
          route_id?: string
          toll?: number
          unloading_charges?: number
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_trip_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_trip_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_trip_rates_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          created_at: string
          hsn_code: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hsn_code?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hsn_code?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          delivered_at: string | null
          error: string | null
          id: string
          org_id: string
          payload: Json
          recipient_id: string | null
          recipient_type: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notif_status"]
          template: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          org_id: string
          payload?: Json
          recipient_id?: string | null
          recipient_type: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          template: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          org_id?: string
          payload?: Json
          recipient_id?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_integrations: {
        Row: {
          gps_webhook_token: string | null
          marketpe_api_key: string | null
          marketpe_base_url: string | null
          marketpe_gstin: string | null
          org_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          gps_webhook_token?: string | null
          marketpe_api_key?: string | null
          marketpe_base_url?: string | null
          marketpe_gstin?: string | null
          org_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          gps_webhook_token?: string | null
          marketpe_api_key?: string | null
          marketpe_base_url?: string | null
          marketpe_gstin?: string | null
          org_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      pods: {
        Row: {
          capture_lat: number | null
          capture_lng: number | null
          ewb_id: string | null
          file_url: string
          id: string
          org_id: string
          rejection_reason: string | null
          source: Database["public"]["Enums"]["pod_source"]
          status: Database["public"]["Enums"]["pod_track_status"]
          trip_id: string
          uploaded_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          capture_lat?: number | null
          capture_lng?: number | null
          ewb_id?: string | null
          file_url: string
          id?: string
          org_id: string
          rejection_reason?: string | null
          source?: Database["public"]["Enums"]["pod_source"]
          status?: Database["public"]["Enums"]["pod_track_status"]
          trip_id: string
          uploaded_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          capture_lat?: number | null
          capture_lng?: number | null
          ewb_id?: string | null
          file_url?: string
          id?: string
          org_id?: string
          rejection_reason?: string | null
          source?: Database["public"]["Enums"]["pod_source"]
          status?: Database["public"]["Enums"]["pod_track_status"]
          trip_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pods_ewb_id_fkey"
            columns: ["ewb_id"]
            isOneToOne: false
            referencedRelation: "eway_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pods_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pods_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pods_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          driver_id: string | null
          email: string | null
          id: string
          name: string
          org_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_id?: string | null
          email?: string | null
          id: string
          name: string
          org_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_id?: string | null
          email?: string | null
          id?: string
          name?: string
          org_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_driver_fk"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          dest_city: string
          distance_km: number | null
          expected_hours: number | null
          id: string
          org_id: string
          origin_city: string
        }
        Insert: {
          created_at?: string
          dest_city: string
          distance_km?: number | null
          expected_hours?: number | null
          id?: string
          org_id: string
          origin_city: string
        }
        Update: {
          created_at?: string
          dest_city?: string
          distance_km?: number | null
          expected_hours?: number | null
          id?: string
          org_id?: string
          origin_city?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          active: boolean
          address_text: string | null
          center_lat: number
          center_lng: number
          confidence: number
          confirmed: boolean
          created_at: string
          customer_gstin: string | null
          geofence_id: string
          id: string
          kind: Database["public"]["Enums"]["site_kind"]
          name: string
          org_id: string
          pincode: string | null
          radius_m: number
          sample_count: number
          source: Database["public"]["Enums"]["site_source"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          address_text?: string | null
          center_lat: number
          center_lng: number
          confidence?: number
          confirmed?: boolean
          created_at?: string
          customer_gstin?: string | null
          geofence_id: string
          id?: string
          kind: Database["public"]["Enums"]["site_kind"]
          name: string
          org_id: string
          pincode?: string | null
          radius_m?: number
          sample_count?: number
          source?: Database["public"]["Enums"]["site_source"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          address_text?: string | null
          center_lat?: number
          center_lng?: number
          confidence?: number
          confirmed?: boolean
          created_at?: string
          customer_gstin?: string | null
          geofence_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["site_kind"]
          name?: string
          org_id?: string
          pincode?: string | null
          radius_m?: number
          sample_count?: number
          source?: Database["public"]["Enums"]["site_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_charges: {
        Row: {
          approved_amount: number
          approved_at: string | null
          approved_by: string | null
          charge_type: string
          created_at: string
          id: string
          org_id: string
          planned_amount: number
          source: Database["public"]["Enums"]["charge_source"]
          trip_id: string
        }
        Insert: {
          approved_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          charge_type: string
          created_at?: string
          id?: string
          org_id: string
          planned_amount?: number
          source?: Database["public"]["Enums"]["charge_source"]
          trip_id: string
        }
        Update: {
          approved_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          charge_type?: string
          created_at?: string
          id?: string
          org_id?: string
          planned_amount?: number
          source?: Database["public"]["Enums"]["charge_source"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_charges_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_charges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_charges_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_drivers: {
        Row: {
          assigned_at: string
          driver_id: string
          handover_lat: number | null
          handover_lng: number | null
          id: string
          leg_end_location: string | null
          leg_start_location: string | null
          org_id: string
          released_at: string | null
          role: Database["public"]["Enums"]["trip_driver_role"]
          trip_id: string
        }
        Insert: {
          assigned_at?: string
          driver_id: string
          handover_lat?: number | null
          handover_lng?: number | null
          id?: string
          leg_end_location?: string | null
          leg_start_location?: string | null
          org_id: string
          released_at?: string | null
          role?: Database["public"]["Enums"]["trip_driver_role"]
          trip_id: string
        }
        Update: {
          assigned_at?: string
          driver_id?: string
          handover_lat?: number | null
          handover_lng?: number | null
          id?: string
          leg_end_location?: string | null
          leg_start_location?: string | null
          org_id?: string
          released_at?: string | null
          role?: Database["public"]["Enums"]["trip_driver_role"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_drivers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_drivers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_eway_bills: {
        Row: {
          attached_at: string
          ewb_id: string
          is_active: boolean
          org_id: string
          trip_id: string
        }
        Insert: {
          attached_at?: string
          ewb_id: string
          is_active?: boolean
          org_id: string
          trip_id: string
        }
        Update: {
          attached_at?: string
          ewb_id?: string
          is_active?: boolean
          org_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_eway_bills_ewb_id_fkey"
            columns: ["ewb_id"]
            isOneToOne: false
            referencedRelation: "eway_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_eway_bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_eway_bills_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expenses: {
        Row: {
          added_by: string | null
          amount: number
          approved: boolean
          approved_by: string | null
          created_at: string
          expense_type: string
          id: string
          incurred_at: string
          org_id: string
          receipt_url: string | null
          remarks: string | null
          trip_id: string
        }
        Insert: {
          added_by?: string | null
          amount: number
          approved?: boolean
          approved_by?: string | null
          created_at?: string
          expense_type: string
          id?: string
          incurred_at?: string
          org_id: string
          receipt_url?: string | null
          remarks?: string | null
          trip_id: string
        }
        Update: {
          added_by?: string | null
          amount?: number
          approved?: boolean
          approved_by?: string | null
          created_at?: string
          expense_type?: string
          id?: string
          incurred_at?: string
          org_id?: string
          receipt_url?: string | null
          remarks?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          actual_start: string | null
          arrived_at: string | null
          billing_status: Database["public"]["Enums"]["billing_track_status"]
          cancelled_reason: string | null
          completed_at: string | null
          consolidated_ewb_no: string | null
          created_at: string
          created_by: string | null
          dest_geofence_id: string | null
          eta: string | null
          id: string
          last_gps_at: string | null
          last_lat: number | null
          last_lng: number | null
          marketpe_id: string | null
          notes: string | null
          ops_closed_at: string | null
          org_id: string
          planned_start: string | null
          pod_status: Database["public"]["Enums"]["pod_track_status"]
          pod_token: string
          route_id: string | null
          settlement_status: Database["public"]["Enums"]["settlement_track_status"]
          status: Database["public"]["Enums"]["trip_status"]
          total_weight_kg: number | null
          trip_no: string
          unloaded_at: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          actual_start?: string | null
          arrived_at?: string | null
          billing_status?: Database["public"]["Enums"]["billing_track_status"]
          cancelled_reason?: string | null
          completed_at?: string | null
          consolidated_ewb_no?: string | null
          created_at?: string
          created_by?: string | null
          dest_geofence_id?: string | null
          eta?: string | null
          id?: string
          last_gps_at?: string | null
          last_lat?: number | null
          last_lng?: number | null
          marketpe_id?: string | null
          notes?: string | null
          ops_closed_at?: string | null
          org_id: string
          planned_start?: string | null
          pod_status?: Database["public"]["Enums"]["pod_track_status"]
          pod_token?: string
          route_id?: string | null
          settlement_status?: Database["public"]["Enums"]["settlement_track_status"]
          status?: Database["public"]["Enums"]["trip_status"]
          total_weight_kg?: number | null
          trip_no?: string
          unloaded_at?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          actual_start?: string | null
          arrived_at?: string | null
          billing_status?: Database["public"]["Enums"]["billing_track_status"]
          cancelled_reason?: string | null
          completed_at?: string | null
          consolidated_ewb_no?: string | null
          created_at?: string
          created_by?: string | null
          dest_geofence_id?: string | null
          eta?: string | null
          id?: string
          last_gps_at?: string | null
          last_lat?: number | null
          last_lng?: number | null
          marketpe_id?: string | null
          notes?: string | null
          ops_closed_at?: string | null
          org_id?: string
          planned_start?: string | null
          pod_status?: Database["public"]["Enums"]["pod_track_status"]
          pod_token?: string
          route_id?: string | null
          settlement_status?: Database["public"]["Enums"]["settlement_track_status"]
          status?: Database["public"]["Enums"]["trip_status"]
          total_weight_kg?: number | null
          trip_no?: string
          unloaded_at?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_dest_geofence_id_fkey"
            columns: ["dest_geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity_kg: number | null
          created_at: string
          fitness_expiry: string | null
          fuel_type: string | null
          gps_device_id: string | null
          id: string
          insurance_expiry: string | null
          manufacturer: string | null
          marketpe_id: string | null
          marketpe_raw: Json | null
          org_id: string
          ownership: Database["public"]["Enums"]["vehicle_ownership"]
          permit_expiry: string | null
          pod_token: string
          puc_expiry: string | null
          purchase_date: string | null
          reg_no: string
          registration_date: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          trailer_type: string | null
          tyre_count: number | null
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          capacity_kg?: number | null
          created_at?: string
          fitness_expiry?: string | null
          fuel_type?: string | null
          gps_device_id?: string | null
          id?: string
          insurance_expiry?: string | null
          manufacturer?: string | null
          marketpe_id?: string | null
          marketpe_raw?: Json | null
          org_id: string
          ownership?: Database["public"]["Enums"]["vehicle_ownership"]
          permit_expiry?: string | null
          pod_token?: string
          puc_expiry?: string | null
          purchase_date?: string | null
          reg_no: string
          registration_date?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          trailer_type?: string | null
          tyre_count?: number | null
          updated_at?: string
          vehicle_type: string
        }
        Update: {
          capacity_kg?: number | null
          created_at?: string
          fitness_expiry?: string | null
          fuel_type?: string | null
          gps_device_id?: string | null
          id?: string
          insurance_expiry?: string | null
          manufacturer?: string | null
          marketpe_id?: string | null
          marketpe_raw?: Json | null
          org_id?: string
          ownership?: Database["public"]["Enums"]["vehicle_ownership"]
          permit_expiry?: string | null
          pod_token?: string
          puc_expiry?: string | null
          purchase_date?: string | null
          reg_no?: string
          registration_date?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          trailer_type?: string | null
          tyre_count?: number | null
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      org_cost_summary: {
        Row: {
          approved_costs: number | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_charges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invoice_summary: {
        Row: {
          invoiced_total: number | null
          invoices: number | null
          org_id: string | null
          outstanding: number | null
          received_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_latest_positions: {
        Row: {
          lat: number | null
          lng: number | null
          org_id: string | null
          reg_no: string | null
          speed_kmh: number | null
          ts: string | null
          vehicle_id: string | null
          vehicle_status: Database["public"]["Enums"]["vehicle_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_driver_id: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      earth: { Args: never; Returns: number }
      is_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      billing_track_status:
        | "unbilled"
        | "invoiced"
        | "partially_received"
        | "received"
      charge_source: "master" | "manual"
      customer_kind: "consignor" | "consignee" | "both"
      driver_status: "available" | "on_trip" | "off_duty" | "blacklisted"
      ewb_status: "active" | "extended" | "expired" | "cancelled"
      geofence_event_kind: "enter" | "exit"
      geofence_kind: "pickup" | "destination" | "checkpoint" | "home_base"
      notif_channel: "whatsapp" | "sms" | "push"
      notif_status: "queued" | "sent" | "delivered" | "failed"
      pay_mode: "cash" | "upi" | "bank" | "fuel_card" | "fastag" | "cheque"
      pod_source: "app" | "whatsapp" | "manual_upload" | "qr"
      pod_track_status: "awaited" | "uploaded" | "verified" | "rejected"
      settlement_row_status: "pending" | "processing" | "paid"
      settlement_track_status:
        | "pending"
        | "processing"
        | "partially_paid"
        | "paid"
      site_kind: "home_base" | "customer"
      site_source: "manual" | "cluster" | "learned" | "geocoded"
      trip_driver_role: "primary" | "secondary" | "helper"
      trip_status:
        | "draft"
        | "planned"
        | "ready"
        | "in_transit"
        | "at_destination"
        | "unloaded"
        | "ops_closed"
        | "completed"
        | "cancelled"
        | "aborted"
      user_role:
        | "admin"
        | "supervisor"
        | "accountant"
        | "driver"
        | "super_admin"
      vehicle_ownership: "OWNED" | "MARKET" | "ATTACHED"
      vehicle_status: "available" | "on_trip" | "maintenance" | "inactive"
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
      billing_track_status: [
        "unbilled",
        "invoiced",
        "partially_received",
        "received",
      ],
      charge_source: ["master", "manual"],
      customer_kind: ["consignor", "consignee", "both"],
      driver_status: ["available", "on_trip", "off_duty", "blacklisted"],
      ewb_status: ["active", "extended", "expired", "cancelled"],
      geofence_event_kind: ["enter", "exit"],
      geofence_kind: ["pickup", "destination", "checkpoint", "home_base"],
      notif_channel: ["whatsapp", "sms", "push"],
      notif_status: ["queued", "sent", "delivered", "failed"],
      pay_mode: ["cash", "upi", "bank", "fuel_card", "fastag", "cheque"],
      pod_source: ["app", "whatsapp", "manual_upload", "qr"],
      pod_track_status: ["awaited", "uploaded", "verified", "rejected"],
      settlement_row_status: ["pending", "processing", "paid"],
      settlement_track_status: [
        "pending",
        "processing",
        "partially_paid",
        "paid",
      ],
      site_kind: ["home_base", "customer"],
      site_source: ["manual", "cluster", "learned", "geocoded"],
      trip_driver_role: ["primary", "secondary", "helper"],
      trip_status: [
        "draft",
        "planned",
        "ready",
        "in_transit",
        "at_destination",
        "unloaded",
        "ops_closed",
        "completed",
        "cancelled",
        "aborted",
      ],
      user_role: ["admin", "supervisor", "accountant", "driver", "super_admin"],
      vehicle_ownership: ["OWNED", "MARKET", "ATTACHED"],
      vehicle_status: ["available", "on_trip", "maintenance", "inactive"],
    },
  },
} as const
