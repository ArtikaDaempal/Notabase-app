// Notabase shared types

export type ReceiptStatus = "verified" | "pending" | "failed";

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface Receipt {
  id: string;
  invoiceNumber: string | null;
  merchantName: string;
  transactionDate: string; // ISO string
  category: string | null;
  total: number;
  description: string | null;
  imageUrl: string | null;
  ocrText: string | null;
  confidence: number;
  status: ReceiptStatus;
  items: ReceiptItem[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface UploadLog {
  id: string;
  receiptId: string | null;
  status: "pending" | "success" | "failed";
  provider: "local" | "onedrive";
  fileName: string | null;
  fileSize: number | null;
  message: string | null;
  uploadedAt: string;
}

export interface SyncLog {
  id: string;
  fileName: string;
  status: "pending" | "uploading" | "success" | "failed";
  progress: number;
  fileSize: number | null;
  provider: "onedrive";
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OcrResult {
  invoiceNumber: string | null;
  merchantName: string;
  transactionDate: string | null;
  total: number;
  category: string | null;
  description: string | null;
  items: ReceiptItem[];
  ocrText: string;
  confidence: number;
}

// Dashboard analytics
export interface DashboardStats {
  today: { count: number; total: number };
  week: { count: number; total: number };
  month: { count: number; total: number };
  allTime: { count: number; total: number };
  chart: { label: string; value: number }[];
  topCategories: { name: string; count: number; total: number }[];
  topMerchants: { name: string; count: number; total: number }[];
  recent: Receipt[];
}

// Navigation
export type AppView =
  | "splash"
  | "dashboard"
  | "scan"
  | "ocr-preview"
  | "history"
  | "detail"
  | "report"
  | "onedrive"
  | "settings";

export type NavTab = "dashboard" | "scan" | "history" | "settings";
