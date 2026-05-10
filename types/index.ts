export type Category =
  | 'Groceries'
  | 'Electronics'
  | 'Dining'
  | 'Pharmacy'
  | 'Gas'
  | 'Clothing'
  | 'Entertainment'
  | 'Travel'
  | 'Healthcare'
  | 'Other';

export interface LineItem {
  id: string;
  name: string;
  amount: number;
  /** Per-item category. Older line items written before per-item
   *  categorization may be undefined; treat as the receipt's overall
   *  category in that case. */
  category?: Category;
}

export interface Receipt {
  id: string;
  storeName: string;
  date: string;
  totalAmount: number;
  /** Sum before tax. Optional — older receipts didn't capture this. */
  subtotalAmount?: number;
  /** Tax (HST/GST/VAT/sales tax) extracted from the receipt. Optional. */
  taxAmount?: number;
  /** Primary category — the dominant tag, used by the dashboard for
   *  aggregation. Always one of the standard 10 enum values. */
  category: Category;
  /** Multi-select tags for this receipt. Includes the standard category
   *  values AND any custom user / AI-suggested tags ("Pet Food", "Home
   *  Decor", etc.). Old rows fall back to [category] at read time. */
  categoryTags?: string[];
  rawText?: string;
  imageUri?: string;
  notes?: string;
  lineItems?: LineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ParsedReceipt {
  storeName: string;
  date: string;
  totalAmount: number;
  subtotalAmount?: number;
  taxAmount?: number;
  category: Category;
  categoryTags?: string[];
  lineItems: LineItem[];
  rawText: string;
}

export interface CategorySummary {
  category: Category;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlyStats {
  totalSpent: number;
  receiptCount: number;
  topCategory: Category | null;
  avgPerReceipt: number;
  categories: CategorySummary[];
}
