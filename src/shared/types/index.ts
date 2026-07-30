/**
 * shared/types/index.ts
 * Barrel re-export for all shared Notabase domain types.
 *
 * Direct modules:
 * - database.ts  -> Supabase DDL table schema, row types, literal enums
 * - workspace.ts -> Workspace, Device, LocalWorkspaceConfig
 * - receipt.ts   -> Receipt, ReceiptItem, OcrResult, LocalReceipt
 * - export.ts    -> ExportHistory, PeriodType, ExportStatus
 * - onedrive.ts  -> OneDriveConnection, OneDriveStatus, SyncLog
 */

export * from './database'
export * from './workspace'
export * from './receipt'
export * from './export'
export * from './onedrive'
