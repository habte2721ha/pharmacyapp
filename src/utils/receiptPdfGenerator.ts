import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Sale, Branch } from '../types';

export interface InstitutionInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tinNumber?: string;
  logoUrl?: string;
}

export interface ReceiptPdfOptions {
  institution?: InstitutionInfo;
  branch?: Branch;
  format?: 'standard' | 'thermal'; // 'standard' = A4, 'thermal' = 80mm receipt roll
  autoDownload?: boolean;
}

/**
 * Generates and optionally downloads an official PDF receipt for a sales transaction.
 */
export async function generateReceiptPdf(
  sale: Sale,
  options?: ReceiptPdfOptions
): Promise<jsPDF> {
  const format = options?.format || 'standard';
  const inst = options?.institution || {
    name: 'Sonan Pharmacy ERP',
    address: 'Bole Medhanialem, Addis Ababa, Ethiopia',
    phone: '+251 911 000 000',
    email: 'info@sonanpharmacy.et',
    tinNumber: '0012345678'
  };

  const branchName = options?.branch?.name || sale.branchName || 'Main Branch';
  const branchAddress = options?.branch?.address || inst.address || '';
  const branchPhone = options?.branch?.phone || inst.phone || '';

  // Generate QR Code data URL
  let qrDataUrl = '';
  try {
    const qrPayload = JSON.stringify({
      inv: sale.invoiceNumber,
      date: sale.date,
      time: sale.time || '',
      total: sale.total,
      vat: sale.vat,
      tin: inst.tinNumber || '0012345678',
      pharmacy: inst.name,
      status: sale.status || 'Completed'
    });
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 120,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.warn('Could not generate receipt QR code', err);
  }

  if (format === 'thermal') {
    return generateThermalReceipt(sale, inst, branchName, branchAddress, branchPhone, qrDataUrl, options?.autoDownload);
  } else {
    return generateA4Receipt(sale, inst, branchName, branchAddress, branchPhone, qrDataUrl, options?.autoDownload);
  }
}

/**
 * Standard A4 Official Tax Invoice & Cash Sales Receipt
 */
async function generateA4Receipt(
  sale: Sale,
  inst: InstitutionInfo,
  branchName: string,
  branchAddress: string,
  branchPhone: string,
  qrDataUrl: string,
  autoDownload: boolean = true
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const isVoided = sale.status === 'Voided' || sale.status === 'Returned';

  // 1. Top Decorative Brand Bar
  doc.setFillColor(5, 150, 105); // emerald-600
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 2. Header Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text((inst.name || 'PHARMACY MANAGEMENT SYSTEM').toUpperCase(), 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Branch: ${branchName} | ${branchAddress}`, 14, 23);
  doc.text(`Phone: ${branchPhone} | Email: ${inst.email || 'support@pharmacy.et'}`, 14, 27.5);
  if (inst.tinNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Pharmacy TIN / Tax ID: ${inst.tinNumber}`, 14, 32);
  }

  // Right Header: Receipt Type & Invoice Number Banner
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(pageWidth - 85, 10, 71, 26, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth - 85, 10, 71, 26, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text('OFFICIAL TAX INVOICE / RECEIPT', pageWidth - 80, 16);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Invoice #:', pageWidth - 80, 22);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.invoiceNumber, pageWidth - 45, 22, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Date & Time:', pageWidth - 80, 27);
  doc.text(`${sale.date} ${sale.time || ''}`, pageWidth - 45, 27, { align: 'right' });

  doc.text('Status:', pageWidth - 80, 32);
  doc.setFont('helvetica', 'bold');
  if (isVoided) {
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(sale.status.toUpperCase(), pageWidth - 45, 32, { align: 'right' });
  } else {
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('PAID / COMPLETED', pageWidth - 45, 32, { align: 'right' });
  }

  // 3. Metadata Grid (Bill To / Dispenser details)
  const metaY = 40;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, metaY, pageWidth - 28, 22, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, metaY, pageWidth - 28, 22, 1.5, 1.5, 'S');

  // Customer Information (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CUSTOMER / PATIENT DETAILS', 18, metaY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(sale.customerName || 'Walk-in Customer / Retail Patient', 18, metaY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Customer TIN: ${sale.customerTin || 'N/A'}`, 18, metaY + 16);

  // Cashier & Payment Route (Right)
  const metaCol2 = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DISPENSER & SETTLEMENT', metaCol2, metaY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Dispensed By: `, metaCol2, metaY + 11);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.cashierName || 'Licensed Pharmacist', metaCol2 + 24, metaY + 11);

  doc.setFont('helvetica', 'normal');
  doc.text(`Payment Route: `, metaCol2, metaY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  const paymentMethodLabel = sale.paymentMethod || 'Cash';
  doc.text(paymentMethodLabel.toUpperCase(), metaCol2 + 25, metaY + 16);

  if (sale.isOnlineOrder || sale.orderSource === 'Online Store') {
    doc.setTextColor(2, 132, 199);
    doc.text('(Online Order)', metaCol2 + 55, metaY + 16);
  }

  // 4. Line Items Table using autoTable
  const tableData = sale.items.map((item, index) => [
    (index + 1).toString(),
    item.medicineName || 'Medicine / Drug Item',
    item.batchNumber || 'N/A',
    item.quantity.toString(),
    `${item.unitPrice.toFixed(2)}`,
    `${(item.unitPrice * item.quantity).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: metaY + 26,
    head: [['#', 'Item / Medicine Description', 'Batch No.', 'Qty', 'Unit Price (ETB)', 'Total Amount (ETB)']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 3
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 32 },
      5: { halign: 'right', cellWidth: 35 }
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  // Get position after table
  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // 5. Summary & Totals Box (Right Side)
  const summaryWidth = 80;
  const summaryX = pageWidth - 14 - summaryWidth;
  let currentSummaryY = finalY;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(summaryX, currentSummaryY, summaryWidth, 42, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryX, currentSummaryY, summaryWidth, 42, 1.5, 1.5, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  // Subtotal
  doc.text('Subtotal:', summaryX + 4, currentSummaryY + 6);
  doc.text(`${sale.subtotal.toFixed(2)} ETB`, summaryX + summaryWidth - 4, currentSummaryY + 6, { align: 'right' });

  // Discount
  if (sale.discount > 0) {
    doc.setTextColor(217, 119, 6);
    doc.text(`Discount:`, summaryX + 4, currentSummaryY + 12);
    doc.text(`-${sale.discount.toFixed(2)} ETB`, summaryX + summaryWidth - 4, currentSummaryY + 12, { align: 'right' });
    currentSummaryY += 6;
  }

  // VAT
  doc.setTextColor(71, 85, 105);
  const vatRate = sale.vatPercent !== undefined ? sale.vatPercent : 15;
  doc.text(`Value Added Tax (VAT ${vatRate}%):`, summaryX + 4, currentSummaryY + 12);
  doc.text(`${sale.vat.toFixed(2)} ETB`, summaryX + summaryWidth - 4, currentSummaryY + 12, { align: 'right' });

  // Divider inside summary
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX + 4, currentSummaryY + 17, summaryX + summaryWidth - 4, currentSummaryY + 17);

  // Grand Total in Large Bold
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.roundedRect(summaryX + 2, currentSummaryY + 19, summaryWidth - 4, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(5, 150, 105);
  doc.text('Grand Total:', summaryX + 5, currentSummaryY + 27);
  doc.text(`${sale.total.toFixed(2)} ETB`, summaryX + summaryWidth - 5, currentSummaryY + 27, { align: 'right' });

  // 6. Left Side of Summary: QR Code & Verification / Notes
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 14, finalY, 32, 32);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('SCAN TO VERIFY INVOICE', 50, finalY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Official digital verification token generated', 50, finalY + 13);
    doc.text(`by Sonan Pharmacy ERP. Authentic receipt.`, 50, finalY + 17);
    doc.text(`Invoice Ref: #${sale.invoiceNumber}`, 50, finalY + 22);
  }

  // 7. Voided Watermark if voided
  if (isVoided) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(52);
    doc.setTextColor(239, 68, 68);
    // Draw diagonal text
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
    doc.text('TRANSACTION VOIDED', pageWidth / 2, 160, { align: 'center', angle: 30 });
    doc.restoreGraphicsState();
  }

  // 8. Footer & Legal Disclaimer
  const footerY = 275;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY, pageWidth - 14, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `Thank you for trusting ${inst.name}! Medicines once dispensed cannot be returned or refunded per EFDA regulations.`,
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  );
  doc.text(
    `Generated on ${new Date().toLocaleString()} | Page 1 of 1 | Sonan Pharmacy Enterprise Management System`,
    pageWidth / 2,
    footerY + 9,
    { align: 'center' }
  );

  if (autoDownload) {
    const filename = `Receipt-${sale.invoiceNumber || 'INV'}-${sale.date}.pdf`;
    doc.save(filename);
  }

  return doc;
}

/**
 * 80mm POS Thermal Receipt Format (Receipt Printer Size)
 */
async function generateThermalReceipt(
  sale: Sale,
  inst: InstitutionInfo,
  branchName: string,
  branchAddress: string,
  branchPhone: string,
  qrDataUrl: string,
  autoDownload: boolean = true
): Promise<jsPDF> {
  // Estimate height based on line items
  const baseHeight = 150;
  const itemHeight = sale.items.length * 8;
  const totalHeight = Math.max(170, baseHeight + itemHeight);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, totalHeight]
  });

  const pageWidth = 80;
  const isVoided = sale.status === 'Voided' || sale.status === 'Returned';
  let y = 8;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text((inst.name || 'SONAN PHARMACY').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(branchName, pageWidth / 2, y, { align: 'center' });
  y += 4;
  if (branchAddress) {
    doc.text(branchAddress, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }
  if (branchPhone) {
    doc.text(`Tel: ${branchPhone}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }
  if (inst.tinNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`TIN: ${inst.tinNumber}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  // Divider
  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(148, 163, 184);
  doc.line(5, y, pageWidth - 5, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CASH SALES RECEIPT', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Invoice: ${sale.invoiceNumber}`, 5, y);
  y += 3.5;
  doc.text(`Date: ${sale.date} ${sale.time || ''}`, 5, y);
  y += 3.5;
  doc.text(`Cashier: ${sale.cashierName || 'Pharmacist'}`, 5, y);
  y += 3.5;
  doc.text(`Customer: ${sale.customerName || 'Walk-in'}`, 5, y);
  if (sale.customerTin) {
    y += 3.5;
    doc.text(`Cust TIN: ${sale.customerTin}`, 5, y);
  }
  y += 3.5;
  doc.text(`Payment: ${(sale.paymentMethod || 'Cash').toUpperCase()}`, 5, y);
  y += 4;

  // Items Table
  const tableData = sale.items.map(item => [
    item.medicineName,
    `${item.quantity}`,
    `${item.unitPrice.toFixed(2)}`,
    `${(item.unitPrice * item.quantity).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fontSize: 7.5,
      fontStyle: 'bold',
      textColor: [15, 23, 42],
      cellPadding: 1
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 32 },
      1: { halign: 'center', cellWidth: 10 },
      2: { halign: 'right', cellWidth: 14 },
      3: { halign: 'right', cellWidth: 14 }
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 1,
      textColor: [30, 41, 59]
    },
    margin: { left: 5, right: 5 }
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // Divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, pageWidth - 5, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  // Totals
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 5, y);
  doc.text(`${sale.subtotal.toFixed(2)} ETB`, pageWidth - 5, y, { align: 'right' });
  y += 3.5;

  if (sale.discount > 0) {
    doc.text('Discount:', 5, y);
    doc.text(`-${sale.discount.toFixed(2)} ETB`, pageWidth - 5, y, { align: 'right' });
    y += 3.5;
  }

  const vatRate = sale.vatPercent !== undefined ? sale.vatPercent : 15;
  doc.text(`VAT (${vatRate}%):`, 5, y);
  doc.text(`${sale.vat.toFixed(2)} ETB`, pageWidth - 5, y, { align: 'right' });
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL:', 5, y);
  doc.text(`${sale.total.toFixed(2)} ETB`, pageWidth - 5, y, { align: 'right' });
  y += 6;

  // QR Code
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', (pageWidth - 22) / 2, y, 22, 22);
    y += 24;
  }

  // Footer Note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Thank you for your visit!', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('Goods once sold cannot be returned.', pageWidth / 2, y, { align: 'center' });

  if (isVoided) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(220, 38, 38);
    doc.text('*** VOIDED ***', pageWidth / 2, y + 6, { align: 'center' });
  }

  if (autoDownload) {
    const filename = `ThermalReceipt-${sale.invoiceNumber || 'INV'}-${sale.date}.pdf`;
    doc.save(filename);
  }

  return doc;
}
