// Сгенерировано из схемы базы. Обновление: npm run db:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: number
          table_name: string
          record_id: string
          action: string
          old_data: Json | null
          new_data: Json | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: never
          table_name: string
          record_id: string
          action: string
          old_data?: Json | null
          new_data?: Json | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          table_name?: string
          record_id?: string
          action?: string
          old_data?: Json | null
          new_data?: Json | null
          changed_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_accounts: {
        Row: {
          id: string
          name: string
          type: string
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          type: string
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          type?: string
          is_active?: boolean
        }
        Relationships: [
        ]
      }
      cash_operations: {
        Row: {
          id: string
          cash_account_id: string
          direction: string
          amount: number
          category: string
          comment: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cash_account_id: string
          direction: string
          amount: number
          category: string
          comment?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cash_account_id?: string
          direction?: string
          amount?: number
          category?: string
          comment?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_operations_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_operations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          parent_id: string | null
          name: string
          sort_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          parent_id?: string | null
          name: string
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          parent_id?: string | null
          name?: string
          sort_order?: number
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          id: string
          client_id: string
          name: string
          position: string | null
          phone: string | null
          email: string | null
          telegram: string | null
          is_primary: boolean
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          position?: string | null
          phone?: string | null
          email?: string | null
          telegram?: string | null
          is_primary?: boolean
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          position?: string | null
          phone?: string | null
          email?: string | null
          telegram?: string | null
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_prices: {
        Row: {
          id: string
          client_id: string
          product_id: string
          price: number
        }
        Insert: {
          id?: string
          client_id: string
          product_id: string
          price: number
        }
        Update: {
          id?: string
          client_id?: string
          product_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_prices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          id: string
          type: Database["public"]["Enums"]["client_type"]
          name: string
          legal_name: string | null
          inn: string | null
          kpp: string | null
          phone: string | null
          email: string | null
          address: string | null
          discount_percent: number
          credit_limit: number | null
          payment_terms_days: number
          manager_id: string | null
          notes: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type: Database["public"]["Enums"]["client_type"]
          name: string
          legal_name?: string | null
          inn?: string | null
          kpp?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          discount_percent?: number
          credit_limit?: number | null
          payment_terms_days?: number
          manager_id?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          type?: Database["public"]["Enums"]["client_type"]
          name?: string
          legal_name?: string | null
          inn?: string | null
          kpp?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          discount_percent?: number
          credit_limit?: number | null
          payment_terms_days?: number
          manager_id?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_counters: {
        Row: {
          prefix: string
          year: number
          last_value: number
        }
        Insert: {
          prefix: string
          year: number
          last_value: number
        }
        Update: {
          prefix?: string
          year?: number
          last_value?: number
        }
        Relationships: [
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          type: string
          title: string
          body: string | null
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          type: string
          title: string
          body?: string | null
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          type?: string
          title?: string
          body?: string | null
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          qty: number
          unit_price: number
          price_source: string
          discount_percent: number
          line_total: number
          cost_price: number | null
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          qty: number
          unit_price: number
          price_source: string
          discount_percent?: number
          line_total: number
          cost_price?: number | null
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          qty?: number
          unit_price?: number
          price_source?: string
          discount_percent?: number
          line_total?: number
          cost_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          id: string
          order_id: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          to_status: Database["public"]["Enums"]["order_status"]
          changed_by: string | null
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          to_status: Database["public"]["Enums"]["order_status"]
          changed_by?: string | null
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          to_status?: Database["public"]["Enums"]["order_status"]
          changed_by?: string | null
          comment?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          id: string
          number: string
          client_id: string | null
          price_type: Database["public"]["Enums"]["client_type"]
          status: Database["public"]["Enums"]["order_status"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          subtotal: number
          discount_total: number
          total: number
          paid_amount: number
          delivery_address: string | null
          due_date: string | null
          manager_id: string | null
          comment: string | null
          cancel_reason: string | null
          created_at: string
          confirmed_at: string | null
          shipped_at: string | null
        }
        Insert: {
          id?: string
          number: string
          client_id?: string | null
          price_type: Database["public"]["Enums"]["client_type"]
          status?: Database["public"]["Enums"]["order_status"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          subtotal?: number
          discount_total?: number
          total?: number
          paid_amount?: number
          delivery_address?: string | null
          due_date?: string | null
          manager_id?: string | null
          comment?: string | null
          cancel_reason?: string | null
          created_at?: string
          confirmed_at?: string | null
          shipped_at?: string | null
        }
        Update: {
          id?: string
          number?: string
          client_id?: string | null
          price_type?: Database["public"]["Enums"]["client_type"]
          status?: Database["public"]["Enums"]["order_status"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          subtotal?: number
          discount_total?: number
          total?: number
          paid_amount?: number
          delivery_address?: string | null
          due_date?: string | null
          manager_id?: string | null
          comment?: string | null
          cancel_reason?: string | null
          created_at?: string
          confirmed_at?: string | null
          shipped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          id: string
          payment_id: string
          order_id: string
          amount: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          order_id: string
          amount: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          order_id?: string
          amount?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          id: string
          direction: string
          amount: number
          method: Database["public"]["Enums"]["payment_method"]
          cash_account_id: string
          client_id: string | null
          order_id: string | null
          supplier_id: string | null
          purchase_id: string | null
          paid_at: string
          comment: string | null
          is_void: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          direction: string
          amount: number
          method: Database["public"]["Enums"]["payment_method"]
          cash_account_id: string
          client_id?: string | null
          order_id?: string | null
          supplier_id?: string | null
          purchase_id?: string | null
          paid_at?: string
          comment?: string | null
          is_void?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          direction?: string
          amount?: number
          method?: Database["public"]["Enums"]["payment_method"]
          cash_account_id?: string
          client_id?: string | null
          order_id?: string | null
          supplier_id?: string | null
          purchase_id?: string | null
          paid_at?: string
          comment?: string | null
          is_void?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          storage_path: string
          sort_order: number
        }
        Insert: {
          id?: string
          product_id: string
          storage_path: string
          sort_order?: number
        }
        Update: {
          id?: string
          product_id?: string
          storage_path?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          id: string
          product_id: string
          min_qty: number
          price: number
        }
        Insert: {
          id?: string
          product_id: string
          min_qty: number
          price: number
        }
        Update: {
          id?: string
          product_id?: string
          min_qty?: number
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          sku: string
          barcode: string | null
          name: string
          description: string | null
          category_id: string | null
          unit_id: string
          retail_price: number
          wholesale_price: number
          purchase_price: number | null
          min_stock: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          barcode?: string | null
          name: string
          description?: string | null
          category_id?: string | null
          unit_id: string
          retail_price?: number
          wholesale_price?: number
          purchase_price?: number | null
          min_stock?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          barcode?: string | null
          name?: string
          description?: string | null
          category_id?: string | null
          unit_id?: string
          retail_price?: number
          wholesale_price?: number
          purchase_price?: number | null
          min_stock?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          purchase_id: string
          product_id: string
          qty: number
          qty_received: number
          unit_cost: number
          line_total: number
        }
        Insert: {
          id?: string
          purchase_id: string
          product_id: string
          qty: number
          qty_received?: number
          unit_cost: number
          line_total: number
        }
        Update: {
          id?: string
          purchase_id?: string
          product_id?: string
          qty?: number
          qty_received?: number
          unit_cost?: number
          line_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          id: string
          number: string
          supplier_id: string
          status: Database["public"]["Enums"]["purchase_status"]
          supplier_invoice: string | null
          total: number
          paid_amount: number
          received_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          number: string
          supplier_id: string
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_invoice?: string | null
          total?: number
          paid_amount?: number
          received_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          number?: string
          supplier_id?: string
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_invoice?: string | null
          total?: number
          paid_amount?: number
          received_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: boolean
          company_name: string
          inn: string | null
          address: string | null
          phone: string | null
          allow_negative_stock: boolean
          seller_max_discount: number
          low_stock_notify: boolean
          currency: string
          kpp: string | null
          ogrn: string | null
          legal_name: string | null
          bank_name: string | null
          bik: string | null
          bank_account: string | null
          corr_account: string | null
          director_name: string | null
        }
        Insert: {
          id?: boolean
          company_name?: string
          inn?: string | null
          address?: string | null
          phone?: string | null
          allow_negative_stock?: boolean
          seller_max_discount?: number
          low_stock_notify?: boolean
          currency?: string
          kpp?: string | null
          ogrn?: string | null
          legal_name?: string | null
          bank_name?: string | null
          bik?: string | null
          bank_account?: string | null
          corr_account?: string | null
          director_name?: string | null
        }
        Update: {
          id?: boolean
          company_name?: string
          inn?: string | null
          address?: string | null
          phone?: string | null
          allow_negative_stock?: boolean
          seller_max_discount?: number
          low_stock_notify?: boolean
          currency?: string
          kpp?: string | null
          ogrn?: string | null
          legal_name?: string | null
          bank_name?: string | null
          bik?: string | null
          bank_account?: string | null
          corr_account?: string | null
          director_name?: string | null
        }
        Relationships: [
        ]
      }
      stock: {
        Row: {
          product_id: string
          qty_on_hand: number
          qty_reserved: number
          qty_available: number | null
          avg_cost: number
          updated_at: string
        }
        Insert: {
          product_id: string
          qty_on_hand?: number
          qty_reserved?: number
          qty_available?: never
          avg_cost?: number
          updated_at?: string
        }
        Update: {
          product_id?: string
          qty_on_hand?: number
          qty_reserved?: number
          qty_available?: never
          avg_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_items: {
        Row: {
          id: string
          adjustment_id: string
          product_id: string
          qty_expected: number
          qty_actual: number
          qty_diff: number | null
        }
        Insert: {
          id?: string
          adjustment_id: string
          product_id: string
          qty_expected?: number
          qty_actual: number
          qty_diff?: never
        }
        Update: {
          id?: string
          adjustment_id?: string
          product_id?: string
          qty_expected?: number
          qty_actual?: number
          qty_diff?: never
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          id: string
          number: string
          type: string
          status: string
          reason: string | null
          posted_by: string | null
          posted_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          number: string
          type: string
          status?: string
          reason?: string | null
          posted_by?: string | null
          posted_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          number?: string
          type?: string
          status?: string
          reason?: string | null
          posted_by?: string | null
          posted_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          type: Database["public"]["Enums"]["movement_type"]
          qty: number
          unit_cost: number | null
          ref_type: string | null
          ref_id: string | null
          balance_after: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          type: Database["public"]["Enums"]["movement_type"]
          qty: number
          unit_cost?: number | null
          ref_type?: string | null
          ref_id?: string | null
          balance_after: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          type?: Database["public"]["Enums"]["movement_type"]
          qty?: number
          unit_cost?: number | null
          ref_type?: string | null
          ref_id?: string | null
          balance_after?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          id: string
          name: string
          inn: string | null
          contact_name: string | null
          phone: string | null
          email: string | null
          payment_terms_days: number
          notes: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          inn?: string | null
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          payment_terms_days?: number
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          inn?: string | null
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          payment_terms_days?: number
          notes?: string | null
          is_active?: boolean
        }
        Relationships: [
        ]
      }
      units: {
        Row: {
          id: string
          code: string
          name: string
          is_fractional: boolean
        }
        Insert: {
          id?: string
          code: string
          name: string
          is_fractional?: boolean
        }
        Update: {
          id?: string
          code?: string
          name?: string
          is_fractional?: boolean
        }
        Relationships: [
        ]
      }
    }
    Views: {
      catalog_items: {
        Row: {
          id: string | null
          sku: string | null
          barcode: string | null
          name: string | null
          description: string | null
          category_id: string | null
          category_name: string | null
          unit_id: string | null
          unit_code: string | null
          is_fractional: boolean | null
          retail_price: number | null
          wholesale_price: number | null
          min_stock: number | null
          is_active: boolean | null
          qty_on_hand: number | null
          qty_reserved: number | null
          qty_available: number | null
          is_low_stock: boolean | null
          main_image: string | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      order_items_public: {
        Row: {
          id: string | null
          order_id: string | null
          product_id: string | null
          qty: number | null
          unit_price: number | null
          price_source: string | null
          discount_percent: number | null
          line_total: number | null
        }
        Relationships: []
      }
      order_lines: {
        Row: {
          id: string | null
          order_id: string | null
          product_id: string | null
          sku: string | null
          product_name: string | null
          unit_code: string | null
          qty: number | null
          unit_price: number | null
          price_source: string | null
          discount_percent: number | null
          line_total: number | null
        }
        Relationships: []
      }
      products_public: {
        Row: {
          id: string | null
          sku: string | null
          barcode: string | null
          name: string | null
          description: string | null
          category_id: string | null
          unit_id: string | null
          retail_price: number | null
          wholesale_price: number | null
          min_stock: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      stock_public: {
        Row: {
          product_id: string | null
          qty_on_hand: number | null
          qty_reserved: number | null
          qty_available: number | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      allocate_payment: {
        Args: { p_client_id: string }
        Returns: number
      }
      app_timezone: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      bulk_update_prices: {
        Args: { p_product_ids: string[]; p_field: string; p_mode: string; p_value: number; p_round?: number }
        Returns: number
      }
      calc_price: {
        Args: { p_product_id: string; p_qty: number; p_price_type: Database["public"]["Enums"]["client_type"]; p_client_id?: string }
        Returns: { unit_price: number; price_source: string; discount_percent: number }[]
      }
      cash_balances: {
        Args: Record<PropertyKey, never>
        Returns: { cash_account_id: string; name: string; type: string; is_active: boolean; balance: number }[]
      }
      change_order_status: {
        Args: { p_order_id: string; p_to_status: Database["public"]["Enums"]["order_status"]; p_comment?: string; p_cancel_reason?: string }
        Returns: undefined
      }
      client_debt: {
        Args: { p_client_id: string }
        Returns: number
      }
      client_statement: {
        Args: { p_client_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      clients_overview: {
        Args: Record<PropertyKey, never>
        Returns: { client_id: string; debt: number; overdue: number; last_order_at: string }[]
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      dashboard_stats: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      deactivate_user: {
        Args: { p_user_id: string; p_reassign_to?: string }
        Returns: number
      }
      find_client_duplicates: {
        Args: { p_phone: string; p_inn: string; p_exclude?: string }
        Returns: { id: string; name: string; phone: string; inn: string }[]
      }
      import_products: {
        Args: { p_rows: Json; p_dry_run?: boolean }
        Returns: Json
      }
      is_active_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_owner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      low_stock_products: {
        Args: Record<PropertyKey, never>
        Returns: { product_id: string; sku: string; name: string; unit_code: string; qty_available: number; min_stock: number; need: number; purchase_price: number }[]
      }
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      post_adjustment: {
        Args: { p_id: string }
        Returns: undefined
      }
      post_inventory: {
        Args: { p_id: string }
        Returns: undefined
      }
      post_receipt: {
        Args: { p_purchase_id: string; p_items?: Json }
        Returns: undefined
      }
      pricing_context: {
        Args: { p_client_id?: string }
        Returns: Json
      }
      purchase_price_history: {
        Args: { p_product_id: string }
        Returns: { received_at: string; purchase_number: string; supplier_name: string; qty: number; unit_cost: number }[]
      }
      quick_sale: {
        Args: { p_payload: Json }
        Returns: string
      }
      register_payment: {
        Args: { p_client_id: string; p_order_id: string; p_amount: number; p_method: Database["public"]["Enums"]["payment_method"]; p_cash_account_id: string; p_paid_at?: string; p_comment?: string }
        Returns: string
      }
      register_supplier_payment: {
        Args: { p_supplier_id: string; p_purchase_id: string; p_amount: number; p_method: Database["public"]["Enums"]["payment_method"]; p_cash_account_id: string; p_paid_at?: string; p_comment?: string }
        Returns: string
      }
      report_abc: {
        Args: { p_from: string; p_to: string }
        Returns: { product_id: string; sku: string; name: string; revenue: number; share: number; cumulative: number; abc: string }[]
      }
      report_margin: {
        Args: { p_from: string; p_to: string; p_by?: string }
        Returns: { key: string; name: string; qty: number; revenue: number; cost: number; profit: number; margin_percent: number }[]
      }
      report_receivables_aging: {
        Args: Record<PropertyKey, never>
        Returns: { client_id: string; name: string; manager_name: string; not_due: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number }[]
      }
      report_sales: {
        Args: { p_from: string; p_to: string; p_group?: string }
        Returns: { period: string; retail: number; wholesale: number; total: number; orders: number }[]
      }
      report_sales_by_manager: {
        Args: { p_from: string; p_to: string }
        Returns: { manager_id: string; full_name: string; orders: number; revenue: number; avg_check: number }[]
      }
      report_stock_value: {
        Args: Record<PropertyKey, never>
        Returns: { product_id: string; sku: string; name: string; category_name: string; qty: number; avg_cost: number; value: number }[]
      }
      report_top_clients: {
        Args: { p_from: string; p_to: string; p_limit?: number }
        Returns: { client_id: string; name: string; orders: number; revenue: number }[]
      }
      report_top_products: {
        Args: { p_from: string; p_to: string; p_limit?: number }
        Returns: { product_id: string; sku: string; name: string; qty: number; revenue: number }[]
      }
      save_order: {
        Args: { p_order_id: string; p_payload: Json }
        Returns: string
      }
      save_purchase: {
        Args: { p_id: string; p_payload: Json }
        Returns: string
      }
      save_stock_document: {
        Args: { p_id: string; p_payload: Json }
        Returns: string
      }
      set_main_product_image: {
        Args: { p_image_id: string }
        Returns: undefined
      }
      set_purchase_status: {
        Args: { p_id: string; p_status: Database["public"]["Enums"]["purchase_status"] }
        Returns: undefined
      }
      supplier_balances: {
        Args: Record<PropertyKey, never>
        Returns: { supplier_id: string; name: string; received: number; paid: number; debt: number }[]
      }
      void_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      client_type: "wholesale" | "retail"
      movement_type: "receipt" | "reserve" | "unreserve" | "write_off_sale" | "adjustment" | "inventory" | "return"
      order_status: "new" | "confirmed" | "assembled" | "shipped" | "paid" | "cancelled"
      payment_method: "cash" | "card" | "bank_transfer" | "online"
      payment_status: "unpaid" | "partial" | "paid"
      purchase_status: "draft" | "ordered" | "received" | "cancelled"
      user_role: "owner" | "seller"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
