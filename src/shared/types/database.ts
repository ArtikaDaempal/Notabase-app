/**
 * shared/types/database.ts
 * TypeScript type definitions for Supabase PostgreSQL Database Schema.
 * Dokumen acuan: 04-database-schema.md
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─────────────────────────────────────────────────────────────────────────────
// Database Literal / Enum Types (04-database-schema.md §2)
// ─────────────────────────────────────────────────────────────────────────────

export type Platform = 'windows' | 'android'

export type ReceiptType = 'scan' | 'gallery' | 'manual'

export type StatusOcr = 'berhasil' | 'perlu_review' | 'gagal' | 'manual'

export type PeriodType = 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'rentang'

export type ExportStatus = 'sukses' | 'gagal'

export type OneDriveStatus = 'connected' | 'expired' | 'disconnected'

// ─────────────────────────────────────────────────────────────────────────────
// Database Interface (Supabase Auto-compatible)
// ─────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          code: string
          nama: string
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          nama: string
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          nama?: string
          logo_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          id: string
          workspace_id: string
          nama_perangkat: string | null
          platform: Platform | null
          install_id: string
          last_seen_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          nama_perangkat?: string | null
          platform?: Platform | null
          install_id: string
          last_seen_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          nama_perangkat?: string | null
          platform?: Platform | null
          install_id?: string
          last_seen_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'devices_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      receipts: {
        Row: {
          id: string
          workspace_id: string
          device_id: string | null
          receipt_number: string
          receipt_type: ReceiptType
          receipt_template: string | null
          image_url: string | null
          tanggal: string
          waktu: string | null
          nama_toko: string
          alamat: string | null
          nominal: number
          diskon: number
          pajak: number
          biaya_tambahan: number | null
          no_telepon: string | null
          subtotal_nominal: number | null
          nama_biaya_tambahan: string | null
          metode_pembayaran: string | null
          keterangan: string | null
          status_ocr: StatusOcr | null
          ocr_confidence: number | null
          ocr_raw_text: string | null
          is_deleted: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          device_id?: string | null
          receipt_number: string
          receipt_type?: ReceiptType
          receipt_template?: string | null
          image_url?: string | null
          tanggal: string
          waktu?: string | null
          nama_toko: string
          alamat?: string | null
          nominal?: number
          diskon?: number
          pajak?: number
          biaya_tambahan?: number | null
          no_telepon?: string | null
          subtotal_nominal?: number | null
          nama_biaya_tambahan?: string | null
          metode_pembayaran?: string | null
          keterangan?: string | null
          status_ocr?: StatusOcr | null
          ocr_confidence?: number | null
          ocr_raw_text?: string | null
          is_deleted?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          device_id?: string | null
          receipt_number?: string
          receipt_type?: ReceiptType
          receipt_template?: string | null
          image_url?: string | null
          tanggal?: string
          waktu?: string | null
          nama_toko?: string
          alamat?: string | null
          nominal?: number
          diskon?: number
          pajak?: number
          biaya_tambahan?: number | null
          no_telepon?: string | null
          subtotal_nominal?: number | null
          nama_biaya_tambahan?: string | null
          metode_pembayaran?: string | null
          keterangan?: string | null
          status_ocr?: StatusOcr | null
          ocr_confidence?: number | null
          ocr_raw_text?: string | null
          is_deleted?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'receipts_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receipts_device_id_fkey'
            columns: ['device_id']
            isOneToOne: false
            referencedRelation: 'devices'
            referencedColumns: ['id']
          }
        ]
      }
      receipt_items: {
        Row: {
          id: string
          receipt_id: string
          nama_barang: string
          qty: number
          harga: number
          subtotal: number
          urutan: number
          created_at: string
        }
        Insert: {
          id?: string
          receipt_id: string
          nama_barang: string
          qty?: number
          harga?: number
          urutan?: number
          created_at?: string
        }
        Update: {
          id?: string
          receipt_id?: string
          nama_barang?: string
          qty?: number
          harga?: number
          urutan?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'receipt_items_receipt_id_fkey'
            columns: ['receipt_id']
            isOneToOne: false
            referencedRelation: 'receipts'
            referencedColumns: ['id']
          }
        ]
      }
      export_history: {
        Row: {
          id: string
          workspace_id: string
          device_id: string | null
          file_name: string
          period_type: PeriodType | null
          period_start: string | null
          period_end: string | null
          total_baris: number | null
          total_nominal: number | null
          status: ExportStatus | null
          uploaded_onedrive: boolean
          onedrive_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          device_id?: string | null
          file_name: string
          period_type?: PeriodType | null
          period_start?: string | null
          period_end?: string | null
          total_baris?: number | null
          total_nominal?: number | null
          status?: ExportStatus | null
          uploaded_onedrive?: boolean
          onedrive_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          device_id?: string | null
          file_name?: string
          period_type?: PeriodType | null
          period_start?: string | null
          period_end?: string | null
          total_baris?: number | null
          total_nominal?: number | null
          status?: ExportStatus | null
          uploaded_onedrive?: boolean
          onedrive_path?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'export_history_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      onedrive_connections: {
        Row: {
          id: string
          workspace_id: string
          account_email: string
          connected_at: string
          status: OneDriveStatus
          storage_used_bytes: number | null
          storage_total_bytes: number | null
          last_checked_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          account_email: string
          connected_at?: string
          status?: OneDriveStatus
          storage_used_bytes?: number | null
          storage_total_bytes?: number | null
          last_checked_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          account_email?: string
          connected_at?: string
          status?: OneDriveStatus
          storage_used_bytes?: number | null
          storage_total_bytes?: number | null
          last_checked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'onedrive_connections_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: true
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      app_settings: {
        Row: {
          id: string
          workspace_id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'app_settings_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_workspace_context: {
        Args: { workspace_id: string }
        Returns: undefined
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

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Database Row Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceRow        = Database['public']['Tables']['workspaces']['Row']
export type DeviceRow           = Database['public']['Tables']['devices']['Row']
export type ReceiptRow          = Database['public']['Tables']['receipts']['Row']
export type ReceiptItemRow      = Database['public']['Tables']['receipt_items']['Row']
export type ExportHistoryRow    = Database['public']['Tables']['export_history']['Row']
export type OneDriveRow         = Database['public']['Tables']['onedrive_connections']['Row']
export type AppSettingRow       = Database['public']['Tables']['app_settings']['Row']
