// backend/services/pdfService.js
// Generates professional corporate PDF using html-pdf-node (lightweight)
// Falls back to HTML string if pdf generation fails

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path   = require('path');
const fs     = require('fs');

// ── Corporate PDF HTML Template ──────────────────────────────────────────────
function buildHtml(data, type) {
  const isInvoice = type === 'invoice';
  const docNumber = isInvoice ? data.invoiceNumber : data.quotationNumber;
  const docLabel  = isInvoice ? 'INVOICE' : 'QUOTATION';
  const co        = data.company || {};
  const addr      = co.address  || {};

  // Logo: use image tag if URL exists, else text initials box
  const logoHtml = co.logo
    ? `<img src="${co.logo}" style="height:56px;max-width:180px;object-fit:contain" />`
    : `<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;letter-spacing:-1px">${(co.name||'C').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>`;

  // Line items rows
  const itemRows = (data.items || []).map((item, i) => `
    <tr style="background:${i%2===0?'#fff':'#f8fafc'}">
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b">${item.description || ''}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#475569">${item.quantity}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;color:#475569">₹${(item.unitPrice||0).toLocaleString('en-IN')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#475569">${item.gstPercent||18}%</td>
      ${(item.discount||0)>0
        ? `<td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;color:#ef4444">-₹${(item.discount||0).toLocaleString('en-IN')}</td>`
        : `<td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;color:#94a3b8">—</td>`}
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:600;color:#1e293b">₹${(item.total||0).toLocaleString('en-IN')}</td>
    </tr>`).join('');

  // Status badge colour
  const statusColors = { DRAFT:'#94a3b8', SENT:'#3b82f6', ACCEPTED:'#22c55e', PAID:'#22c55e', PARTIAL:'#f97316', OVERDUE:'#ef4444', CANCELLED:'#ef4444', CONVERTED:'#8b5cf6', REJECTED:'#ef4444' };
  const statusColor  = statusColors[data.status] || '#94a3b8';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${docLabel} ${docNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;font-size:13px;line-height:1.5;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style>
</head>
<body>
<div style="max-width:794px;margin:0 auto;padding:40px 48px;background:#fff;min-height:1123px;position:relative;">

  <!-- TOP ACCENT BAR -->
  <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#4f46e5,#7c3aed,#a855f7)"></div>

  <!-- HEADER -->
  <table style="width:100%;margin-top:16px;margin-bottom:32px;">
    <tr>
      <td style="vertical-align:top;width:50%">
        ${logoHtml}
        <div style="margin-top:12px">
          <div style="font-size:16px;font-weight:700;color:#0f172a">${co.name || 'Company Name'}</div>
          ${co.gst ? `<div style="font-size:11px;color:#64748b;margin-top:2px">GSTIN: ${co.gst}</div>` : ''}
          <div style="font-size:11px;color:#64748b;margin-top:2px">${[addr.line1, addr.city, addr.state].filter(Boolean).join(', ')}</div>
          ${addr.pincode ? `<div style="font-size:11px;color:#64748b">${addr.pincode}</div>` : ''}
          ${co.phone   ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${co.phone}</div>` : ''}
          ${co.email   ? `<div style="font-size:11px;color:#4f46e5">${co.email}</div>` : ''}
          ${co.website ? `<div style="font-size:11px;color:#4f46e5">${co.website}</div>` : ''}
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;width:50%">
        <div style="font-size:28px;font-weight:800;color:#4f46e5;letter-spacing:-0.5px">${docLabel}</div>
        <div style="font-size:14px;font-weight:600;color:#1e293b;margin-top:4px">#${docNumber}</div>
        <div style="margin-top:12px;display:inline-block;background:${statusColor}18;border:1px solid ${statusColor}44;border-radius:6px;padding:3px 12px">
          <span style="font-size:11px;font-weight:700;color:${statusColor};letter-spacing:0.5px">${data.status || 'DRAFT'}</span>
        </div>
        <table style="margin-top:16px;margin-left:auto;font-size:12px">
          <tr><td style="color:#64748b;padding:2px 0;text-align:right">Date:</td><td style="font-weight:600;color:#1e293b;padding:2px 0 2px 16px">${new Date(data.createdAt||Date.now()).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td></tr>
          ${isInvoice
            ? `<tr><td style="color:#64748b;padding:2px 0;text-align:right">Due Date:</td><td style="font-weight:600;color:${data.status==='OVERDUE'?'#ef4444':'#1e293b'};padding:2px 0 2px 16px">${data.dueDate ? new Date(data.dueDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : 'Net 30'}</td></tr>
               ${data.paymentTerms?`<tr><td style="color:#64748b;padding:2px 0;text-align:right">Terms:</td><td style="font-weight:600;color:#1e293b;padding:2px 0 2px 16px">${data.paymentTerms}</td></tr>`:''}
               ${data.transactionId?`<tr><td style="color:#64748b;padding:2px 0;text-align:right">Txn ID:</td><td style="font-weight:600;color:#22c55e;padding:2px 0 2px 16px">${data.transactionId}</td></tr>`:''}
              `
            : `<tr><td style="color:#64748b;padding:2px 0;text-align:right">Valid Until:</td><td style="font-weight:600;color:#1e293b;padding:2px 0 2px 16px">${data.validUntil ? new Date(data.validUntil).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '30 days'}</td></tr>`
          }
        </table>
      </td>
    </tr>
  </table>

  <!-- BILL TO / FROM -->
  <table style="width:100%;margin-bottom:28px;">
    <tr>
      <td style="width:48%;vertical-align:top;background:#f8fafc;border-radius:10px;padding:16px 18px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Bill To</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a">${data.clientName || ''}</div>
        ${data.clientGst     ? `<div style="font-size:11px;color:#64748b;margin-top:2px">GSTIN: ${data.clientGst}</div>` : ''}
        ${data.clientAddress ? `<div style="font-size:12px;color:#475569;margin-top:4px">${data.clientAddress}</div>` : ''}
        ${data.clientEmail   ? `<div style="font-size:12px;color:#4f46e5;margin-top:4px">${data.clientEmail}</div>` : ''}
        ${data.clientPhone   ? `<div style="font-size:12px;color:#475569">${data.clientPhone}</div>` : ''}
      </td>
      <td style="width:4%"></td>
      ${isInvoice && data.bankDetails ? `
      <td style="width:48%;vertical-align:top;background:#eff6ff;border-radius:10px;padding:16px 18px;border-left:3px solid #4f46e5">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Bank Details</div>
        <div style="font-size:12px;color:#1e293b"><b>${data.bankDetails.bankName||''}</b></div>
        <div style="font-size:12px;color:#475569;margin-top:3px">A/C: ${data.bankDetails.accountNumber||''}</div>
        <div style="font-size:12px;color:#475569">IFSC: ${data.bankDetails.ifsc||''}</div>
        <div style="font-size:12px;color:#475569">Name: ${data.bankDetails.accountName||''}</div>
        ${data.bankDetails.upiId ? `<div style="font-size:12px;color:#4f46e5;margin-top:4px">UPI: ${data.bankDetails.upiId}</div>` : ''}
      </td>` : `<td style="width:48%"></td>`}
    </tr>
  </table>

  <!-- LINE ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">
        <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:600;color:#fff;border-radius:8px 0 0 0">Description</th>
        <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:600;color:#fff;white-space:nowrap">Qty</th>
        <th style="padding:11px 14px;text-align:right;font-size:11px;font-weight:600;color:#fff;white-space:nowrap">Rate</th>
        <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:600;color:#fff;white-space:nowrap">GST%</th>
        <th style="padding:11px 14px;text-align:right;font-size:11px;font-weight:600;color:#fff;white-space:nowrap">Discount</th>
        <th style="padding:11px 14px;text-align:right;font-size:11px;font-weight:600;color:#fff;border-radius:0 8px 0 0;white-space:nowrap">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TOTALS -->
  <table style="width:100%;margin-bottom:28px;">
    <tr>
      <td style="width:55%;vertical-align:top;padding-right:24px">
        ${data.notes ? `
        <div style="background:#fafafa;border-left:3px solid #4f46e5;border-radius:0 8px 8px 0;padding:12px 14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px">Notes</div>
          <div style="font-size:12px;color:#475569;line-height:1.6">${data.notes}</div>
        </div>` : ''}
        ${data.termsConditions ? `
        <div style="background:#fafafa;border-left:3px solid #94a3b8;border-radius:0 8px 8px 0;padding:12px 14px;margin-top:10px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px">Terms & Conditions</div>
          <div style="font-size:11px;color:#64748b;line-height:1.6">${data.termsConditions}</div>
        </div>` : ''}
      </td>
      <td style="width:45%;vertical-align:top">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:7px 14px;font-size:12px;color:#475569">Subtotal</td>
            <td style="padding:7px 14px;font-size:12px;text-align:right;font-weight:500;color:#1e293b">₹${(data.subtotal||0).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding:7px 14px;font-size:12px;color:#475569">GST</td>
            <td style="padding:7px 14px;font-size:12px;text-align:right;font-weight:500;color:#1e293b">₹${(data.totalGst||0).toLocaleString('en-IN')}</td>
          </tr>
          ${(data.totalDiscount||0)>0 ? `
          <tr>
            <td style="padding:7px 14px;font-size:12px;color:#ef4444">Discount</td>
            <td style="padding:7px 14px;font-size:12px;text-align:right;font-weight:500;color:#ef4444">-₹${data.totalDiscount.toLocaleString('en-IN')}</td>
          </tr>` : ''}
          ${isInvoice && (data.paidAmount||0)>0 ? `
          <tr style="background:#f0fdf4">
            <td style="padding:7px 14px;font-size:12px;color:#22c55e">Amount Paid</td>
            <td style="padding:7px 14px;font-size:12px;text-align:right;font-weight:600;color:#22c55e">₹${(data.paidAmount||0).toLocaleString('en-IN')}</td>
          </tr>
          <tr style="background:#fef2f2">
            <td style="padding:7px 14px;font-size:12px;color:#ef4444">Balance Due</td>
            <td style="padding:7px 14px;font-size:12px;text-align:right;font-weight:700;color:#ef4444">₹${Math.max(0,(data.grandTotal||0)-(data.paidAmount||0)).toLocaleString('en-IN')}</td>
          </tr>` : ''}
          <tr style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:8px">
            <td style="padding:12px 14px;font-size:14px;font-weight:700;color:#fff;border-radius:8px 0 0 8px">Grand Total</td>
            <td style="padding:12px 14px;font-size:16px;font-weight:800;text-align:right;color:#fff;border-radius:0 8px 8px 0">₹${(data.grandTotal||0).toLocaleString('en-IN')}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- PAYMENT LINK (Invoice only) -->
  ${isInvoice && data.paymentLink ? `
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:24px;text-align:center">
    <div style="font-size:12px;color:#1d4ed8;font-weight:600;margin-bottom:4px">💳 Pay Online</div>
    <div style="font-size:13px"><a href="${data.paymentLink}" style="color:#4f46e5;font-weight:700">${data.paymentLink}</a></div>
  </div>` : ''}

  <!-- FOOTER -->
  <div style="position:absolute;bottom:32px;left:48px;right:48px;border-top:1px solid #e2e8f0;padding-top:16px">
    <table style="width:100%">
      <tr>
        <td style="font-size:11px;color:#94a3b8">Thank you for your business!</td>
        <td style="font-size:11px;color:#94a3b8;text-align:center">${co.name || ''} · Generated by Raulji CRM</td>
        <td style="font-size:11px;color:#94a3b8;text-align:right">${docNumber}</td>
      </tr>
    </table>
  </div>

</div>
</body>
</html>`;
}

// ── Generate PDF (uses html-pdf-node if installed, else saves HTML) ──────────
async function generatePdf(html, filename) {
  // Try html-pdf-node first
  try {
    const htmlPdf = require('html-pdf-node');
    const file    = { content: html };
    const opts    = {
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
    };
    const pdfBuffer = await htmlPdf.generatePdf(file, opts);

    // Save to /tmp
    const tmpPath = path.join('/tmp', filename.replace(/\//g, '_'));
    fs.writeFileSync(tmpPath, pdfBuffer);
    return { buffer: pdfBuffer, path: tmpPath, html };
  } catch (e) {
    // html-pdf-node not installed — return HTML only
    console.warn('[PDF] html-pdf-node not available, returning HTML:', e.message);
    return { buffer: null, html };
  }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
exports.generateQuotationPdf = async (quotationId) => {
  const qt = await prisma.quotation.findUnique({
    where: { quotationId },
    include: { company: { select: { name:true, logo:true, gst:true, address:true, phone:true, email:true, website:true } } }
  });
  if (!qt) throw new Error('Quotation not found');
  const html = buildHtml(qt, 'quotation');
  return await generatePdf(html, `quotation_${qt.quotationNumber}.pdf`);
};

exports.generateInvoicePdf = async (invoiceId) => {
  const inv = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: { company: { select: { name:true, logo:true, gst:true, address:true, phone:true, email:true, website:true } } }
  });
  if (!inv) throw new Error('Invoice not found');
  const html = buildHtml(inv, 'invoice');
  return await generatePdf(html, `invoice_${inv.invoiceNumber}.pdf`);
};

exports.buildQuotationHtml = async (quotationId) => {
  const qt = await prisma.quotation.findUnique({
    where: { quotationId },
    include: { company: { select: { name:true, logo:true, gst:true, address:true, phone:true, email:true } } }
  });
  if (!qt) throw new Error('Quotation not found');
  return buildHtml(qt, 'quotation');
};

exports.buildInvoiceHtml = async (invoiceId) => {
  const inv = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: { company: { select: { name:true, logo:true, gst:true, address:true, phone:true, email:true } } }
  });
  if (!inv) throw new Error('Invoice not found');
  return buildHtml(inv, 'invoice');
};
