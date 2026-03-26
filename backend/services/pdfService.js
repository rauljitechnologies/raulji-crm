// backend/services/pdfService.js  — Corporate PDF (table-based layout for Puppeteer compatibility)
'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const inr = (n) => '&#8377;' + (+(n || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '&#8212;';

const STATUS_CLR = {
  DRAFT:     '#94a3b8', SENT:      '#3b82f6', ACCEPTED: '#22c55e',
  PAID:      '#22c55e', PARTIAL:   '#f97316', OVERDUE:  '#ef4444',
  CANCELLED: '#94a3b8', CONVERTED: '#8b5cf6', REJECTED: '#ef4444',
};

function buildHtml(data, type) {
  const isInv   = type === 'invoice';
  const docNum  = isInv ? data.invoiceNumber  : data.quotationNumber;
  const docLbl  = isInv ? 'INVOICE'           : 'QUOTATION';
  const co      = data.company    || {};
  const addr    = co.address      || {};
  const coBank  = isInv ? (data.bankDetails || co.bankDetails || {}) : {};
  const sClr    = STATUS_CLR[data.status] || '#94a3b8';

  // ── Logo cell ─────────────────────────────────────────────
  const logoCell = co.logo
    ? `<img src="${co.logo}" alt="${co.name || ''}"
          style="max-height:64px;max-width:200px;object-fit:contain;display:block"
          onerror="this.style.display='none';document.getElementById('logo-fallback').style.display='table-cell'">`
    : '';
  const fallbackLogo = `<table cellpadding="0" cellspacing="0" style="margin-bottom:4px">
    <tr><td style="width:60px;height:60px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);text-align:center;vertical-align:middle;font-size:22px;font-weight:800;color:#fff;font-family:sans-serif;letter-spacing:-1px">
      ${(co.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
    </td></tr></table>`;

  // ── Item rows ─────────────────────────────────────────────
  const rows = (data.items || []).map((item, i) => {
    const base  = item.quantity * (item.unitPrice || 0);
    const disc  = item.discount  || 0;
    const after = base - disc;
    const gst   = Math.round(after * (item.gstPercent || 18) / 100);
    return `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b">${item.description || ''}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#64748b">${item.quantity}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;color:#64748b">${inr(item.unitPrice)}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#64748b">${item.gstPercent || 18}%</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;color:${disc > 0 ? '#ef4444' : '#cbd5e1'}">${disc > 0 ? '-' + inr(disc) : '&#8212;'}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:700;color:#0f172a">${inr(after + gst)}</td>
      </tr>`;
  }).join('');

  // ── GST breakdown ─────────────────────────────────────────
  const gstMap = {};
  (data.items || []).forEach(item => {
    const r    = item.gstPercent || 18;
    const base = (item.quantity * (item.unitPrice || 0)) - (item.discount || 0);
    gstMap[r]  = (gstMap[r] || 0) + Math.round(base * r / 100);
  });
  const gstRows = Object.entries(gstMap).map(([r, a]) =>
    `<tr><td colspan="4" style="padding:5px 14px;text-align:right;font-size:12px;color:#64748b">GST @ ${r}%</td>
     <td colspan="2" style="padding:5px 14px;text-align:right;font-size:12px;color:#475569">${inr(a)}</td></tr>`
  ).join('');

  // ── Paid / Balance rows ───────────────────────────────────
  const paidAmt = isInv ? (data.paidAmount || 0) : 0;
  const balance = Math.max(0, (data.grandTotal || 0) - paidAmt);
  const paidRows = isInv && paidAmt > 0 ? `
    <tr style="background:#f0fdf4">
      <td colspan="4" style="padding:8px 14px;text-align:right;font-size:13px;color:#16a34a;font-weight:600">Amount Paid</td>
      <td colspan="2" style="padding:8px 14px;text-align:right;font-size:13px;color:#16a34a;font-weight:700">${inr(paidAmt)}</td>
    </tr>
    <tr style="background:#fef2f2">
      <td colspan="4" style="padding:8px 14px;text-align:right;font-size:13px;color:#dc2626;font-weight:600">Balance Due</td>
      <td colspan="2" style="padding:8px 14px;text-align:right;font-size:13px;color:#dc2626;font-weight:700">${inr(balance)}</td>
    </tr>` : '';

  // ── Bank details block ────────────────────────────────────
  const bankBlock = isInv && coBank.bankName ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:20px;border-collapse:collapse">
      <tr><td colspan="4" style="padding:0 0 10px 0">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0369a1;border-bottom:2px solid #bae6fd;padding-bottom:6px;margin-bottom:4px">Payment Details</div>
      </td></tr>
      <tr>
        <td style="padding:4px 8px 4px 0;font-size:12px;color:#64748b;width:120px">Bank</td>
        <td style="padding:4px 16px 4px 0;font-size:12px;font-weight:600;color:#0f172a">${coBank.bankName}</td>
        <td style="padding:4px 8px 4px 0;font-size:12px;color:#64748b;width:120px">Account Name</td>
        <td style="padding:4px 0;font-size:12px;font-weight:600;color:#0f172a">${coBank.accountName || ''}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px 4px 0;font-size:12px;color:#64748b">Account No.</td>
        <td style="padding:4px 16px 4px 0;font-size:13px;font-weight:700;color:#0f172a;font-family:monospace">${coBank.accountNumber || ''}</td>
        <td style="padding:4px 8px 4px 0;font-size:12px;color:#64748b">IFSC</td>
        <td style="padding:4px 0;font-size:12px;font-weight:700;color:#0f172a;font-family:monospace">${coBank.ifsc || ''}</td>
      </tr>
      ${coBank.upiId ? `<tr>
        <td style="padding:4px 8px 4px 0;font-size:12px;color:#64748b">UPI ID</td>
        <td colspan="3" style="padding:4px 0;font-size:12px;font-weight:600;color:#4f46e5">${coBank.upiId}</td>
      </tr>` : ''}
    </table>` : '';

  // ── Address lines ─────────────────────────────────────────
  const coAddrLine = [addr.line1, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${docLbl} ${docNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { @page { size: A4; margin: 0; } }
</style>
</head>
<body>
<div style="max-width:794px;margin:0 auto;background:#fff;position:relative;min-height:1123px;padding-bottom:60px">

<!-- TOP BAR -->
<div style="height:6px;background:linear-gradient(90deg,#4f46e5,#7c3aed,#a855f7)"></div>

<!-- HEADER TABLE -->
<table cellpadding="0" cellspacing="0" style="width:100%;padding:30px 40px 24px;border-bottom:1px solid #e2e8f0">
  <tr>
    <td style="vertical-align:top;width:50%">
      <!-- Logo -->
      ${co.logo ? logoCell : fallbackLogo}
      <!-- Company -->
      <table cellpadding="0" cellspacing="0" style="margin-top:12px">
        <tr><td style="font-size:17px;font-weight:800;color:#0f172a;padding-bottom:3px">${co.name || ''}</td></tr>
        ${co.gst     ? `<tr><td style="font-size:11px;color:#64748b;padding-bottom:2px">GSTIN: <b>${co.gst}</b></td></tr>` : ''}
        ${coAddrLine ? `<tr><td style="font-size:11px;color:#64748b;padding-bottom:2px;max-width:220px">${coAddrLine}</td></tr>` : ''}
        ${co.phone   ? `<tr><td style="font-size:11px;color:#64748b;padding-bottom:2px">Tel: ${co.phone}</td></tr>` : ''}
        ${co.email   ? `<tr><td style="font-size:11px;color:#4f46e5;padding-bottom:1px">${co.email}</td></tr>` : ''}
        ${co.website ? `<tr><td style="font-size:11px;color:#4f46e5">${co.website}</td></tr>` : ''}
      </table>
    </td>
    <td style="vertical-align:top;text-align:right;width:50%">
      <div style="font-size:34px;font-weight:900;color:#4f46e5;letter-spacing:-1px;line-height:1">${docLbl}</div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-top:6px">#${docNum}</div>
      <div style="display:inline-block;margin-top:8px;padding:3px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;background:${sClr}22;color:${sClr};border:1px solid ${sClr}44">
        ${data.status || 'DRAFT'}
      </div>
      <table cellpadding="0" cellspacing="0" style="margin-top:14px;margin-left:auto;font-size:12px">
        <tr>
          <td style="color:#94a3b8;padding:3px 12px 3px 0;text-align:right">Date</td>
          <td style="font-weight:600;color:#1e293b">${dt(data.createdAt)}</td>
        </tr>
        ${isInv ? `
        <tr>
          <td style="color:#94a3b8;padding:3px 12px 3px 0;text-align:right">Due Date</td>
          <td style="font-weight:600;color:${data.status === 'OVERDUE' ? '#dc2626' : '#1e293b'}">${dt(data.dueDate)}</td>
        </tr>
        ${data.paymentTerms ? `<tr><td style="color:#94a3b8;padding:3px 12px 3px 0;text-align:right">Terms</td><td style="font-weight:600;color:#1e293b">${data.paymentTerms}</td></tr>` : ''}
        ${data.transactionId ? `<tr><td style="color:#94a3b8;padding:3px 12px 3px 0;text-align:right">Txn Ref</td><td style="font-weight:600;color:#22c55e;font-family:monospace">${data.transactionId}</td></tr>` : ''}
        ` : `
        <tr>
          <td style="color:#94a3b8;padding:3px 12px 3px 0;text-align:right">Valid Until</td>
          <td style="font-weight:600;color:#1e293b">${dt(data.validUntil)}</td>
        </tr>`}
      </table>
    </td>
  </tr>
</table>

<!-- BILL TO / FROM -->
<table cellpadding="0" cellspacing="0" style="width:100%;padding:22px 40px;border-collapse:separate;border-spacing:0">
  <tr>
    <!-- BILL TO -->
    <td style="width:47%;vertical-align:top;background:#f8fafc;border-radius:12px;padding:16px 18px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px">BILL TO</div>
      <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:4px">${data.clientName || ''}</div>
      ${data.clientGst     ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">GSTIN: <b>${data.clientGst}</b></div>` : ''}
      ${data.clientAddress ? `<div style="font-size:12px;color:#475569;margin-bottom:4px;line-height:1.5">${data.clientAddress}</div>` : ''}
      ${data.clientEmail   ? `<div style="font-size:12px;color:#4f46e5;margin-bottom:2px">${data.clientEmail}</div>` : ''}
      ${data.clientPhone   ? `<div style="font-size:12px;color:#475569">${data.clientPhone}</div>` : ''}
    </td>
    <td style="width:6%"></td>
    <!-- FROM -->
    <td style="width:47%;vertical-align:top;background:#eef2ff;border-radius:12px;padding:16px 18px;border-left:4px solid #4f46e5">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4f46e5;margin-bottom:10px">FROM</div>
      <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px">${co.name || ''}</div>
      ${co.gst    ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">GSTIN: ${co.gst}</div>` : ''}
      ${co.phone  ? `<div style="font-size:11px;color:#64748b;margin-bottom:2px">${co.phone}</div>` : ''}
      ${co.email  ? `<div style="font-size:11px;color:#4f46e5;margin-bottom:2px">${co.email}</div>` : ''}
      ${coAddrLine? `<div style="font-size:11px;color:#64748b;line-height:1.5">${coAddrLine}</div>` : ''}
    </td>
  </tr>
</table>

<!-- LINE ITEMS -->
<div style="padding:0 40px">
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">
        <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;letter-spacing:0.5px">DESCRIPTION</th>
        <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#fff">QTY</th>
        <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff">RATE</th>
        <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#fff">GST%</th>
        <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff">DISCOUNT</th>
        <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8;font-size:13px">No items</td></tr>'}
    </tbody>
    <tfoot>
      <tr style="background:#f8fafc">
        <td colspan="4" style="padding:10px 14px;text-align:right;font-size:13px;color:#64748b;font-weight:500;border-top:2px solid #e2e8f0">Subtotal</td>
        <td colspan="2" style="padding:10px 14px;text-align:right;font-size:13px;color:#1e293b;font-weight:600;border-top:2px solid #e2e8f0">${inr(data.subtotal)}</td>
      </tr>
      ${gstRows}
      ${(data.totalDiscount || 0) > 0 ? `
      <tr style="background:#fff7ed">
        <td colspan="4" style="padding:7px 14px;text-align:right;font-size:13px;color:#ea580c;font-weight:500">Total Discount</td>
        <td colspan="2" style="padding:7px 14px;text-align:right;font-size:13px;color:#ea580c;font-weight:600">-${inr(data.totalDiscount)}</td>
      </tr>` : ''}
      ${paidRows}
      <tr style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">
        <td colspan="4" style="padding:14px;text-align:right;font-size:15px;font-weight:800;color:#fff">
          ${isInv && paidAmt > 0 && balance > 0 ? 'BALANCE DUE' : 'GRAND TOTAL'}
        </td>
        <td colspan="2" style="padding:14px;text-align:right;font-size:19px;font-weight:900;color:#fff">
          ${inr(isInv && paidAmt > 0 && balance > 0 ? balance : data.grandTotal)}
        </td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- NOTES + TERMS + BANK -->
<table cellpadding="0" cellspacing="0" style="width:100%;padding:22px 40px 0;border-collapse:separate;border-spacing:0">
  <tr>
    <td style="width:50%;vertical-align:top;padding-right:12px">
      ${data.notes ? `
      <div style="background:#fafafa;border-left:4px solid #4f46e5;border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px">Notes</div>
        <div style="font-size:12px;color:#475569;line-height:1.6">${data.notes}</div>
      </div>` : ''}
    </td>
    <td style="width:50%;vertical-align:top;padding-left:12px">
      ${data.termsConditions ? `
      <div style="background:#fafafa;border-left:4px solid #e2e8f0;border-radius:0 8px 8px 0;padding:12px 14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px">Terms &amp; Conditions</div>
        <div style="font-size:11px;color:#64748b;line-height:1.6">${data.termsConditions}</div>
      </div>` : ''}
    </td>
  </tr>
</table>

<!-- BANK DETAILS -->
${bankBlock ? `<div style="padding:0 40px 20px">${bankBlock}</div>` : ''}

<!-- FOOTER -->
<table cellpadding="0" cellspacing="0" style="width:100%;position:absolute;bottom:0;left:0;right:0;padding:14px 40px;border-top:1px solid #e2e8f0">
  <tr>
    <td style="font-size:11px;color:#94a3b8">Thank you for your business!</td>
    <td style="font-size:11px;color:#94a3b8;text-align:center">${co.name || ''} &#183; Raulji CRM</td>
    <td style="font-size:11px;color:#94a3b8;text-align:right">${docNum}</td>
  </tr>
</table>

</div>
</body>
</html>`;
}

async function generatePdf(html, filename) {
  try {
    const htmlPdf = require('html-pdf-node');
    const buffer  = await htmlPdf.generatePdf({ content: html }, {
      format: 'A4', printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });
    return { buffer, html };
  } catch {
    return { buffer: null, html };
  }
}

const CO_SELECT = { name:true, logo:true, gst:true, phone:true, email:true, website:true, address:true, bankDetails:true };

exports.generateQuotationPdf = async (quotationId) => {
  const qt = await prisma.quotation.findUnique({ where: { quotationId }, include: { company: { select: CO_SELECT } } });
  if (!qt) throw new Error('Quotation not found');
  return generatePdf(buildHtml(qt, 'quotation'), `QT_${qt.quotationNumber}.pdf`);
};

exports.generateInvoicePdf = async (invoiceId) => {
  const inv = await prisma.invoice.findUnique({ where: { invoiceId }, include: { company: { select: CO_SELECT } } });
  if (!inv) throw new Error('Invoice not found');
  return generatePdf(buildHtml(inv, 'invoice'), `INV_${inv.invoiceNumber}.pdf`);
};

exports.buildQuotationHtml = async (quotationId) => {
  const qt = await prisma.quotation.findUnique({ where: { quotationId }, include: { company: { select: CO_SELECT } } });
  if (!qt) throw new Error('Not found');
  return buildHtml(qt, 'quotation');
};

exports.buildInvoiceHtml = async (invoiceId) => {
  const inv = await prisma.invoice.findUnique({ where: { invoiceId }, include: { company: { select: CO_SELECT } } });
  if (!inv) throw new Error('Not found');
  return buildHtml(inv, 'invoice');
};
