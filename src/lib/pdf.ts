import { jsPDF } from 'jspdf';
import { Order, Item, DeliveryMan } from './types';
import { fmt, fmtDateTime, orderTotal, getPriceInfo } from './utils';

export function generateOrderPDF(order: Order, items: Item[], dm?: DeliveryMan) {
  const doc = new jsPDF();
  const info = getPriceInfo(order);

  // Colors
  const accent = [24, 95, 165]; // #185fa5

  // Header
  doc.setFontSize(22);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('Vault Business Manager', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('ORDER INVOICE', 105, 28, { align: 'center' });

  // Order Details Box
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(250, 250, 250);
  doc.rect(14, 35, 182, 35, 'F');
  
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(`Order ID: #${order.id.slice(-8).toUpperCase()}`, 20, 45);
  doc.text(`Date: ${fmtDateTime(order.createdAt)}`, 20, 52);
  doc.text(`Status: ${order.status.toUpperCase()}`, 20, 59);

  doc.text('Customer Info:', 120, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(`Customer ID: ${order.customerId || 'Walk-in'}`, 120, 52);
  doc.text(`Delivery By: ${dm?.name || 'Unknown'}`, 120, 59);

  // Table Header
  let y = 85;
  doc.setFillColor( accent[0], accent[1], accent[2] );
  doc.rect(14, y - 7, 182, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Item Name', 20, y);
  doc.text('Qty', 110, y);
  doc.text('Price', 140, y);
  doc.text('Subtotal', 170, y);

  // Table Body
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  y += 10;
  
  order.items.forEach((oi) => {
    const item = items.find(i => i.id === oi.itemId);
    const sub = oi.price * oi.qty;
    
    doc.text(item?.name || 'Unknown Item', 20, y);
    doc.text(String(oi.qty), 110, y);
    doc.text(`${fmt(oi.price)} $`, 140, y);
    doc.text(`${fmt(sub)} $`, 170, y);
    
    y += 10;
    
    // Page break check
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  // Footer Calculation
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(120, y, 196, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.text('Items Total:', 130, y);
  doc.text(`${fmt(info.itemsTotal)} $ USD`, 170, y);
  y += 10;

  if (info.type === 'discount') {
    doc.setTextColor(34, 197, 94); // Green
    doc.text(`Discount (-${info.pct}%):`, 130, y);
    doc.text(`-${fmt(info.saved)} $ USD`, 170, y);
    y += 10;
  } else if (info.type === 'surcharge') {
    doc.setTextColor(249, 115, 22); // Orange
    doc.text(`Premium Surcharge (+${info.pct}%):`, 130, y);
    doc.text(`+${fmt(info.extra)} $ USD`, 170, y);
    y += 10;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL:', 130, y);
  doc.text(`${fmt(orderTotal(order))} $ USD`, 170, y);

  // Final Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your business!', 105, 285, { align: 'center' });

  doc.save(`Invoice_${order.id.slice(-5)}_${order.customerId || 'Order'}.pdf`);
}
