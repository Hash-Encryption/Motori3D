export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: "ACTIVE" | "SUSPENDED";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: "ACTIVE" | "SUSPENDED";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          status?: "ACTIVE" | "SUSPENDED";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_memberships: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: "DEALER_ADMIN" | "DEALER_MEMBER";
          status: "ACTIVE" | "SUSPENDED";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role: "DEALER_ADMIN" | "DEALER_MEMBER";
          status?: "ACTIVE" | "SUSPENDED";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: "DEALER_ADMIN" | "DEALER_MEMBER";
          status?: "ACTIVE" | "SUSPENDED";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_memberships_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_listings: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          make: string;
          model: string;
          year: number;
          trim: string | null;
          body_style: string | null;
          transmission: string | null;
          fuel_type: string | null;
          price: number | null;
          description: string | null;
          status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          make: string;
          model: string;
          year: number;
          trim?: string | null;
          body_style?: string | null;
          transmission?: string | null;
          fuel_type?: string | null;
          price?: number | null;
          description?: string | null;
          status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          title?: string;
          make?: string;
          model?: string;
          year?: number;
          trim?: string | null;
          body_style?: string | null;
          transmission?: string | null;
          fuel_type?: string | null;
          price?: number | null;
          description?: string | null;
          status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_listings_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          id: string;
          business_id: string;
          listing_id: string;
          make: string;
          model: string;
          year: number;
          price: number | null;
          mileage: number | null;
          vin: string | null;
          stock_number: string | null;
          trim: string | null;
          exterior_color: string | null;
          interior_color: string | null;
          body_style: string | null;
          transmission: string | null;
          fuel_type: string | null;
          status: "DRAFT" | "PUBLISHED" | "SOLD";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          listing_id?: string;
          make: string;
          model: string;
          year: number;
          price?: number | null;
          mileage?: number | null;
          vin?: string | null;
          stock_number?: string | null;
          trim?: string | null;
          exterior_color?: string | null;
          interior_color?: string | null;
          body_style?: string | null;
          transmission?: string | null;
          fuel_type?: string | null;
          status?: "DRAFT" | "PUBLISHED" | "SOLD";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          listing_id?: string;
          make?: string;
          model?: string;
          year?: number;
          price?: number | null;
          mileage?: number | null;
          vin?: string | null;
          stock_number?: string | null;
          trim?: string | null;
          exterior_color?: string | null;
          interior_color?: string | null;
          body_style?: string | null;
          transmission?: string | null;
          fuel_type?: string | null;
          status?: "DRAFT" | "PUBLISHED" | "SOLD";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_listing_business_fkey";
            columns: ["listing_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_listings";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
      cloud_captures: {
        Row: {
          id: string;
          business_id: string;
          vehicle_id: string;
          status: "READY" | "PROCESSING" | "FAILED";
          frame_count: number;
          target_frame_count: number;
          width: number;
          height: number;
          duration_seconds: number | null;
          fps: number | null;
          source_filename: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          vehicle_id: string;
          status?: "READY" | "PROCESSING" | "FAILED";
          frame_count?: number;
          target_frame_count?: number;
          width?: number;
          height?: number;
          duration_seconds?: number | null;
          fps?: number | null;
          source_filename?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          vehicle_id?: string;
          status?: "READY" | "PROCESSING" | "FAILED";
          frame_count?: number;
          target_frame_count?: number;
          width?: number;
          height?: number;
          duration_seconds?: number | null;
          fps?: number | null;
          source_filename?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cloud_capture_frames: {
        Row: {
          id: string;
          capture_id: string;
          frame_index: number;
          storage_path: string;
          public_url: string;
          width: number;
          height: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          capture_id: string;
          frame_index: number;
          storage_path: string;
          public_url: string;
          width?: number;
          height?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          capture_id?: string;
          frame_index?: number;
          storage_path?: string;
          public_url?: string;
          width?: number;
          height?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_dealership: {
        Args: {
          dealership_name: string;
          dealership_slug: string;
        };
        Returns: {
          business_id: string;
          membership_id: string;
          name: string;
          slug: string;
          role: string;
        };
      };
      is_business_member: {
        Args: {
          target_business_id: string;
        };
        Returns: boolean;
      };
      is_business_admin: {
        Args: {
          target_business_id: string;
        };
        Returns: boolean;
      };
      create_listing_with_unit: {
        Args: {
          p_listing: Json;
          p_unit: Json;
        };
        Returns: {
          listing_id: string;
          unit_id: string;
        };
      };
      reassign_vehicle_unit: {
        Args: {
          p_unit_id: string;
          p_target_listing_id: string;
          p_business_id: string;
        };
        Returns: {
          success: boolean;
          unit_id: string;
          listing_id: string;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
