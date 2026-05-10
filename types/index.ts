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
  category: Category;
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
