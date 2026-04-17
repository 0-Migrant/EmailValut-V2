import { jsPDF } from 'jspdf';
import { Order, Item, DeliveryMan, Credential } from './types';
import { fmt, fmtDateTime, orderTotal, getPriceInfo } from './utils';

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateOrderPDF(order: Order, items: Item[], dm?: DeliveryMan, showUnitPrice = true) {
  const doc = new jsPDF();
  const logo = await loadLogoBase64();
  const info = getPriceInfo(order);

  // Modern color palette
  const primary = [59, 130, 246]; // Blue-500
  const dark = [15, 23, 42];      // Slate-900
  const green = [34, 197, 94];    // Green
  const orange = [249, 115, 22];  // Orange

  // Top decorative bar
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, 210, 35, 'F');

  // Header - Logo or Company Name & Tagline
  if (logo) {
    doc.addImage(logo, 'PNG', 80, 4, 50, 27);
  } else {
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Instant-Play SHOP', 105, 15, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text('Professional Order Management', 105, 25, { align: 'center' });
  }

  // Invoice title
  doc.setFontSize(12);
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDER INVOICE', 14, 48);

  // Order and Date info (left column)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 80, 100);
  
  let y = 56;
  doc.text('Order Number', 14, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(`#${order.id.slice(-8).toUpperCase()}`, 14, y + 6);
  
  // Date (right column)
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 80, 100);
  doc.text('Date', 130, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(fmtDateTime(order.createdAt), 130, y + 6);

  // Status badge
  y = 68;
  const statusColor = order.status === 'pending' ? orange : order.status === 'waiting' ? primary : green;
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(14, y - 4, 40, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`Status: ${order.status.toUpperCase()}`, 16, y + 1);

  // Customer & Delivery Info
  y = 85;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text('Customer Information', 14, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 80, 100);
  y += 8;
  doc.text(`Customer ID: ${order.customerId || 'Walk-in Customer'}`, 14, y);
  y += 6;
  doc.text(`Delivery Assigned: ${dm?.name || 'Not assigned'}`, 14, y);

  // Items table
  y = 115;
  
  // Table header background
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(14, y - 6, 182, 8, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Item', 20, y);
  doc.text('Qty', showUnitPrice ? 110 : 130, y);
  if (showUnitPrice) doc.text('Unit Price', 135, y);
  doc.text('Amount', showUnitPrice ? 170 : 160, y);

  // Separator line
  doc.setDrawColor(200, 210, 220);
  doc.line(14, y + 2, 196, y + 2);

  // Table rows
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 50, 65);
  
  let rowBg = false;
  order.items.forEach((oi) => {
    const item = items.find(i => i.id === oi.itemId);
    const sub = oi.price * oi.qty;
    
    // Alternating row background
    if (rowBg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 5, 182, 7, 'F');
    }
    rowBg = !rowBg;
    
    doc.text(item?.name || 'Unknown Item', 20, y);
    doc.text(String(oi.qty), showUnitPrice ? 115 : 133, y);
    if (showUnitPrice) doc.text(`$${fmt(oi.price)}`, 135, y);
    doc.text(`$${fmt(sub)}`, showUnitPrice ? 170 : 160, y);
    
    y += 8;
    
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  });

  // Totals section
  y += 5;
  doc.setDrawColor(200, 210, 220);
  doc.line(110, y, 196, y);
  y += 8;

  // Items total
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 100, 120);
  doc.text('Subtotal', 130, y);
  doc.setTextColor(40, 50, 65);
  doc.text(`$${fmt(info.itemsTotal)}`, 170, y);
  y += 7;

  // Discount or surcharge
  if (info.type === 'discount') {
    doc.setTextColor(green[0], green[1], green[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`Discount (-${info.pct}%)`, 130, y);
    doc.text(`-$${fmt(info.saved)}`, 170, y);
    y += 7;
  } else if (info.type === 'surcharge') {
    doc.setTextColor(orange[0], orange[1], orange[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`Premium Surcharge (+${info.pct}%)`, 130, y);
    doc.text(`+$${fmt(info.extra)}`, 170, y);
    y += 7;
  }

  // Grand total
  y += 3;
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.line(110, y, 196, y);
  y += 8;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text('TOTAL DUE', 130, y);
  doc.setFontSize(16);
  doc.text(`$${fmt(orderTotal(order))}`, 170, y);

  // Footer
  y = 280;
  doc.setFontSize(8);
  doc.setTextColor(150, 160, 170);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for your order! We appreciate your business.', 105, y, { align: 'center' });

  doc.save(`Invoice_${order.id.slice(-5)}_${order.customerId || 'Order'}.pdf`);
}

export function generateCredentialsPDF(credentials: Credential[]) {
  const doc = new jsPDF();

  // Colors
  const accent = [24, 95, 165]; // #185fa5

  // Header
  doc.setFontSize(22);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('Vault Business Manager', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('CREDENTIALS EXPORT', 105, 28, { align: 'center' });

  // Summary Box
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(250, 250, 250);
  doc.rect(14, 35, 182, 20, 'F');
  
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Credentials: ${credentials.length}`, 20, 45);
  doc.text(`Exported: ${new Date().toLocaleDateString()}`, 120, 45);

  // Table Header
  let y = 70;
  doc.setFillColor( accent[0], accent[1], accent[2] );
  doc.rect(14, y - 7, 182, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Service', 20, y);
  doc.text('Email/Username', 80, y);
  doc.text('Password', 140, y);

  // Table Body
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  y += 10;

  credentials.forEach((cred) => {
    doc.text(cred.name, 20, y);
    doc.text(cred.email, 80, y);
    doc.text(cred.pass, 140, y); // Show actual password
    y += 10;
    
    // Page break check
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Credentials exported from Vault Business Manager', 105, 285, { align: 'center' });

  doc.save(`Credentials_Export_${new Date().toISOString().slice(0, 10)}.pdf`);
}
