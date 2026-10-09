// An invoice as a PDF (A4 portrait, jsPDF's built-in font, so money is written "INR 1,000.00").
// drawInvoice takes any jsPDF-like doc, so it can be tested with a recorder.
import { formatDate } from './format';
import { pdfText } from './ganttPdf';
import { moneyText } from './timesheets';

const M = 18; // margin, mm
const W = 210;

export const drawInvoice = (doc, inv, { orgName = '' } = {}) => {
  const money = (n) => moneyText(n, inv.currency);
  const right = (text, x, y) => doc.text(pdfText(text), x, y, { align: 'right' });
  let y = 24;

  doc.setFontSize(20);
  doc.text('INVOICE', M, y);
  doc.setFontSize(10);
  right(pdfText(orgName), W - M, y - 6);
  right(`No. ${inv.number}`, W - M, y);
  right(`Date ${formatDate(inv.issuedOn || new Date())}`, W - M, y + 5);

  y += 18;
  doc.setFontSize(9);
  doc.text('BILL TO', M, y);
  doc.text('PROJECT', W / 2, y);
  doc.setFontSize(11);
  doc.text(pdfText(inv.clientName || '-'), M, y + 6);
  doc.text(pdfText(inv.projectName || '-'), W / 2, y + 6);
  doc.setFontSize(9);
  doc.text(pdfText(`Work from ${formatDate(inv.from)} to ${formatDate(inv.to)}`), W / 2, y + 11);

  y += 24;
  doc.setFontSize(9);
  doc.text('DESCRIPTION', M, y);
  right('HOURS', 120, y);
  right('RATE', 155, y);
  right('AMOUNT', W - M, y);
  doc.line(M, y + 2, W - M, y + 2);
  doc.setFontSize(10);
  y += 8;
  for (const line of inv.lines) {
    if (y > 260) { doc.addPage(); y = 24; }
    doc.text(pdfText(`Professional services - ${line.description}`), M, y);
    right(line.hours.toFixed(2), 120, y);
    right(money(line.rate), 155, y);
    right(money(line.amount), W - M, y);
    y += 7;
  }
  doc.line(M, y - 3, W - M, y - 3);
  y += 3;
  right('Subtotal', 155, y); right(money(inv.subtotal), W - M, y);
  y += 6;
  right(`Tax (${inv.taxPercent}%)`, 155, y); right(money(inv.tax), W - M, y);
  y += 7;
  doc.setFontSize(12);
  right('Total', 155, y); right(money(inv.total), W - M, y);

  if (inv.notes) {
    y += 14;
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(pdfText(inv.notes), W - 2 * M), M, y);
  }
  return doc;
};

export const downloadInvoicePdf = async (inv, options) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawInvoice(doc, inv, options);
  doc.save(`${inv.number}.pdf`);
};
