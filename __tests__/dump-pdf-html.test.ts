import * as fs from 'fs';
import { buildHtmlForPreview } from '../lib/pdfExport';
import { Receipt } from '../types';

test('dump pdf html for preview', () => {
  const receipts: Receipt[] = [
    {
      id: '1',
      storeName: 'Panchvati Supermarket',
      date: '2026-05-11',
      totalAmount: 42.22,
      subtotalAmount: 40.21,
      taxAmount: 2.01,
      category: 'Groceries',
      categoryTags: ['Groceries'],
      rawText: '',
      notes: 'Indian groceries — paid with Mastercard',
      lineItems: [
        { id: 'a', name: 'Bingo Tedhe Meche Masala 80g', amount: 1.49, category: 'Groceries' },
        { id: 'b', name: 'Pvs Calcutta Paan 250g', amount: 5.0, category: 'Groceries' },
        { id: 'c', name: 'Rajnigandha Silver Pearls', amount: 3.99, category: 'Other' },
        { id: 'd', name: 'Pvs Coriander Seeds 200g', amount: 3.49, category: 'Groceries' },
        { id: 'e', name: 'Fresh Roti Jumbo 10pcs', amount: 6.99, category: 'Groceries' },
      ],
      createdAt: '2026-05-11T20:51:00.000Z',
      updatedAt: '2026-05-11T20:51:00.000Z',
    },
    {
      id: '2',
      storeName: 'Shell',
      date: '2026-05-12',
      totalAmount: 58.34,
      subtotalAmount: 51.62,
      taxAmount: 6.72,
      category: 'Gas',
      categoryTags: ['Gas'],
      rawText: '',
      lineItems: [
        { id: 'f', name: 'Premium fuel — 12.4 gal', amount: 58.34, category: 'Gas' },
      ],
      createdAt: '2026-05-12T10:15:00.000Z',
      updatedAt: '2026-05-12T10:15:00.000Z',
    },
    {
      id: '3',
      storeName: 'CVS Pharmacy',
      date: '2026-05-13',
      totalAmount: 27.45,
      subtotalAmount: 25.99,
      taxAmount: 1.46,
      category: 'Pharmacy',
      categoryTags: ['Pharmacy', 'Healthcare'],
      rawText: '',
      lineItems: [
        { id: 'g', name: 'Tylenol Extra Strength', amount: 12.99, category: 'Pharmacy' },
        { id: 'h', name: 'Vitamin D3 1000 IU', amount: 13.0, category: 'Healthcare' },
      ],
      createdAt: '2026-05-13T18:30:00.000Z',
      updatedAt: '2026-05-13T18:30:00.000Z',
    },
  ];
  const html = buildHtmlForPreview({
    receipts,
    startLabel: 'May 11, 2026',
    endLabel: 'May 13, 2026',
  });
  fs.writeFileSync('/tmp/pdf-preview.html', html, 'utf8');
  expect(html.length).toBeGreaterThan(1000);
});
