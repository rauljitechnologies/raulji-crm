// backend/services/pdfService.js  — Corporate PDF (table-based layout for Puppeteer compatibility)
'use strict';
const prisma = require('../lib/prisma');

const inr = (n) => '&#8377;' + (+(n || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '&#8212;';

const STATUS_CLR = {
  DRAFT:     '#94a3b8', SENT:      '#3b82f6', ACCEPTED: '#22c55e',
  PAID:      '#22c55e', PARTIAL:   '#f97316', OVERDUE:  '#ef4444',
  CANCELLED: '#94a3b8', CONVERTED: '#8b5cf6', REJECTED: '#ef4444',
};

// ── GST State helpers ──────────────────────────────────────────
const STATE_NAMES = {
   1:'J&K',           2:'Himachal Pradesh', 3:'Punjab',          4:'Chandigarh',
   5:'Uttarakhand',   6:'Haryana',          7:'Delhi',            8:'Rajasthan',
   9:'Uttar Pradesh', 10:'Bihar',           11:'Sikkim',          12:'Arunachal Pradesh',
  13:'Nagaland',      14:'Manipur',         15:'Mizoram',         16:'Tripura',
  17:'Meghalaya',     18:'Assam',           19:'West Bengal',     20:'Jharkhand',
  21:'Odisha',        22:'Chhattisgarh',    23:'Madhya Pradesh',  24:'Gujarat',
  26:'Dadra & NH',    27:'Maharashtra',     29:'Karnataka',       30:'Goa',
  31:'Lakshadweep',   32:'Kerala',          33:'Tamil Nadu',      34:'Puducherry',
  35:'A&N Islands',   36:'Telangana',       37:'Andhra Pradesh',
};

function gstinStateCode(gstin) {
  if (!gstin || gstin.length < 2) return null;
  const code = parseInt(gstin.substring(0, 2), 10);
  return isNaN(code) ? null : code;
}

function buildHtml(data, type) {
  const isInv   = type === 'invoice';
  const docNum  = isInv ? data.invoiceNumber  : data.quotationNumber;
  const docLbl  = isInv ? 'INVOICE'           : 'QUOTATION';
  const co      = data.company    || {};
  const addr    = co.address      || {};
  const coBank  = isInv ? (data.bankDetails || co.bankDetails || {}) : {};
  const sClr    = STATUS_CLR[data.status] || '#94a3b8';

  // ── Determine IGST vs CGST/SGST ───────────────────────────
  const coStateCode     = gstinStateCode(co.gst);
  const clientStateCode = gstinStateCode(data.clientGst);
  // intra-state only when BOTH GSTINs present and state codes match
  const isIntraState    = !!(coStateCode && clientStateCode && coStateCode === clientStateCode);
  const coStateName     = coStateCode     ? (STATE_NAMES[coStateCode]     || '') : '';
  const clientStateName = clientStateCode ? (STATE_NAMES[clientStateCode] || '') : '';
  const taxLabel        = isIntraState ? 'CGST + SGST' : 'IGST';

  // ── Logo cell ─────────────────────────────────────────────
  const logoCell = co.logo
    ? `<img src="${co.logo}" alt="${co.name || ''}"
          style="max-height:64px;max-width:200px;object-fit:contain;display:block"
          onerror="this.style.display='none';document.getElementById('logo-fallback').style.display='table-cell'">`
    : '';
  const fallbackLogo = `<table cellpadding="0" cellspacing="0" style="margin-bottom:4px">
    <tr><td style="width:60px;height:60px;border-radius:12px;background:linear-gradient(135deg,#3199d4,#1f293f);text-align:center;vertical-align:middle;font-size:22px;font-weight:800;color:#fff;font-family:sans-serif;letter-spacing:-1px">
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
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:#64748b;font-family:monospace">${item.hsnCode || '&#8212;'}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#64748b">${item.quantity}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;color:#64748b">${inr(item.unitPrice)}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#64748b">${item.gstPercent || 18}%</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;color:${disc > 0 ? '#ef4444' : '#cbd5e1'}">${disc > 0 ? '-' + inr(disc) : '&#8212;'}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:700;color:#0f172a">${inr(after + gst)}</td>
      </tr>`;
  }).join('');

  // ── HSN-wise tax grouping ──────────────────────────────────
  // Key: hsn__rate  so same HSN with different rates stays separate
  const hsnMap = {};
  (data.items || []).forEach(item => {
    const hsn  = item.hsnCode || '';
    const rate = item.gstPercent || 18;
    const key  = `${hsn}__${rate}`;
    if (!hsnMap[key]) hsnMap[key] = { hsn, desc: item.description || '', rate, taxable: 0, tax: 0 };
    const base = (item.quantity * (item.unitPrice || 0)) - (item.discount || 0);
    hsnMap[key].taxable += base;
    hsnMap[key].tax     += Math.round(base * rate / 100);
  });
  const hsnEntries = Object.values(hsnMap);
  const totalTaxable = hsnEntries.reduce((s, e) => s + e.taxable, 0);
  const totalTax     = hsnEntries.reduce((s, e) => s + e.tax,     0);

  // ── Tfoot GST rows (IGST or CGST+SGST per rate) ───────────
  // Group by rate only for the summary rows in tfoot
  const rateMap = {};
  hsnEntries.forEach(e => {
    rateMap[e.rate] = (rateMap[e.rate] || 0) + e.tax;
  });
  const gstRows = Object.entries(rateMap).map(([rate, taxAmt]) => {
    if (isIntraState) {
      const half = taxAmt / 2;
      return `
        <tr>
          <td colspan="5" style="padding:4px 14px;text-align:right;font-size:12px;color:#64748b">CGST @ ${rate / 2}%</td>
          <td colspan="2" style="padding:4px 14px;text-align:right;font-size:12px;color:#475569">${inr(half)}</td>
        </tr>
        <tr>
          <td colspan="5" style="padding:4px 14px;text-align:right;font-size:12px;color:#64748b">SGST @ ${rate / 2}%</td>
          <td colspan="2" style="padding:4px 14px;text-align:right;font-size:12px;color:#475569">${inr(half)}</td>
        </tr>`;
    } else {
      return `
        <tr>
          <td colspan="5" style="padding:4px 14px;text-align:right;font-size:12px;color:#64748b">IGST @ ${rate}%</td>
          <td colspan="2" style="padding:4px 14px;text-align:right;font-size:12px;color:#475569">${inr(taxAmt)}</td>
        </tr>`;
    }
  }).join('');

  // ── Tax Summary block (HSN-wise) ───────────────────────────
  const taxSummaryBlock = hsnEntries.length > 0 ? (() => {
    if (isIntraState) {
      const hsnRows = hsnEntries.map(e => `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 12px;font-size:12px;color:#1e293b;font-family:monospace;font-weight:600">${e.hsn || '&#8212;'}</td>
          <td style="padding:8px 12px;font-size:12px;color:#475569;max-width:160px">${e.desc}</td>
          <td style="padding:8px 12px;font-size:12px;color:#1e293b;text-align:right">${inr(e.taxable)}</td>
          <td style="padding:8px 12px;font-size:12px;color:#475569;text-align:center">${e.rate}%</td>
          <td style="padding:8px 12px;font-size:12px;color:#475569;text-align:center">${e.rate / 2}%</td>
          <td style="padding:8px 12px;font-size:12px;color:#1e293b;text-align:right">${inr(e.tax / 2)}</td>
          <td style="padding:8px 12px;font-size:12px;color:#475569;text-align:center">${e.rate / 2}%</td>
          <td style="padding:8px 12px;font-size:12px;color:#1e293b;text-align:right">${inr(e.tax / 2)}</td>
          <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#0f172a;text-align:right">${inr(e.tax)}</td>
        </tr>`).join('');
      return `
        <div style="padding:0 40px;margin-top:6px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1f293f;border-bottom:2px solid #3199d4;padding-bottom:6px;margin-bottom:0">Tax Summary — Intra-State (${coStateName || 'Same State'})</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:#f1f8fd">
                <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#1f293f;white-space:nowrap">HSN/SAC</th>
                <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#1f293f">Description</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#1f293f;white-space:nowrap">Taxable Value</th>
                <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#1f293f;white-space:nowrap">GST Rate</th>
                <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#3199d4;white-space:nowrap">CGST %</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#3199d4;white-space:nowrap">CGST Amt</th>
                <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#1f293f;white-space:nowrap">SGST %</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#1f293f;white-space:nowrap">SGST Amt</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#0f172a;white-space:nowrap">Total Tax</th>
              </tr>
            </thead>
            <tbody>${hsnRows}</tbody>
            <tfoot>
              <tr style="background:#e8f4fb;border-top:2px solid #3199d4">
                <td colspan="2" style="padding:8px 12px;font-size:12px;font-weight:700;color:#1f293f">Total</td>
                <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#0f172a;text-align:right">${inr(totalTaxable)}</td>
                <td style="padding:8px 12px"></td>
                <td style="padding:8px 12px"></td>
                <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#3199d4;text-align:right">${inr(totalTax / 2)}</td>
                <td style="padding:8px 12px"></td>
                <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#1f293f;text-align:right">${inr(totalTax / 2)}</td>
                <td style="padding:8px 12px;font-size:12px;font-weight:800;color:#0f172a;text-align:right">${inr(totalTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    } else {
      const hsnRows = hsnEntries.map(e => `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 12px;font-size:12px;color:#1e293b;font-family:monospace;font-weight:600">${e.hsn || '&#8212;'}</td>
          <td style="padding:8px 12px;font-size:12px;color:#475569;max-width:200px">${e.desc}</td>
          <td style="padding:8px 12px;font-size:12px;color:#1e293b;text-align:right">${inr(e.taxable)}</td>
          <td style="padding:8px 12px;font-size:12px;color:#475569;text-align:center">${e.rate}%</td>
          <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#0f172a;text-align:right">${inr(e.tax)}</td>
        </tr>`).join('');
      return `
        <div style="padding:0 40px;margin-top:6px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1f293f;border-bottom:2px solid #3199d4;padding-bottom:6px;margin-bottom:0">Tax Summary — Inter-State IGST${clientStateName ? ' (Supply to ' + clientStateName + ')' : ''}</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:#f1f8fd">
                <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#1f293f;white-space:nowrap">HSN/SAC</th>
                <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#1f293f">Description</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#1f293f;white-space:nowrap">Taxable Value</th>
                <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#3199d4;white-space:nowrap">IGST Rate</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#3199d4;white-space:nowrap">IGST Amount</th>
              </tr>
            </thead>
            <tbody>${hsnRows}</tbody>
            <tfoot>
              <tr style="background:#e8f4fb;border-top:2px solid #3199d4">
                <td colspan="2" style="padding:8px 12px;font-size:12px;font-weight:700;color:#1f293f">Total</td>
                <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#0f172a;text-align:right">${inr(totalTaxable)}</td>
                <td style="padding:8px 12px"></td>
                <td style="padding:8px 12px;font-size:12px;font-weight:800;color:#3199d4;text-align:right">${inr(totalTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    }
  })() : '';

  // ── Paid / Balance rows ───────────────────────────────────
  const paidAmt = isInv ? (data.paidAmount || 0) : 0;
  const balance = Math.max(0, (data.grandTotal || 0) - paidAmt);
  const paidRows = isInv && paidAmt > 0 ? `
    <tr style="background:#f0fdf4">
      <td colspan="5" style="padding:8px 14px;text-align:right;font-size:13px;color:#16a34a;font-weight:600">Amount Paid</td>
      <td colspan="2" style="padding:8px 14px;text-align:right;font-size:13px;color:#16a34a;font-weight:700">${inr(paidAmt)}</td>
    </tr>
    <tr style="background:#fef2f2">
      <td colspan="5" style="padding:8px 14px;text-align:right;font-size:13px;color:#dc2626;font-weight:600">Balance Due</td>
      <td colspan="2" style="padding:8px 14px;text-align:right;font-size:13px;color:#dc2626;font-weight:700">${inr(balance)}</td>
    </tr>` : '';

  // ── Bank details block ────────────────────────────────────
  const bankBlock = isInv && coBank.bankName ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:20px;border-collapse:collapse">
      <tr><td colspan="4" style="padding:0 0 10px 0">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1f293f;border-bottom:2px solid #3199d4;padding-bottom:6px;margin-bottom:4px">Payment Details</div>
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
        <td colspan="3" style="padding:4px 0;font-size:12px;font-weight:600;color:#3199d4">${coBank.upiId}</td>
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
<div style="max-width:794px;margin:0 auto;background:#fff">

<!-- TOP BAR -->
<div style="height:6px;background:linear-gradient(90deg,#3199d4,#1f293f,#3199d4)"></div>

<!-- HEADER TABLE -->
<table cellpadding="0" cellspacing="0" style="width:100%;padding:30px 40px 24px;border-bottom:1px solid #e2e8f0">
  <tr>
    <td style="vertical-align:top;width:50%">
      <!-- Logo -->
      ${co.logo ? logoCell : fallbackLogo}
      <!-- Company -->
      <table cellpadding="0" cellspacing="0" style="margin-top:12px">
        <tr><td style="font-size:17px;font-weight:800;color:#0f172a;padding-bottom:3px">${co.name || ''}</td></tr>
        ${co.gst     ? `<tr><td style="font-size:11px;color:#64748b;padding-bottom:2px">GSTIN: <b>${co.gst}</b>${coStateName ? ' <span style="color:#3199d4">(' + coStateName + ')</span>' : ''}</td></tr>` : ''}
        ${coAddrLine ? `<tr><td style="font-size:11px;color:#64748b;padding-bottom:2px;max-width:220px">${coAddrLine}</td></tr>` : ''}
        ${co.phone   ? `<tr><td style="font-size:11px;color:#64748b;padding-bottom:2px">Tel: ${co.phone}</td></tr>` : ''}
        ${co.email   ? `<tr><td style="font-size:11px;color:#3199d4;padding-bottom:1px">${co.email}</td></tr>` : ''}
        ${co.website ? `<tr><td style="font-size:11px;color:#3199d4">${co.website}</td></tr>` : ''}
      </table>
    </td>
    <td style="vertical-align:top;text-align:right;width:50%">
      <div style="font-size:34px;font-weight:900;color:#3199d4;letter-spacing:-1px;line-height:1">${docLbl}</div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-top:6px">#${docNum}</div>
      <!-- Tax type badge -->
      <div style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:${isIntraState ? '#e8f4fb' : '#fef3c7'};color:${isIntraState ? '#3199d4' : '#d97706'};border:1px solid ${isIntraState ? '#bae0f5' : '#fcd34d'}">
        ${isIntraState ? 'INTRA-STATE &nbsp;&#183;&nbsp; CGST + SGST' : 'INTER-STATE &nbsp;&#183;&nbsp; IGST'}
      </div>
      <div style="display:inline-block;margin-top:6px;margin-left:6px;padding:3px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;background:${sClr}22;color:${sClr};border:1px solid ${sClr}44">
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
      ${data.clientGst     ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">GSTIN: <b>${data.clientGst}</b>${clientStateName ? ' <span style="color:#64748b">(' + clientStateName + ')</span>' : ''}</div>` : ''}
      ${data.clientAddress ? `<div style="font-size:12px;color:#475569;margin-bottom:4px;line-height:1.5">${data.clientAddress}</div>` : ''}
      ${data.clientEmail   ? `<div style="font-size:12px;color:#3199d4;margin-bottom:2px">${data.clientEmail}</div>` : ''}
      ${data.clientPhone   ? `<div style="font-size:12px;color:#475569">${data.clientPhone}</div>` : ''}
    </td>
    <td style="width:6%"></td>
    <!-- FROM -->
    <td style="width:47%;vertical-align:top;background:#e8f4fb;border-radius:12px;padding:16px 18px;border-left:4px solid #3199d4">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#3199d4;margin-bottom:10px">FROM</div>
      <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px">${co.name || ''}</div>
      ${co.gst    ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">GSTIN: ${co.gst}</div>` : ''}
      ${co.phone  ? `<div style="font-size:11px;color:#64748b;margin-bottom:2px">${co.phone}</div>` : ''}
      ${co.email  ? `<div style="font-size:11px;color:#3199d4;margin-bottom:2px">${co.email}</div>` : ''}
      ${coAddrLine? `<div style="font-size:11px;color:#64748b;line-height:1.5">${coAddrLine}</div>` : ''}
    </td>
  </tr>
</table>

<!-- LINE ITEMS -->
<div style="padding:0 40px">
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:linear-gradient(135deg,#3199d4,#1f293f)">
        <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;letter-spacing:0.5px">DESCRIPTION</th>
        <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#fff">HSN/SAC</th>
        <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#fff">QTY</th>
        <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff">RATE</th>
        <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#fff">GST%</th>
        <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff">DISCOUNT</th>
        <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#94a3b8;font-size:13px">No items</td></tr>'}
    </tbody>
    <tfoot>
      <tr style="background:#f8fafc">
        <td colspan="5" style="padding:10px 14px;text-align:right;font-size:13px;color:#64748b;font-weight:500;border-top:2px solid #e2e8f0">Subtotal (Taxable)</td>
        <td colspan="2" style="padding:10px 14px;text-align:right;font-size:13px;color:#1e293b;font-weight:600;border-top:2px solid #e2e8f0">${inr(data.subtotal)}</td>
      </tr>
      ${gstRows}
      ${(data.totalDiscount || 0) > 0 ? `
      <tr style="background:#fff7ed">
        <td colspan="5" style="padding:7px 14px;text-align:right;font-size:13px;color:#ea580c;font-weight:500">Total Discount</td>
        <td colspan="2" style="padding:7px 14px;text-align:right;font-size:13px;color:#ea580c;font-weight:600">-${inr(data.totalDiscount)}</td>
      </tr>` : ''}
      ${paidRows}
      <tr style="background:linear-gradient(135deg,#3199d4,#1f293f)">
        <td colspan="5" style="padding:14px;text-align:right;font-size:15px;font-weight:800;color:#fff">
          ${isInv && paidAmt > 0 && balance > 0 ? 'BALANCE DUE' : 'GRAND TOTAL'}
        </td>
        <td colspan="2" style="padding:14px;text-align:right;font-size:19px;font-weight:900;color:#fff">
          ${inr(isInv && paidAmt > 0 && balance > 0 ? balance : data.grandTotal)}
        </td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- TAX SUMMARY (HSN-wise) -->
${taxSummaryBlock}

<!-- NOTES + TERMS + BANK -->
<table cellpadding="0" cellspacing="0" style="width:100%;padding:22px 40px 0;border-collapse:separate;border-spacing:0">
  <tr>
    <td style="width:50%;vertical-align:top;padding-right:12px">
      ${data.notes ? `
      <div style="background:#fafafa;border-left:4px solid #3199d4;border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:12px">
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
<table cellpadding="0" cellspacing="0" style="width:100%;padding:14px 40px;border-top:1px solid #e2e8f0;margin-top:24px">
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
