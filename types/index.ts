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
}

export interface Receipt {
  id: string;
  storeName: string;
  date: string;
  totalAmount: number;
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
