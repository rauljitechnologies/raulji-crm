// backend/services/payslipService.js — Salary slip document (A4, print/PDF ready)
'use strict';
const prisma = require('../lib/prisma');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '&#8377; ' + (+(n || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt  = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '&#8212;';
// Dash out a zero so the slip reads like the printed original ("--" for nil heads)
const amt = (n) => (+(n || 0) === 0 ? '&#8212;' : inr(n));
// Escaped value, or an em-dash when empty. The dash is markup, so it must not
// be fed through esc() — that would print the entity literally.
const or  = (v) => (v === null || v === undefined || String(v).trim() === '' ? '&#8212;' : esc(v));

// ── Amount in words (Indian numbering: crore / lakh / thousand) ──
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
              'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function wordsBelowThousand(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? ONES[h] + ' Hundred' : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}
function amountInWords(value) {
  const total   = Math.round(Math.abs(+value || 0) * 100);
  const rupees  = Math.floor(total / 100);
  const paise   = total % 100;
  const build = (n) => {
    if (n === 0) return 'Zero';
    const parts = [];
    const units = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']];
    let rest = n;
    for (const [div, label] of units) {
      const q = Math.floor(rest / div);
      if (q) { parts.push(`${build(q)} ${label}`); rest %= div; }
    }
    if (rest) parts.push(wordsBelowThousand(rest));
    return parts.join(' ');
  };
  const sign = (+value || 0) < 0 ? 'Minus ' : '';
  return `${sign}${build(rupees)}${paise ? ' and ' + twoDigits(paise) + ' Paise' : ''} Only`;
}

const STATUS_CLR = { DRAFT: '#94a3b8', PUBLISHED: '#3199d4', PAID: '#22c55e' };

function buildHtml(slip) {
  const co    = slip.company || {};
  const addr  = co.address   || {};
  const bank  = slip.employee ? {
    bankName: slip.employee.bankName, accountNumber: slip.employee.accountNumber, ifsc: slip.employee.ifsc, uanNo: slip.employee.uanNo,
  } : {};

  const period  = `${MONTHS[(slip.month || 1) - 1]} ${slip.year}`;
  const sClr    = STATUS_CLR[slip.status] || '#94a3b8';
  const extraE  = Array.isArray(slip.extraEarnings)   ? slip.extraEarnings   : [];
  const extraD  = Array.isArray(slip.extraDeductions) ? slip.extraDeductions : [];

  const coAddrLine = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  // Escape each part first — the separator is markup and must survive
  const coContact  = [co.phone && `Tel: ${co.phone}`, co.email, co.website].filter(Boolean).map(esc).join('  &#183;  ');

  const logoBlock = co.logo
    ? `<img src="${esc(co.logo)}" alt="${esc(co.name || '')}" style="max-height:58px;max-width:190px;object-fit:contain;display:block">`
    : `<table cellpadding="0" cellspacing="0"><tr>
         <td style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#3199d4,#1f293f);text-align:center;vertical-align:middle;font-size:21px;font-weight:800;color:#fff;font-family:sans-serif;letter-spacing:-1px">
           ${esc((co.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}
         </td></tr></table>`;

  // ── Earnings / deductions rows, padded so both columns line up ──
  const earnRows = [
    ['Basic',            slip.basic],
    ['House Rent Allowance', slip.hra],
    ['Other Allowance',  slip.otherAllowance],
    ...extraE.map(l => [l.label, l.amount]),
  ];
  const dedRows = [
    ['Income Tax',            slip.incomeTax],
    ['Provident Fund',        slip.providentFund],
    ['Professional Tax (P.T)', slip.professionalTax],
    ['Other Deduction',       slip.otherDeduction],
    ...extraD.map(l => [l.label, l.amount]),
  ];
  const rowCount = Math.max(earnRows.length, dedRows.length);

  const cell = (row, align) => row
    ? `<td style="padding:9px 14px;font-size:12.5px;color:#1e293b;border-bottom:1px solid #f1f5f9">${esc(row[0])}</td>
       <td style="padding:9px 14px;font-size:12.5px;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;white-space:nowrap">${amt(row[1])}</td>`
    : `<td style="padding:9px 14px;border-bottom:1px solid #f1f5f9"></td><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9"></td>`;

  const bodyRows = Array.from({ length: rowCount }, (_, i) => `
    <tr>
      ${cell(earnRows[i])}
      ${cell(dedRows[i])}
    </tr>`).join('');

  const meta = (label, value) => `
    <tr>
      <td style="padding:5px 0;font-size:11.5px;color:#64748b;white-space:nowrap">${label}</td>
      <td style="padding:5px 8px;font-size:11.5px;color:#64748b">:</td>
      <td style="padding:5px 0;font-size:12px;color:#0f172a;font-weight:600">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Payslip ${esc(slip.empCode)} &#183; ${esc(period)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { @page { size: A4; margin: 0; } }
</style>
</head>
<body>
<div style="max-width:794px;margin:0 auto;background:#fff;padding-bottom:10mm">

<!-- TOP BAR -->
<div style="height:6px;background:linear-gradient(90deg,#3199d4,#1f293f,#3199d4)"></div>

<!-- COMPANY HEADER: logo + address -->
<table cellpadding="0" cellspacing="0" style="width:100%;padding:26px 40px 20px;border-bottom:1px solid #e2e8f0">
  <tr>
    <td style="vertical-align:top;width:58%">
      ${logoBlock}
      <div style="font-size:16px;font-weight:800;color:#0f172a;margin-top:10px">${esc(co.name || '')}</div>
      ${coAddrLine ? `<div style="font-size:11px;color:#64748b;margin-top:3px;max-width:330px;line-height:1.5">${esc(coAddrLine)}</div>` : ''}
      ${coContact  ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${coContact}</div>` : ''}
      ${co.gst     ? `<div style="font-size:11px;color:#64748b;margin-top:3px">GSTIN: <b>${esc(co.gst)}</b></div>` : ''}
    </td>
    <td style="vertical-align:top;text-align:right;width:42%">
      <div style="font-size:27px;font-weight:900;color:#3199d4;letter-spacing:-0.5px;line-height:1">PAYSLIP</div>
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:6px">${esc(period)}</div>
      <div style="display:inline-block;margin-top:8px;padding:3px 14px;border-radius:20px;font-size:10.5px;font-weight:700;letter-spacing:0.5px;background:${sClr}22;color:${sClr};border:1px solid ${sClr}55">
        ${esc(slip.status || 'DRAFT')}
      </div>
    </td>
  </tr>
</table>

<!-- EMPLOYEE SUMMARY -->
<table cellpadding="0" cellspacing="0" style="width:100%;padding:18px 40px 4px">
  <tr>
    <td style="vertical-align:top;width:50%">
      <table cellpadding="0" cellspacing="0" style="width:100%">
        ${meta('Employee ID',  esc(slip.empCode))}
        ${meta('Pay Period',   esc(period))}
        ${meta('Pay Date',     dt(slip.paidOn))}
        ${meta('Paid Days',    esc(slip.paidDays))}
        ${meta('Working Days', esc(slip.workingDays))}
        ${meta('Pan No',       or(slip.panNo))}
      </table>
    </td>
    <td style="vertical-align:top;width:50%;padding-left:20px">
      <table cellpadding="0" cellspacing="0" style="width:100%">
        ${meta('Employee Name',   esc(slip.employeeName))}
        ${meta('Designation',     or(slip.designation))}
        ${meta('Date of Joining', dt(slip.dateOfJoining))}
        ${meta('Gender',          or(slip.gender))}
        ${bank.uanNo ? meta('UAN No', esc(bank.uanNo)) : ''}
      </table>
    </td>
  </tr>
</table>

<!-- NET PAY HIGHLIGHT -->
<div style="padding:14px 40px 0">
  <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #bae0f5;border-radius:10px;background:#f1f8fd">
    <tr>
      <td style="padding:14px 18px">
        <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#3199d4">Total Net Payable</div>
        <div style="font-size:25px;font-weight:900;color:#0f172a;margin-top:2px">${inr(slip.netPayable)}</div>
        <div style="font-size:10.5px;color:#64748b;margin-top:2px">Gross Earnings &#8722; Total Deductions</div>
      </td>
      <td style="padding:14px 18px;text-align:right;vertical-align:middle">
        <div style="font-size:11px;color:#64748b">Paid Days</div>
        <div style="font-size:19px;font-weight:800;color:#1e293b">${esc(slip.paidDays)}<span style="font-size:12px;color:#94a3b8;font-weight:600"> / ${esc(slip.workingDays)}</span></div>
      </td>
    </tr>
  </table>
</div>

<!-- EARNINGS / DEDUCTIONS -->
<div style="padding:16px 40px 0">
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">
    <thead>
      <tr style="background:#1f293f">
        <th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.8px;width:32%">Earnings</th>
        <th style="padding:10px 14px;text-align:right;font-size:10.5px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.8px;width:18%">Amount</th>
        <th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.8px;width:32%;border-left:1px solid #3a4a63">Deductions</th>
        <th style="padding:10px 14px;text-align:right;font-size:10.5px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.8px;width:18%">Amount</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr style="background:#f8fafc">
        <td style="padding:11px 14px;font-size:12.5px;font-weight:800;color:#1f293f;border-top:2px solid #3199d4">Gross Earnings</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:800;color:#0f172a;text-align:right;border-top:2px solid #3199d4;white-space:nowrap">${inr(slip.grossEarnings)}</td>
        <td style="padding:11px 14px;font-size:12.5px;font-weight:800;color:#1f293f;border-top:2px solid #3199d4;border-left:1px solid #e2e8f0">Total Deductions</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:800;color:#dc2626;text-align:right;border-top:2px solid #3199d4;white-space:nowrap">${inr(slip.totalDeductions)}</td>
      </tr>
      <tr style="background:#e8f4fb">
        <td colspan="3" style="padding:12px 14px;font-size:13px;font-weight:800;color:#1f293f;text-transform:uppercase;letter-spacing:0.5px">Total Net Payable</td>
        <td style="padding:12px 14px;font-size:15px;font-weight:900;color:#0f172a;text-align:right;white-space:nowrap">${inr(slip.netPayable)}</td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top:10px;padding:9px 14px;background:#f8fafc;border-left:3px solid #3199d4;font-size:11.5px;color:#334155">
    <b style="color:#1f293f">Amount in words:</b> ${esc(amountInWords(slip.netPayable))}
  </div>
</div>

${bank.accountNumber || bank.bankName ? `
<!-- PAYMENT DETAILS -->
<div style="padding:16px 40px 0">
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1f293f;border-bottom:2px solid #3199d4;padding-bottom:6px;margin-bottom:6px">Payment Details</div>
  <table cellpadding="0" cellspacing="0" style="width:100%">
    <tr>
      <td style="padding:4px 8px 4px 0;font-size:11.5px;color:#64748b;width:110px">Bank</td>
      <td style="padding:4px 16px 4px 0;font-size:11.5px;font-weight:600;color:#0f172a">${or(bank.bankName)}</td>
      <td style="padding:4px 8px 4px 0;font-size:11.5px;color:#64748b;width:110px">A/c No.</td>
      <td style="padding:4px 0;font-size:11.5px;font-weight:700;color:#0f172a;font-family:monospace">${or(bank.accountNumber)}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px 4px 0;font-size:11.5px;color:#64748b">IFSC</td>
      <td style="padding:4px 16px 4px 0;font-size:11.5px;font-weight:700;color:#0f172a;font-family:monospace">${or(bank.ifsc)}</td>
      <td style="padding:4px 8px 4px 0;font-size:11.5px;color:#64748b">Pay Mode</td>
      <td style="padding:4px 0;font-size:11.5px;font-weight:600;color:#0f172a">${or(slip.payMode)}</td>
    </tr>
  </table>
</div>` : ''}

${slip.notes ? `<div style="padding:14px 40px 0"><div style="font-size:11.5px;color:#475569"><b style="color:#1f293f">Note:</b> ${esc(slip.notes)}</div></div>` : ''}

<!-- FOOTER -->
<div style="padding:22px 40px 0">
  <div style="border-top:1px solid #e2e8f0;padding-top:12px;text-align:center;font-size:10.5px;color:#94a3b8;line-height:1.7">
    This is a computer-generated payslip and does not require a signature.<br/>
    ${esc(co.name || '')}${coAddrLine ? ' &#183; ' + esc(coAddrLine) : ''}
  </div>
</div>

</div>
</body>
</html>`;
}

const CO_SELECT = { name: true, logo: true, gst: true, phone: true, email: true, website: true, address: true, settings: true };

async function loadSlip(payslipId) {
  const slip = await prisma.payslip.findUnique({
    where: { payslipId },
    include: {
      company:  { select: CO_SELECT },
      employee: { select: { bankName: true, accountNumber: true, ifsc: true, uanNo: true } },
    },
  });
  if (!slip) throw new Error('Payslip not found');
  return slip;
}

exports.buildPayslipHtml = async (payslipId) => buildHtml(await loadSlip(payslipId));

exports.generatePayslipPdf = async (payslipId) => {
  const html = buildHtml(await loadSlip(payslipId));
  try {
    const htmlPdf = require('html-pdf-node');
    const buffer  = await htmlPdf.generatePdf({ content: html }, {
      format: 'A4', printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return { buffer, html };
  } catch {
    return { buffer: null, html };
  }
};

exports._internals = { amountInWords, buildHtml };
