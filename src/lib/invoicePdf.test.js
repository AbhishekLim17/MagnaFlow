import { describe, expect, it } from 'vitest';
import { drawInvoice } from './invoicePdf';

const recorder = () => {
  const texts = [];
  return {
    texts,
    text: (t) => texts.push(Array.isArray(t) ? t.join(' ') : t),
    setFontSize: () => {},
    line: () => {},
    addPage: () => texts.push('--page--'),
    splitTextToSize: (t) => [t],
  };
};

describe('drawInvoice', () => {
  it('writes the number, parties, lines and totals', () => {
    const doc = recorder();
    drawInvoice(doc, {
      number: 'INV-2026-0001', clientName: 'Acme', projectName: 'Website', from: '2026-10-01', to: '2026-10-31',
      currency: 'INR', taxPercent: 18, subtotal: 11500, tax: 2070, total: 13570, notes: 'Pay in 15 days',
      lines: [{ description: 'Ann', hours: 11.5, rate: 1000, amount: 11500 }],
    }, { orgName: 'Magnetar' });
    const all = doc.texts.join('\n');
    expect(all).toContain('No. INV-2026-0001');
    expect(all).toContain('Acme');
    expect(all).toContain('Professional services - Ann');
    expect(all).toContain('11.50');
    expect(all).toContain('INR 13,570.00');
    expect(all).toContain('Tax (18%)');
    expect(all).toContain('Pay in 15 days');
  });

  it('continues on a new page when the lines run long', () => {
    const doc = recorder();
    const lines = Array.from({ length: 40 }, (_, i) => ({ description: `P${i}`, hours: 1, rate: 1, amount: 1 }));
    drawInvoice(doc, { number: 'X', lines, currency: 'INR', taxPercent: 0, subtotal: 40, tax: 0, total: 40 });
    expect(doc.texts).toContain('--page--');
  });
});
