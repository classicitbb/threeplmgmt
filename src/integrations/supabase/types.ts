export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamped = {
  created_at: string;
  updated_at: string;
};

type CreatedBy = {
  created_by: string | null;
};

type BaseTable<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      roles: BaseTable<
        Timestamped & {
          id: string;
          code: Database["public"]["Enums"]["app_role_code"];
          name: string;
          description: string | null;
        },
        {
          id?: string;
          code: Database["public"]["Enums"]["app_role_code"];
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          code?: Database["public"]["Enums"]["app_role_code"];
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      profiles: BaseTable<
        Timestamped & {
          id: string;
          email: string | null;
          full_name: string | null;
          default_warehouse_id: string | null;
          active: boolean;
        },
        {
          id: string;
          email?: string | null;
          full_name?: string | null;
          default_warehouse_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          default_warehouse_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      user_roles: BaseTable<
        Timestamped & {
          id: string;
          user_id: string;
          role_id: string;
          warehouse_id: string | null;
        },
        {
          id?: string;
          user_id: string;
          role_id: string;
          warehouse_id?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          role_id?: string;
          warehouse_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      warehouses: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            code: string;
            name: string;
            address_line_1: string | null;
            address_line_2: string | null;
            city: string | null;
            country: string | null;
            has_cool_zone: boolean;
            active: boolean;
          },
        {
          id?: string;
          code: string;
          name: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          country?: string | null;
          has_cool_zone?: boolean;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          code: string;
          name: string;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          country: string | null;
          has_cool_zone: boolean;
          active: boolean;
        }>
      >;
      zones: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            warehouse_id: string;
            code: string;
            name: string;
            temperature_class: Database["public"]["Enums"]["temperature_class"];
            is_dispatch: boolean;
            is_quarantine: boolean;
            is_staging: boolean;
            sort_order: number;
            notes: string | null;
          },
        {
          id?: string;
          warehouse_id: string;
          code: string;
          name: string;
          temperature_class?: Database["public"]["Enums"]["temperature_class"];
          is_dispatch?: boolean;
          is_quarantine?: boolean;
          is_staging?: boolean;
          sort_order?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          warehouse_id: string;
          code: string;
          name: string;
          temperature_class: Database["public"]["Enums"]["temperature_class"];
          is_dispatch: boolean;
          is_quarantine: boolean;
          is_staging: boolean;
          sort_order: number;
          notes: string | null;
        }>
      >;
      locations: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            warehouse_id: string;
            zone_id: string;
            code: string;
            aisle: string | null;
            bay: string | null;
            level: number | null;
            depth: number;
            location_type: Database["public"]["Enums"]["location_type"];
            temperature_class: Database["public"]["Enums"]["temperature_class"];
            max_length: number | null;
            max_width: number | null;
            max_height: number | null;
            max_weight: number | null;
            max_pallets: number;
            mixed_sku_allowed: boolean;
            mixed_lot_allowed: boolean;
            allowed_product_family: string | null;
            pick_sequence: number;
            putaway_sequence: number;
            status: Database["public"]["Enums"]["location_status"];
            notes: string | null;
            layout_x: number | null;
            layout_y: number | null;
            layout_width: number | null;
            layout_height: number | null;
          },
        {
          id?: string;
          warehouse_id: string;
          zone_id: string;
          code: string;
          aisle?: string | null;
          bay?: string | null;
          level?: number | null;
          depth?: number;
          location_type?: Database["public"]["Enums"]["location_type"];
          temperature_class?: Database["public"]["Enums"]["temperature_class"];
          max_length?: number | null;
          max_width?: number | null;
          max_height?: number | null;
          max_weight?: number | null;
          max_pallets?: number;
          mixed_sku_allowed?: boolean;
          mixed_lot_allowed?: boolean;
          allowed_product_family?: string | null;
          pick_sequence?: number;
          putaway_sequence?: number;
          status?: Database["public"]["Enums"]["location_status"];
          notes?: string | null;
          layout_x?: number | null;
          layout_y?: number | null;
          layout_width?: number | null;
          layout_height?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          warehouse_id: string;
          zone_id: string;
          code: string;
          aisle: string | null;
          bay: string | null;
          level: number | null;
          depth: number;
          location_type: Database["public"]["Enums"]["location_type"];
          temperature_class: Database["public"]["Enums"]["temperature_class"];
          max_length: number | null;
          max_width: number | null;
          max_height: number | null;
          max_weight: number | null;
          max_pallets: number;
          mixed_sku_allowed: boolean;
          mixed_lot_allowed: boolean;
          allowed_product_family: string | null;
          pick_sequence: number;
          putaway_sequence: number;
          status: Database["public"]["Enums"]["location_status"];
          notes: string | null;
          layout_x: number | null;
          layout_y: number | null;
          layout_width: number | null;
          layout_height: number | null;
        }>
      >;
      clients: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            code: string;
            name: string;
            allow_mixed_stock: boolean;
            allow_mixed_sku_pallet: boolean;
            allow_mixed_lot_pallet: boolean;
            require_expiry: boolean;
            active: boolean;
          },
        {
          id?: string;
          code: string;
          name: string;
          allow_mixed_stock?: boolean;
          allow_mixed_sku_pallet?: boolean;
          allow_mixed_lot_pallet?: boolean;
          require_expiry?: boolean;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          code: string;
          name: string;
          allow_mixed_stock: boolean;
          allow_mixed_sku_pallet: boolean;
          allow_mixed_lot_pallet: boolean;
          require_expiry: boolean;
          active: boolean;
        }>
      >;
      products: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            sku: string;
            barcode: string | null;
            name: string;
            description: string | null;
            client_owner_id: string;
            product_family: string | null;
            temperature_requirement: Database["public"]["Enums"]["temperature_class"];
            length: number | null;
            width: number | null;
            height: number | null;
            weight: number | null;
            stackable: boolean;
            max_stack_height: number | null;
            lot_tracked: boolean;
            batch_tracked: boolean;
            expiry_tracked: boolean;
            rotation_method: Database["public"]["Enums"]["rotation_method"];
            active: boolean;
          },
        {
          id?: string;
          sku: string;
          barcode?: string | null;
          name: string;
          description?: string | null;
          client_owner_id: string;
          product_family?: string | null;
          temperature_requirement?: Database["public"]["Enums"]["temperature_class"];
          length?: number | null;
          width?: number | null;
          height?: number | null;
          weight?: number | null;
          stackable?: boolean;
          max_stack_height?: number | null;
          lot_tracked?: boolean;
          batch_tracked?: boolean;
          expiry_tracked?: boolean;
          rotation_method?: Database["public"]["Enums"]["rotation_method"];
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          sku: string;
          barcode: string | null;
          name: string;
          description: string | null;
          client_owner_id: string;
          product_family: string | null;
          temperature_requirement: Database["public"]["Enums"]["temperature_class"];
          length: number | null;
          width: number | null;
          height: number | null;
          weight: number | null;
          stackable: boolean;
          max_stack_height: number | null;
          lot_tracked: boolean;
          batch_tracked: boolean;
          expiry_tracked: boolean;
          rotation_method: Database["public"]["Enums"]["rotation_method"];
          active: boolean;
        }>
      >;
      product_packaging_profiles: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            product_id: string;
            profile_name: string;
            package_type: string;
            units_per_package: number;
            length: number | null;
            width: number | null;
            height: number | null;
            weight: number | null;
            barcode: string | null;
            is_default: boolean;
          },
        {
          id?: string;
          product_id: string;
          profile_name: string;
          package_type: string;
          units_per_package?: number;
          length?: number | null;
          width?: number | null;
          height?: number | null;
          weight?: number | null;
          barcode?: string | null;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          product_id: string;
          profile_name: string;
          package_type: string;
          units_per_package: number;
          length: number | null;
          width: number | null;
          height: number | null;
          weight: number | null;
          barcode: string | null;
          is_default: boolean;
        }>
      >;
      inventory_lots: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            product_id: string;
            client_id: string;
            lot_number: string | null;
            batch_number: string | null;
            manufacture_date: string | null;
            expiry_date: string | null;
            loading_date: string | null;
            rotation_date: string | null;
          },
        {
          id?: string;
          product_id: string;
          client_id: string;
          lot_number?: string | null;
          batch_number?: string | null;
          manufacture_date?: string | null;
          expiry_date?: string | null;
          loading_date?: string | null;
          rotation_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          product_id: string;
          client_id: string;
          lot_number: string | null;
          batch_number: string | null;
          manufacture_date: string | null;
          expiry_date: string | null;
          loading_date: string | null;
          rotation_date: string | null;
        }>
      >;
      receipts: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            receipt_number: string;
            receipt_type: Database["public"]["Enums"]["receipt_type"];
            reference_number: string | null;
            warehouse_id: string;
            source_warehouse_id: string | null;
            client_id: string | null;
            status: Database["public"]["Enums"]["task_status"];
            notes: string | null;
          },
        {
          id?: string;
          receipt_number: string;
          receipt_type: Database["public"]["Enums"]["receipt_type"];
          reference_number?: string | null;
          warehouse_id: string;
          source_warehouse_id?: string | null;
          client_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          receipt_number: string;
          receipt_type: Database["public"]["Enums"]["receipt_type"];
          reference_number: string | null;
          warehouse_id: string;
          source_warehouse_id: string | null;
          client_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          notes: string | null;
        }>
      >;
      receipt_lines: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            receipt_id: string;
            product_id: string;
            packaging_profile_id: string | null;
            client_id: string;
            quantity: number;
            received_quantity: number;
            override_length: number | null;
            override_width: number | null;
            override_height: number | null;
            override_weight: number | null;
            inventory_lot_id: string | null;
            notes: string | null;
          },
        {
          id?: string;
          receipt_id: string;
          product_id: string;
          packaging_profile_id?: string | null;
          client_id: string;
          quantity: number;
          received_quantity?: number;
          override_length?: number | null;
          override_width?: number | null;
          override_height?: number | null;
          override_weight?: number | null;
          inventory_lot_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          receipt_id: string;
          product_id: string;
          packaging_profile_id: string | null;
          client_id: string;
          quantity: number;
          received_quantity: number;
          override_length: number | null;
          override_width: number | null;
          override_height: number | null;
          override_weight: number | null;
          inventory_lot_id: string | null;
          notes: string | null;
        }>
      >;
      pallets: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            pallet_code: string;
            pallet_barcode: string;
            product_id: string;
            client_id: string;
            receipt_line_id: string | null;
            current_location_id: string | null;
            current_warehouse_id: string;
            inventory_lot_id: string | null;
            packaging_profile_id: string | null;
            quantity: number;
            available_quantity: number;
            reserved_quantity: number;
            held_quantity: number;
            damaged_quantity: number;
            status: Database["public"]["Enums"]["inventory_status"];
            is_stored: boolean;
            last_counted_at: string | null;
            length: number | null;
            width: number | null;
            height: number | null;
            weight: number | null;
            stack_height: number | null;
          },
        {
          id?: string;
          pallet_code: string;
          pallet_barcode: string;
          product_id: string;
          client_id: string;
          receipt_line_id?: string | null;
          current_location_id?: string | null;
          current_warehouse_id: string;
          inventory_lot_id?: string | null;
          packaging_profile_id?: string | null;
          quantity: number;
          available_quantity?: number;
          reserved_quantity?: number;
          held_quantity?: number;
          damaged_quantity?: number;
          status?: Database["public"]["Enums"]["inventory_status"];
          is_stored?: boolean;
          last_counted_at?: string | null;
          length?: number | null;
          width?: number | null;
          height?: number | null;
          weight?: number | null;
          stack_height?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          pallet_code: string;
          pallet_barcode: string;
          product_id: string;
          client_id: string;
          receipt_line_id: string | null;
          current_location_id: string | null;
          current_warehouse_id: string;
          inventory_lot_id: string | null;
          packaging_profile_id: string | null;
          quantity: number;
          available_quantity: number;
          reserved_quantity: number;
          held_quantity: number;
          damaged_quantity: number;
          status: Database["public"]["Enums"]["inventory_status"];
          is_stored: boolean;
          last_counted_at: string | null;
          length: number | null;
          width: number | null;
          height: number | null;
          weight: number | null;
          stack_height: number | null;
        }>
      >;
      inventory_balances: BaseTable<
        Timestamped & {
          id: string;
          pallet_id: string;
          product_id: string;
          client_id: string;
          warehouse_id: string;
          zone_id: string | null;
          location_id: string | null;
          inventory_lot_id: string | null;
          status: Database["public"]["Enums"]["inventory_status"];
          quantity: number;
          available_quantity: number;
          reserved_quantity: number;
          held_quantity: number;
          damaged_quantity: number;
          received_at: string;
          expiry_date: string | null;
        },
        {
          id?: string;
          pallet_id: string;
          product_id: string;
          client_id: string;
          warehouse_id: string;
          zone_id?: string | null;
          location_id?: string | null;
          inventory_lot_id?: string | null;
          status: Database["public"]["Enums"]["inventory_status"];
          quantity?: number;
          available_quantity?: number;
          reserved_quantity?: number;
          held_quantity?: number;
          damaged_quantity?: number;
          received_at?: string;
          expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & {
          id: string;
          pallet_id: string;
          product_id: string;
          client_id: string;
          warehouse_id: string;
          zone_id: string | null;
          location_id: string | null;
          inventory_lot_id: string | null;
          status: Database["public"]["Enums"]["inventory_status"];
          quantity: number;
          available_quantity: number;
          reserved_quantity: number;
          held_quantity: number;
          damaged_quantity: number;
          received_at: string;
          expiry_date: string | null;
        }>
      >;
      putaway_tasks: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            task_number: string;
            pallet_id: string;
            warehouse_id: string;
            suggested_location_id: string | null;
            assigned_user_id: string | null;
            status: Database["public"]["Enums"]["task_status"];
            override_reason: string | null;
            alternative_requested: boolean;
            completed_at: string | null;
          },
        {
          id?: string;
          task_number: string;
          pallet_id: string;
          warehouse_id: string;
          suggested_location_id?: string | null;
          assigned_user_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          override_reason?: string | null;
          alternative_requested?: boolean;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          task_number: string;
          pallet_id: string;
          warehouse_id: string;
          suggested_location_id: string | null;
          assigned_user_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          override_reason: string | null;
          alternative_requested: boolean;
          completed_at: string | null;
        }>
      >;
      move_tasks: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            task_number: string;
            pallet_id: string;
            from_location_id: string | null;
            to_location_id: string | null;
            warehouse_id: string;
            transfer_id: string | null;
            assigned_user_id: string | null;
            status: Database["public"]["Enums"]["task_status"];
            reason: string | null;
            completed_at: string | null;
          },
        {
          id?: string;
          task_number: string;
          pallet_id: string;
          from_location_id?: string | null;
          to_location_id?: string | null;
          warehouse_id: string;
          transfer_id?: string | null;
          assigned_user_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          reason?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          task_number: string;
          pallet_id: string;
          from_location_id: string | null;
          to_location_id: string | null;
          warehouse_id: string;
          transfer_id: string | null;
          assigned_user_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          reason: string | null;
          completed_at: string | null;
        }>
      >;
      orders: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            order_number: string;
            order_type: Database["public"]["Enums"]["order_type"];
            client_id: string;
            warehouse_id: string;
            status: Database["public"]["Enums"]["task_status"];
            priority: number;
            requested_ship_date: string | null;
            notes: string | null;
          },
        {
          id?: string;
          order_number: string;
          order_type?: Database["public"]["Enums"]["order_type"];
          client_id: string;
          warehouse_id: string;
          status?: Database["public"]["Enums"]["task_status"];
          priority?: number;
          requested_ship_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          order_number: string;
          order_type: Database["public"]["Enums"]["order_type"];
          client_id: string;
          warehouse_id: string;
          status: Database["public"]["Enums"]["task_status"];
          priority: number;
          requested_ship_date: string | null;
          notes: string | null;
        }>
      >;
      order_lines: BaseTable<
        Timestamped & {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          allocated_quantity: number;
          picked_quantity: number;
          inventory_lot_id: string | null;
          required_expiry_before: string | null;
          notes: string | null;
        },
        {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          allocated_quantity?: number;
          picked_quantity?: number;
          inventory_lot_id?: string | null;
          required_expiry_before?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          allocated_quantity: number;
          picked_quantity: number;
          inventory_lot_id: string | null;
          required_expiry_before: string | null;
          notes: string | null;
        }>
      >;
      pick_lists: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            pick_list_number: string;
            warehouse_id: string;
            client_id: string | null;
            order_id: string | null;
            transfer_id: string | null;
            consolidated: boolean;
            status: Database["public"]["Enums"]["task_status"];
            released_at: string | null;
            assigned_user_id: string | null;
            notes: string | null;
          },
        {
          id?: string;
          pick_list_number: string;
          warehouse_id: string;
          client_id?: string | null;
          order_id?: string | null;
          transfer_id?: string | null;
          consolidated?: boolean;
          status?: Database["public"]["Enums"]["task_status"];
          released_at?: string | null;
          assigned_user_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          pick_list_number: string;
          warehouse_id: string;
          client_id: string | null;
          order_id: string | null;
          transfer_id: string | null;
          consolidated: boolean;
          status: Database["public"]["Enums"]["task_status"];
          released_at: string | null;
          assigned_user_id: string | null;
          notes: string | null;
        }>
      >;
      pick_tasks: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            task_number: string;
            pick_list_id: string;
            order_line_id: string | null;
            pallet_id: string | null;
            location_id: string | null;
            staging_location_id: string | null;
            assigned_user_id: string | null;
            status: Database["public"]["Enums"]["task_status"];
            requested_quantity: number;
            confirmed_quantity: number;
            short_reason: string | null;
            completed_at: string | null;
          },
        {
          id?: string;
          task_number: string;
          pick_list_id: string;
          order_line_id?: string | null;
          pallet_id?: string | null;
          location_id?: string | null;
          staging_location_id?: string | null;
          assigned_user_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          requested_quantity: number;
          confirmed_quantity?: number;
          short_reason?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          task_number: string;
          pick_list_id: string;
          order_line_id: string | null;
          pallet_id: string | null;
          location_id: string | null;
          staging_location_id: string | null;
          assigned_user_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          requested_quantity: number;
          confirmed_quantity: number;
          short_reason: string | null;
          completed_at: string | null;
        }>
      >;
      transfers: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            transfer_number: string;
            transfer_type: Database["public"]["Enums"]["transfer_type"];
            source_warehouse_id: string;
            destination_warehouse_id: string;
            status: Database["public"]["Enums"]["task_status"];
            dispatched_at: string | null;
            received_at: string | null;
            notes: string | null;
          },
        {
          id?: string;
          transfer_number: string;
          transfer_type: Database["public"]["Enums"]["transfer_type"];
          source_warehouse_id: string;
          destination_warehouse_id: string;
          status?: Database["public"]["Enums"]["task_status"];
          dispatched_at?: string | null;
          received_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          transfer_number: string;
          transfer_type: Database["public"]["Enums"]["transfer_type"];
          source_warehouse_id: string;
          destination_warehouse_id: string;
          status: Database["public"]["Enums"]["task_status"];
          dispatched_at: string | null;
          received_at: string | null;
          notes: string | null;
        }>
      >;
      transfer_lines: BaseTable<
        Timestamped & {
          id: string;
          transfer_id: string;
          pallet_id: string | null;
          product_id: string;
          client_id: string;
          quantity: number;
          inventory_lot_id: string | null;
        },
        {
          id?: string;
          transfer_id: string;
          pallet_id?: string | null;
          product_id: string;
          client_id: string;
          quantity: number;
          inventory_lot_id?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & {
          id: string;
          transfer_id: string;
          pallet_id: string | null;
          product_id: string;
          client_id: string;
          quantity: number;
          inventory_lot_id: string | null;
        }>
      >;
      cycle_counts: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            count_number: string;
            warehouse_id: string;
            zone_id: string | null;
            location_id: string | null;
            scope: Database["public"]["Enums"]["count_scope"];
            status: Database["public"]["Enums"]["task_status"];
            assigned_user_id: string | null;
            variance_threshold_percent: number;
            approved_by: string | null;
            approved_at: string | null;
            notes: string | null;
          },
        {
          id?: string;
          count_number: string;
          warehouse_id: string;
          zone_id?: string | null;
          location_id?: string | null;
          scope: Database["public"]["Enums"]["count_scope"];
          status?: Database["public"]["Enums"]["task_status"];
          assigned_user_id?: string | null;
          variance_threshold_percent?: number;
          approved_by?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          count_number: string;
          warehouse_id: string;
          zone_id: string | null;
          location_id: string | null;
          scope: Database["public"]["Enums"]["count_scope"];
          status: Database["public"]["Enums"]["task_status"];
          assigned_user_id: string | null;
          variance_threshold_percent: number;
          approved_by: string | null;
          approved_at: string | null;
          notes: string | null;
        }>
      >;
      cycle_count_lines: BaseTable<
        Timestamped & {
          id: string;
          cycle_count_id: string;
          location_id: string | null;
          product_id: string | null;
          pallet_id: string | null;
          expected_quantity: number;
          counted_quantity: number;
          variance_quantity: number;
          variance_percent: number;
          status: Database["public"]["Enums"]["task_status"];
          notes: string | null;
        },
        {
          id?: string;
          cycle_count_id: string;
          location_id?: string | null;
          product_id?: string | null;
          pallet_id?: string | null;
          expected_quantity?: number;
          counted_quantity?: number;
          variance_quantity?: number;
          variance_percent?: number;
          status?: Database["public"]["Enums"]["task_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & {
          id: string;
          cycle_count_id: string;
          location_id: string | null;
          product_id: string | null;
          pallet_id: string | null;
          expected_quantity: number;
          counted_quantity: number;
          variance_quantity: number;
          variance_percent: number;
          status: Database["public"]["Enums"]["task_status"];
          notes: string | null;
        }>
      >;
      stock_adjustments: BaseTable<
        Timestamped &
          CreatedBy & {
            id: string;
            adjustment_number: string;
            pallet_id: string | null;
            inventory_balance_id: string | null;
            adjustment_type: string;
            quantity_delta: number;
            old_status: Database["public"]["Enums"]["inventory_status"] | null;
            new_status: Database["public"]["Enums"]["inventory_status"] | null;
            reason: string;
            approved_by: string | null;
          },
        {
          id?: string;
          adjustment_number: string;
          pallet_id?: string | null;
          inventory_balance_id?: string | null;
          adjustment_type: string;
          quantity_delta: number;
          old_status?: Database["public"]["Enums"]["inventory_status"] | null;
          new_status?: Database["public"]["Enums"]["inventory_status"] | null;
          reason: string;
          approved_by?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & CreatedBy & {
          id: string;
          adjustment_number: string;
          pallet_id: string | null;
          inventory_balance_id: string | null;
          adjustment_type: string;
          quantity_delta: number;
          old_status: Database["public"]["Enums"]["inventory_status"] | null;
          new_status: Database["public"]["Enums"]["inventory_status"] | null;
          reason: string;
          approved_by: string | null;
        }>
      >;
      barcode_labels: BaseTable<
        Timestamped & {
          id: string;
          label_type: Database["public"]["Enums"]["label_type"];
          entity_id: string;
          label_code: string;
          storage_path: string | null;
          printed_by: string | null;
          reprint_count: number;
          last_printed_at: string | null;
        },
        {
          id?: string;
          label_type: Database["public"]["Enums"]["label_type"];
          entity_id: string;
          label_code: string;
          storage_path?: string | null;
          printed_by?: string | null;
          reprint_count?: number;
          last_printed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Timestamped & {
          id: string;
          label_type: Database["public"]["Enums"]["label_type"];
          entity_id: string;
          label_code: string;
          storage_path: string | null;
          printed_by: string | null;
          reprint_count: number;
          last_printed_at: string | null;
        }>
      >;
      audit_events: BaseTable<
        {
          id: string;
          event_type: Database["public"]["Enums"]["movement_type"];
          entity_table: string;
          entity_id: string;
          warehouse_id: string | null;
          pallet_id: string | null;
          from_location_id: string | null;
          to_location_id: string | null;
          actor_user_id: string | null;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          event_type: Database["public"]["Enums"]["movement_type"];
          entity_table: string;
          entity_id: string;
          warehouse_id?: string | null;
          pallet_id?: string | null;
          from_location_id?: string | null;
          to_location_id?: string | null;
          actor_user_id?: string | null;
          metadata?: Json;
          created_at?: string;
        },
        Partial<{
          id: string;
          event_type: Database["public"]["Enums"]["movement_type"];
          entity_table: string;
          entity_id: string;
          warehouse_id: string | null;
          pallet_id: string | null;
          from_location_id: string | null;
          to_location_id: string | null;
          actor_user_id: string | null;
          metadata: Json;
          created_at: string;
        }>
      >;
    };
    Views: {
      inventory_search_view: {
        Row: {
          inventory_balance_id: string;
          pallet_id: string;
          pallet_code: string;
          pallet_barcode: string;
          product_id: string;
          sku: string;
          product_barcode: string | null;
          product_name: string;
          client_id: string;
          client_name: string;
          warehouse_id: string;
          warehouse_code: string;
          zone_code: string | null;
          location_code: string | null;
          inventory_lot_id: string | null;
          lot_number: string | null;
          batch_number: string | null;
          expiry_date: string | null;
          status: Database["public"]["Enums"]["inventory_status"];
          quantity: number;
          available_quantity: number;
          reserved_quantity: number;
          held_quantity: number;
          damaged_quantity: number;
          received_at: string;
        };
      };
      location_occupancy_view: {
        Row: {
          location_id: string;
          location_code: string;
          warehouse_id: string;
          zone_id: string;
          location_type: Database["public"]["Enums"]["location_type"];
          temperature_class: Database["public"]["Enums"]["temperature_class"];
          status: Database["public"]["Enums"]["location_status"];
          occupied_pallets: number;
          max_pallets: number;
          is_full: boolean;
          has_expiring_stock: boolean | null;
        };
      };
    };
    Functions: {
      current_role_codes: {
        Args: Record<string, never>;
        Returns: Database["public"]["Enums"]["app_role_code"][];
      };
      has_any_role: {
        Args: { roles: Database["public"]["Enums"]["app_role_code"][] };
        Returns: boolean;
      };
      is_operator_for_assignment: {
        Args: { assigned_user: string | null };
        Returns: boolean;
      };
      log_audit_event: {
        Args: {
          in_event_type: Database["public"]["Enums"]["movement_type"];
          in_entity_table: string;
          in_entity_id: string;
          in_warehouse_id?: string | null;
          in_pallet_id?: string | null;
          in_from_location_id?: string | null;
          in_to_location_id?: string | null;
          in_metadata?: Json;
        };
        Returns: string;
      };
      directed_putaway_candidates: {
        Args: { in_pallet_id: string };
        Returns: {
          location_id: string;
          location_code: string;
          score: number;
          reason: string;
        }[];
      };
    };
    Enums: {
      app_role_code: "admin" | "warehouse_manager" | "inventory_clerk" | "warehouse_operator";
      temperature_class: "ambient" | "cool" | "frozen";
      location_type: "rack" | "staging" | "quarantine" | "dispatch" | "receiving" | "floor" | "returns";
      location_status: "active" | "blocked" | "maintenance" | "disabled";
      inventory_status:
        | "receiving"
        | "available"
        | "reserved"
        | "picked"
        | "staged"
        | "in_transit"
        | "hold"
        | "quarantine"
        | "damaged"
        | "missing";
      rotation_method: "fifo" | "fefo";
      task_status: "draft" | "queued" | "assigned" | "in_progress" | "completed" | "cancelled" | "exception";
      movement_type:
        | "receipt"
        | "putaway"
        | "move"
        | "pick"
        | "transfer_dispatch"
        | "transfer_receive"
        | "cycle_count"
        | "adjustment"
        | "status_change"
        | "label_reprint";
      receipt_type: "po" | "transfer" | "manual";
      order_type: "sales" | "transfer";
      transfer_type: "inter_warehouse" | "intra_warehouse";
      count_scope: "location" | "zone" | "sku" | "spot";
      label_type: "pallet" | "location" | "pick_list" | "transfer_document" | "count_sheet";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
