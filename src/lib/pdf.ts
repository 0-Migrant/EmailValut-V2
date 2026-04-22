import { jsPDF } from 'jspdf';
import { Order, Item, DeliveryMan, Credential } from './types';
import { fmt, fmtDateTime, orderTotal, getPriceInfo, statusLabel } from './utils';

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

export async function generateOrderPDF(order: Order, items: Item[], dm?: DeliveryMan, showUnitPrice = false, showDiscount = true) {
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
  const statusColor = order.status === 'accepted' ? orange : order.status === 'waiting' ? primary : green;
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(14, y - 4, 40, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`Status: ${statusLabel(order.status).toUpperCase()}`, 16, y + 1);

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
  y += 6;
  doc.text(`Payment: ${order.paymentMethod || '-'}${order.paymentDetail ? ` - ${order.paymentDetail}` : ''}`, 14, y);

  // Items table
  y = 122;
  
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
  if (showDiscount) {
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

export async function generateVIPOrderPDF(
  order: Order,
  items: Item[],
  dm?: DeliveryMan,
  showUnitPrice = false,
  showDiscount = true,
  customerImage?: string | null,
) {
  const doc = new jsPDF();
  const logo = await loadLogoBase64();
  const info = getPriceInfo(order);

  // VIP color palette — deep navy + gold
  const navy   = [10,  22,  50];
  const gold   = [180, 140, 60];
  const goldL  = [212, 175, 90];
  const cream  = [255, 250, 235];
  const white  = [255, 255, 255];
  const muted  = [120, 110, 90];

  const W = 210;

  const orn = (x: number, y: number, flip: boolean) => {
    const sx = flip ? -1 : 1;
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(0.6);
    doc.line(x, y, x + sx * 12, y);
    doc.line(x, y, x, y + 12);
    doc.line(x + sx * 6, y, x + sx * 6, y + 6);
    doc.line(x, y + 6, x + sx * 6, y + 6);
  };

  // Full VIP header — first page only
  const setupFirstPage = () => {
    doc.setFillColor(cream[0], cream[1], cream[2]);
    doc.rect(0, 0, W, 297, 'F');
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, W, 50, 'F');
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.rect(0, 50, W, 1.5, 'F');
    orn(14, 55, false);
    orn(196, 55, true);
    orn(14, 283, false);
    orn(196, 283, true);
    if (logo) {
      doc.addImage(logo, 'PNG', W / 2 - 28, 6, 56, 30);
    } else {
      doc.setFontSize(22);
      doc.setTextColor(goldL[0], goldL[1], goldL[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('Instant-Play', W / 2, 22, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 170, 140);
      doc.text('SHOP', W / 2, 30, { align: 'center' });
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(goldL[0], goldL[1], goldL[2]);
    doc.text('*  V I P  I N V O I C E  *', W / 2, 43, { align: 'center' });
    return 75;
  };

  // Minimal continuation page — cream bg, no header repeat
  const setupContinuationPage = () => {
    doc.setFillColor(cream[0], cream[1], cream[2]);
    doc.rect(0, 0, W, 297, 'F');
    orn(14, 283, false);
    orn(196, 283, true);
    // Subtle dotted separator so items continue naturally
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(14, 8, W - 14, 8);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(`#${order.id.slice(-8).toUpperCase()} — continued`, W / 2, 14, { align: 'center' });
    return 20;
  };

  // Footer — rendered once on the last page only
  const drawFooter = () => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text('*  Thank you for being a valued VIP customer. We treasure your loyalty.  *', W / 2, 286, { align: 'center' });
  };

  let contentY = setupFirstPage();
  const hasImage = !!customerImage;

  // ── Customer photo (optional, first page only) ──────────────────────────────
  if (hasImage) {
    const imgX = W - 14 - 35 - 20;
    const imgY = 58;
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.roundedRect(imgX - 2, imgY - 2, 39, 39, 3, 3, 'F');
    doc.addImage(customerImage!, 'JPEG', imgX, imgY, 35, 35);
  }

  // ── Order meta ──────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text('ORDER NUMBER', 14, contentY);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text(`#${order.id.slice(-8).toUpperCase()}`, 14, contentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text('DATE', 14, contentY + 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text(fmtDateTime(order.createdAt), 14, contentY + 22);

  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.roundedRect(14, contentY + 28, 52, 8, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(white[0], white[1], white[2]);
  doc.text(statusLabel(order.status).toUpperCase(), 40, contentY + 33.5, { align: 'center' });

  contentY += 46;

  // ── Divider ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.4);
  doc.line(14, contentY, W - 14, contentY);
  contentY += 8;

  // ── Customer + Worker + Payment + Platform info ──────────────────────────────
  const colW = (W - 28) / 2;

  const infoBlock = (label: string, value: string, x: number, y: number): number => {
    const maxW = colW - 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(navy[0], navy[1], navy[2]);
    const lines = doc.splitTextToSize(value, maxW) as string[];
    const rendered = lines.slice(0, 2);
    rendered.forEach((line, i) => doc.text(line, x, y + 6 + i * 5));
    return rendered.length;
  };

  infoBlock('Customer', order.customerId || 'VIP Guest', 14, contentY);
  infoBlock('Worker', dm?.name || '-', 14 + colW, contentY);
  const payLines = infoBlock('Payment', `${order.paymentMethod || '-'}${order.paymentDetail ? ` - ${order.paymentDetail}` : ''}`, 14, contentY + 16);
  const platLines = order.source ? infoBlock('Platform', order.source, 14 + colW, contentY + 16) : 1;
  const extraLines = Math.max(payLines, platLines) - 1;

  contentY += 34 + extraLines * 5;

  // ── Items table ──────────────────────────────────────────────────────────────
  const drawTableHeader = (y: number) => {
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(0.4);
    doc.line(14, y, W - 14, y);
    y += 7;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text('ITEM', 14, y);
    doc.text('QTY', showUnitPrice ? 110 : 130, y);
    if (showUnitPrice) doc.text('UNIT', 140, y);
    doc.text('AMOUNT', showUnitPrice ? 175 : 165, y, { align: 'right' });
    doc.setDrawColor(goldL[0], goldL[1], goldL[2]);
    doc.setLineWidth(0.3);
    doc.line(14, y + 3, W - 14, y + 3);
    return y + 10;
  };

  contentY = drawTableHeader(contentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let rowAlt = false;
  order.items.forEach((oi) => {
    const item = items.find(i => i.id === oi.itemId);
    const sub = oi.price * oi.qty;

    if (contentY > 262) {
      doc.addPage();
      contentY = setupContinuationPage();
      rowAlt = false;
    }

    if (rowAlt) {
      doc.setFillColor(245, 238, 215);
      doc.rect(14, contentY - 5, W - 28, 7.5, 'F');
    }
    rowAlt = !rowAlt;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text(item?.name || 'Unknown', 14, contentY);
    doc.text(String(oi.qty), showUnitPrice ? 113 : 133, contentY);
    if (showUnitPrice) {
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text(`$${fmt(oi.price)}`, 140, contentY);
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text(`$${fmt(sub)}`, showUnitPrice ? 175 : 165, contentY, { align: 'right' });
    contentY += 8;
  });

  // ── Totals ───────────────────────────────────────────────────────────────────
  // If totals won't fit on the current page, push to a new one
  if (contentY > 230) {
    doc.addPage();
    contentY = setupContinuationPage();
  }

  contentY += 4;
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.4);
  doc.line(110, contentY, W - 14, contentY);
  contentY += 7;

  const totRow = (label: string, val: string, color?: number[]) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(label, 115, contentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(color ?? navy) as [number, number, number]);
    doc.text(val, W - 14, contentY, { align: 'right' });
    contentY += 7;
  };

  totRow('Subtotal', `$${fmt(info.itemsTotal)}`);
  if (showDiscount) {
    if (info.type === 'discount')   totRow(`Discount  -${info.pct}%`, `-$${fmt(info.saved)}`,   [34, 160, 80]);
    if (info.type === 'surcharge')  totRow(`Surcharge +${info.pct}%`, `+$${fmt(info.extra)}`,   [200, 100, 20]);
  }

  contentY += 2;
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.roundedRect(110, contentY - 5, W - 14 - 110, 12, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(goldL[0], goldL[1], goldL[2]);
  doc.text('TOTAL', 115, contentY + 2.5);
  doc.setFontSize(12);
  doc.text(`$${fmt(orderTotal(order))}`, W - 14, contentY + 2.5, { align: 'right' });

  drawFooter();
  doc.save(`VIP_Invoice_${order.id.slice(-5)}_${order.customerId || 'VIP'}.pdf`);
}

export async function generateGoldenOrderPDF(
  order: Order,
  items: Item[],
  dm?: DeliveryMan,
  showUnitPrice = false,
  showDiscount = true,
) {
  const doc = new jsPDF();
  const logo = await loadLogoBase64();
  const info = getPriceInfo(order);

  // Golden palette — white bg, forest green header, amber accents
  const forest = [22, 55, 35];   // deep forest green
  const amber  = [195, 145, 20]; // rich amber gold
  const amberL = [220, 175, 60]; // light amber
  const dark   = [20,  20,  20]; // near-black text
  const muted  = [100, 100, 95]; // neutral grey
  const white  = [255, 255, 255];

  const W = 210;

  // Full header — first page only
  const setupGoldenFirstPage = () => {
    // White background
    doc.setFillColor(white[0], white[1], white[2]);
    doc.rect(0, 0, W, 297, 'F');
    // Forest green header band
    doc.setFillColor(forest[0], forest[1], forest[2]);
    doc.rect(0, 0, W, 48, 'F');
    // Amber rule below header
    doc.setFillColor(amber[0], amber[1], amber[2]);
    doc.rect(0, 48, W, 2, 'F');
    // Logo / title
    if (logo) {
      doc.addImage(logo, 'PNG', W / 2 - 25, 5, 50, 28);
    } else {
      doc.setFontSize(20);
      doc.setTextColor(amberL[0], amberL[1], amberL[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('Instant-Play', W / 2, 22, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 180, 160);
      doc.text('SHOP', W / 2, 30, { align: 'center' });
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(amberL[0], amberL[1], amberL[2]);
    doc.text('*  G O L D E N  I N V O I C E  *', W / 2, 42, { align: 'center' });
    return 62;
  };

  // Continuation page — white bg, no header, just a subtle top rule
  const setupGoldenContinuationPage = () => {
    doc.setFillColor(white[0], white[1], white[2]);
    doc.rect(0, 0, W, 297, 'F');
    doc.setDrawColor(amber[0], amber[1], amber[2]);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(14, 8, W - 14, 8);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(`#${order.id.slice(-8).toUpperCase()} -- continued`, W / 2, 14, { align: 'center' });
    return 20;
  };

  const drawGoldenFooter = () => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(amber[0], amber[1], amber[2]);
    doc.text('*  Golden Invoice -- Thank you for your order.  *', W / 2, 290, { align: 'center' });
  };

  let contentY = setupGoldenFirstPage();

  // ── Order meta ──────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text('ORDER NUMBER', 14, contentY);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(forest[0], forest[1], forest[2]);
  doc.text(`#${order.id.slice(-8).toUpperCase()}`, 14, contentY + 7);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text('DATE', 14, contentY + 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(fmtDateTime(order.createdAt), 14, contentY + 22);

  // Status pill
  doc.setFillColor(forest[0], forest[1], forest[2]);
  doc.roundedRect(14, contentY + 26, 52, 7, 2, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(amberL[0], amberL[1], amberL[2]);
  doc.text(statusLabel(order.status).toUpperCase(), 40, contentY + 31, { align: 'center' });

  contentY += 42;

  // ── Divider ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(amber[0], amber[1], amber[2]);
  doc.setLineWidth(0.5);
  doc.line(14, contentY, W - 14, contentY);
  contentY += 8;

  // ── Info blocks ─────────────────────────────────────────────────────────────
  const colW = (W - 28) / 2;

  const infoBlock = (label: string, value: string, x: number, y: number) => {
    const maxW = colW - 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(dark[0], dark[1], dark[2]);
    const lines = doc.splitTextToSize(value, maxW) as string[];
    const rendered = lines.slice(0, 2);
    rendered.forEach((line, i) => doc.text(line, x, y + 6 + i * 5));
    return rendered.length;
  };

  infoBlock('Customer', order.customerId || 'Guest', 14, contentY);
  infoBlock('Worker', dm?.name || '-', 14 + colW, contentY);
  const payLines  = infoBlock('Payment', `${order.paymentMethod || '-'}${order.paymentDetail ? ` - ${order.paymentDetail}` : ''}`, 14, contentY + 16);
  const platLines = order.source ? infoBlock('Platform', order.source, 14 + colW, contentY + 16) : 1;
  contentY += 34 + (Math.max(payLines, platLines) - 1) * 5;

  // ── Items table ──────────────────────────────────────────────────────────────
  doc.setDrawColor(amber[0], amber[1], amber[2]);
  doc.setLineWidth(0.5);
  doc.line(14, contentY, W - 14, contentY);
  contentY += 7;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(forest[0], forest[1], forest[2]);
  doc.text('ITEM', 14, contentY);
  doc.text('QTY', showUnitPrice ? 110 : 130, contentY);
  if (showUnitPrice) doc.text('UNIT', 140, contentY);
  doc.text('AMOUNT', showUnitPrice ? 175 : 165, contentY, { align: 'right' });
  doc.setDrawColor(amberL[0], amberL[1], amberL[2]);
  doc.setLineWidth(0.3);
  doc.line(14, contentY + 3, W - 14, contentY + 3);
  contentY += 10;

  let rowAlt = false;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  order.items.forEach((oi) => {
    const item = items.find(i => i.id === oi.itemId);
    const sub = oi.price * oi.qty;

    if (contentY > 265) {
      doc.addPage();
      contentY = setupGoldenContinuationPage();
      rowAlt = false;
    }

    if (rowAlt) {
      doc.setFillColor(245, 248, 245);
      doc.rect(14, contentY - 5, W - 28, 7.5, 'F');
    }
    rowAlt = !rowAlt;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text(item?.name || 'Unknown', 14, contentY);
    doc.text(String(oi.qty), showUnitPrice ? 113 : 133, contentY);
    if (showUnitPrice) {
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text(`$${fmt(oi.price)}`, 140, contentY);
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(forest[0], forest[1], forest[2]);
    doc.text(`$${fmt(sub)}`, showUnitPrice ? 175 : 165, contentY, { align: 'right' });
    contentY += 8;
  });

  // ── Totals ───────────────────────────────────────────────────────────────────
  if (contentY > 235) {
    doc.addPage();
    contentY = setupGoldenContinuationPage();
  }

  contentY += 4;
  doc.setDrawColor(amber[0], amber[1], amber[2]);
  doc.setLineWidth(0.4);
  doc.line(110, contentY, W - 14, contentY);
  contentY += 7;

  const totRow = (label: string, val: string, color?: number[]) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(label, 115, contentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(color ?? dark) as [number, number, number]);
    doc.text(val, W - 14, contentY, { align: 'right' });
    contentY += 7;
  };

  totRow('Subtotal', `$${fmt(info.itemsTotal)}`);
  if (showDiscount) {
    if (info.type === 'discount')  totRow(`Discount  -${info.pct}%`, `-$${fmt(info.saved)}`,  [34, 160, 80]);
    if (info.type === 'surcharge') totRow(`Surcharge +${info.pct}%`, `+$${fmt(info.extra)}`, [200, 100, 20]);
  }

  contentY += 2;
  doc.setFillColor(forest[0], forest[1], forest[2]);
  doc.roundedRect(110, contentY - 5, W - 14 - 110, 12, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(amberL[0], amberL[1], amberL[2]);
  doc.text('TOTAL', 115, contentY + 2.5);
  doc.setFontSize(12);
  doc.text(`$${fmt(orderTotal(order))}`, W - 14, contentY + 2.5, { align: 'right' });

  drawGoldenFooter();
  doc.save(`Golden_Invoice_${order.id.slice(-5)}_${order.customerId || 'Order'}.pdf`);
}

export function generateCredentialsPDF(credentials: Credential[]) {
  const doc = new jsPDF();

  // Colors
  const accent = [24, 95, 165]; // #185fa5

  // Header
  doc.setFontSize(22);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('Instant-Play', 105, 20, { align: 'center' });
  
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
  doc.text('Credentials exported from Instant-Play', 105, 285, { align: 'center' });

  doc.save(`Credentials_Export_${new Date().toISOString().slice(0, 10)}.pdf`);
}
