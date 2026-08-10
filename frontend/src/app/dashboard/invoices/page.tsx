'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { companyApi, invoiceApi, clientApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, Modal, useToast, Avatar, Skeleton, UIIcons } from '@/components/ui';
import { NavIcon } from '@/components/layout/nav';
import {
  inr, dateStr, BLANK, StatusBadge,
  PdfModal, PaidModal, EditModal, CancelModal, AssignModal,
  LineItemsTable, TotalsBlock,
  SimpleBarChart, MiniLineChart, DonutChart,
} from './ui';

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'block' };
const sectionLbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };

// ─── Analytics View ───────────────────────────────────────────
function AnalyticsView({ allInvoices, companies, cid }: { allInvoices: any[]; companies: any[]; cid: string }) {
  const [fyFilter, setFyFilter] = useState('ALL');

  const shortFmt = (n: number) => n >= 1e7 ? `₹${(n/1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(1)}L` : n >= 1e3 ? `₹${(n/1e3).toFixed(0)}K` : `₹${Math.round(n)}`;
  const fmtInr  = (n: number) => '₹' + (n||0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const getFY   = (s: string) => { const d = new Date(s); const y = d.getFullYear(), m = d.getMonth(); return m >= 3 ? `FY ${y}-${String(y+1).slice(2)}` : `FY ${y-1}-${String(y).slice(2)}`; };

  const activeInvs    = allInvoices.filter(i => i.status !== 'CANCELLED');
  const cancelledInvs = allInvoices.filter(i => i.status === 'CANCELLED');
  const paidInvs      = activeInvs.filter(i => i.status === 'PAID');

  const totalRevenue  = activeInvs.reduce((a, i) => a + (i.grandTotal || 0), 0);
  const collected     = activeInvs.reduce((a, i) => a + (i.paidAmount || 0), 0);
  const totalTds      = activeInvs.reduce((a, i) => a + (i.tdsAmount || 0), 0);
  const totalTax      = activeInvs.reduce((a, i) => a + (i.totalGst || 0), 0);
  const totalSubtotal = activeInvs.reduce((a, i) => a + (i.subtotal || 0), 0);
  const pending       = activeInvs.filter(i => ['SENT','PARTIAL'].includes(i.status))
    .reduce((a, i) => a + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - (i.tdsAmount || 0)), 0);

  // FY map (all active)
  const fyMapAll: Record<string, { subtotal: number; tax: number; grand: number; paid: number; count: number }> = {};
  activeInvs.forEach(i => {
    const fy = getFY(i.invoiceDate || i.createdAt);
    if (!fyMapAll[fy]) fyMapAll[fy] = { subtotal: 0, tax: 0, grand: 0, paid: 0, count: 0 };
    fyMapAll[fy].subtotal += i.subtotal || 0;
    fyMapAll[fy].tax      += i.totalGst || 0;
    fyMapAll[fy].grand    += i.grandTotal || 0;
    fyMapAll[fy].count    += 1;
    if (i.status === 'PAID') fyMapAll[fy].paid += i.grandTotal || 0;
  });
  const fyList = Object.keys(fyMapAll).sort();
  const fyChartData = fyList.map(fy => ({ label: fy.replace('FY ', ''), vals: [fyMapAll[fy].subtotal, fyMapAll[fy].tax, fyMapAll[fy].grand] }));
  const fyChartGroups = fyChartData.map(d => ({ vals: d.vals }));

  // Filtered invoices (by FY)
  const filteredInvs = fyFilter === 'ALL' ? activeInvs : activeInvs.filter(i => getFY(i.invoiceDate || i.createdAt) === fyFilter);

  // Monthly data
  const monthMap: Record<string, { grand: number; paid: number; label: string }> = {};
  filteredInvs.forEach(i => {
    const d   = new Date(i.invoiceDate || i.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lbl = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!monthMap[key]) monthMap[key] = { grand: 0, paid: 0, label: lbl };
    monthMap[key].grand += i.grandTotal || 0;
    if (i.status === 'PAID') monthMap[key].paid += i.grandTotal || 0;
  });
  const monthData = Object.keys(monthMap).sort().map(k => monthMap[k]);

  // Client data (filtered)
  const clientMapA: Record<string, { grand: number; paid: number; count: number; subtotal: number; tax: number }> = {};
  filteredInvs.forEach(i => {
    const k = i.clientName || 'Unknown';
    if (!clientMapA[k]) clientMapA[k] = { grand: 0, paid: 0, count: 0, subtotal: 0, tax: 0 };
    clientMapA[k].grand    += i.grandTotal || 0;
    clientMapA[k].subtotal += i.subtotal || 0;
    clientMapA[k].tax      += i.totalGst || 0;
    clientMapA[k].count    += 1;
    clientMapA[k].paid     += i.paidAmount || (i.status === 'PAID' ? i.grandTotal : 0) || 0;
  });
  const clientRows    = Object.entries(clientMapA).sort((a, b) => b[1].grand - a[1].grand).slice(0, 10);
  const maxClientGrand = Math.max(...clientRows.map(([, v]) => v.grand), 1);

  // Status counts
  const SC = allInvoices.reduce((a, i) => { a[i.status] = (a[i.status] || 0) + 1; return a; }, {} as Record<string, number>);
  const donutSegs = [
    { label: 'Paid',      value: SC.PAID      || 0, color: 'var(--success)' },
    { label: 'Sent',      value: SC.SENT      || 0, color: 'var(--primary)' },
    { label: 'Partial',   value: SC.PARTIAL   || 0, color: 'var(--warning)' },
    { label: 'Draft',     value: SC.DRAFT     || 0, color: 'var(--text-3)' },
    { label: 'Cancelled', value: SC.CANCELLED || 0, color: 'var(--border-strong)' },
  ];

  // Company-wise TDS (active invoices only)
  const companyTdsMap: Record<string, { name: string; tdsAmount: number; tdsCount: number }> = {};
  activeInvs.filter(i => (i.tdsAmount || 0) > 0).forEach(i => {
    const key  = i._companyId || cid;
    const name = i._companyName || companies.find((c: any) => c.companyId === key)?.name || 'Company';
    if (!companyTdsMap[key]) companyTdsMap[key] = { name, tdsAmount: 0, tdsCount: 0 };
    companyTdsMap[key].tdsAmount += i.tdsAmount || 0;
    companyTdsMap[key].tdsCount  += 1;
  });
  const companyTdsRows = Object.values(companyTdsMap).sort((a, b) => b.tdsAmount - a.tdsAmount);

  // GST rate breakdown (filtered)
  const gstRateMap: Record<string, { taxable: number; tax: number }> = {};
  filteredInvs.forEach(i => {
    (i.items || []).forEach((item: any) => {
      const rate = String(item.gstPercent ?? 0);
      if (!gstRateMap[rate]) gstRateMap[rate] = { taxable: 0, tax: 0 };
      const base = (item.quantity * (item.unitPrice || 0)) - (item.discount || 0);
      gstRateMap[rate].taxable += base;
      gstRateMap[rate].tax     += Math.round(base * (item.gstPercent || 0) / 100);
    });
  });
  const gstRateRows = Object.entries(gstRateMap).sort((a, b) => +a[0] - +b[0]);
  const totalGstTax = gstRateRows.reduce((a, [, v]) => a + v.tax, 0);

  // Download CSV
  const downloadCSV = () => {
    const hdr = ['Invoice #','Date','Due Date','Client','Client GST','Status','Subtotal (₹)','GST (₹)','Grand Total (₹)','Paid Amount (₹)','TDS Amount (₹)','TDS Rate (%)','Balance (₹)','Payment Received Date','Payment Method','Transaction ID'];
    const rows = allInvoices.map(i => {
      const tds = i.tdsAmount || 0;
      const bal = Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - tds);
      return [
        i.invoiceNumber,
        new Date(i.invoiceDate || i.createdAt).toLocaleDateString('en-IN'),
        i.dueDate ? new Date(i.dueDate).toLocaleDateString('en-IN') : '',
        i.clientName || '', i.clientGst || '', i.status,
        i.subtotal || 0, i.totalGst || 0, i.grandTotal || 0,
        i.paidAmount || 0,
        tds,
        i.tdsRate || 0,
        bal,
        i.paidAt ? new Date(i.paidAt).toLocaleDateString('en-IN') : '',
        i.paymentMethod ? i.paymentMethod.replace(/_/g, ' ') : '',
        i.transactionId || '',
      ];
    });
    const csv = [hdr, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = `invoice-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Print HTML report
  const printReport = () => {
    const w = window.open('', '_blank', 'width=960,height=720');
    if (!w) return;
    const SC_COLOR: Record<string, string> = { PAID: '#16a34a', SENT: '#2563eb', DRAFT: '#94a3b8', PARTIAL: '#f59e0b', OVERDUE: '#ef4444', CANCELLED: '#94a3b8' };
    const tRows = allInvoices.map(i => {
      const tds = i.tdsAmount || 0;
      const bal = Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - tds);
      return `<tr>
        <td>${i.invoiceNumber}</td>
        <td>${new Date(i.invoiceDate || i.createdAt).toLocaleDateString('en-IN')}</td>
        <td>${i.clientName || ''}</td>
        <td><span style="background:${SC_COLOR[i.status]||'#94a3b8'};color:white;padding:2px 8px;border-radius:4px;font-size:10px">${i.status}</span></td>
        <td style="text-align:right">${fmtInr(i.subtotal||0)}</td>
        <td style="text-align:right;color:#4f46e5">${fmtInr(i.totalGst||0)}</td>
        <td style="text-align:right;font-weight:700">${fmtInr(i.grandTotal||0)}</td>
        <td style="text-align:right;color:${(i.paidAmount||0)>0?'#16a34a':'#94a3b8'}">${fmtInr(i.paidAmount||0)}</td>
        <td style="text-align:right;color:#7c3aed">${tds > 0 ? fmtInr(tds) + ' (' + (i.tdsRate||0) + '%)' : '—'}</td>
        <td style="text-align:right;color:${bal>0?'#ef4444':'#16a34a'}">${fmtInr(bal)}</td>
      </tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice Report</title>
<style>
  *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111827;font-size:13px}
  h1{font-size:22px;font-weight:800;margin:0 0 2px;color:#111827}
  .sub{color:#6b7280;font-size:12px;margin-bottom:24px}
  .kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:28px}@media(min-width:600px){.kpis{grid-template-columns:repeat(4,1fr)}}
  .kpi{border:1px solid #e8edf5;border-radius:10px;padding:14px 16px}
  .kpi-label{font-size:10px;color:#9aa3b2;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .kpi-val{font-size:20px;font-weight:800}
  table{width:100%;border-collapse:collapse}
  th{background:#f7f9fc;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;border-bottom:2px solid #e8edf5;white-space:nowrap}
  td{padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:12px}
  tfoot td{font-weight:700;background:#eff4ff;border-top:2px solid #2563eb}
  @media print{body{padding:16px}@page{margin:1cm}}
</style></head><body>
<h1>Invoice Report</h1>
<div class="sub">Generated ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} &nbsp;·&nbsp; ${activeInvs.length} active invoices${cancelledInvs.length > 0 ? ` (${cancelledInvs.length} cancelled excluded)` : ''}${fyFilter !== 'ALL' ? ' &nbsp;·&nbsp; ' + fyFilter : ''}</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-val" style="color:#2563eb">${fmtInr(totalRevenue)}</div></div>
  <div class="kpi"><div class="kpi-label">Cash Received</div><div class="kpi-val" style="color:#16a34a">${fmtInr(collected)}</div></div>
  <div class="kpi"><div class="kpi-label">TDS Deducted</div><div class="kpi-val" style="color:#7c3aed">${fmtInr(totalTds)}</div></div>
  <div class="kpi"><div class="kpi-label">Total GST</div><div class="kpi-val" style="color:#4f46e5">${fmtInr(totalTax)}</div></div>
</div>
<table>
  <thead><tr><th>Invoice #</th><th>Date</th><th>Client</th><th>Status</th><th style="text-align:right">Subtotal</th><th style="text-align:right">GST</th><th style="text-align:right">Grand Total</th><th style="text-align:right">Paid</th><th style="text-align:right">TDS</th><th style="text-align:right">Balance</th></tr></thead>
  <tbody>${tRows}</tbody>
  <tfoot><tr>
    <td colspan="4">TOTAL (${activeInvs.length} active invoices${cancelledInvs.length > 0 ? ` · ${cancelledInvs.length} cancelled excluded` : ''})</td>
    <td style="text-align:right">${fmtInr(totalSubtotal)}</td>
    <td style="text-align:right">${fmtInr(totalTax)}</td>
    <td style="text-align:right">${fmtInr(totalRevenue)}</td>
    <td style="text-align:right">${fmtInr(collected)}</td>
    <td style="text-align:right;color:#7c3aed">${totalTds > 0 ? fmtInr(totalTds) : '—'}</td>
    <td style="text-align:right">${fmtInr(Math.max(0, totalRevenue - collected - totalTds))}</td>
  </tr></tfoot>
</table>
</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 600);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto p-4 md:p-6 flex flex-col gap-5" style={{ maxWidth: 1440 }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Invoice Analytics</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{activeInvs.length} active · {filteredInvs.length} in period · {paidInvs.length} paid{cancelledInvs.length > 0 ? ` · ${cancelledInvs.length} cancelled (excluded from totals)` : ''}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={fyFilter} onChange={e => setFyFilter(e.target.value)} className="fld fld-xs" style={{ width: 'auto', fontWeight: 600 }}>
            <option value="ALL">All Financial Years</option>
            {fyList.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>
          <button onClick={downloadCSV} className="act-btn" style={{ background: 'var(--success-soft)', color: 'var(--success-ink)', padding: '6px 12px' }}>
            ⬇ Download CSV
          </button>
          <button onClick={printReport} className="act-btn" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '6px 12px' }}>
            🖨 Print Report
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
        {[
          { label: 'Total Revenue',      val: totalRevenue,  sub: `${activeInvs.length} invoices`,                                                           color: 'var(--primary)' },
          { label: 'Collected (Cash)',   val: collected,     sub: `${paidInvs.length} paid`,                                                                 color: 'var(--success-ink)' },
          { label: 'TDS Deducted',       val: totalTds,      sub: totalTds > 0 ? `${allInvoices.filter(i=>i.tdsAmount>0).length} inv. with TDS` : 'No TDS recorded', color: '#8B5CF6' },
          { label: 'Outstanding',        val: pending,       sub: `${allInvoices.filter(i=>['SENT','PARTIAL'].includes(i.status)).length} unpaid`,           color: 'var(--warning-ink)' },
          { label: 'Subtotal (Taxable)', val: totalSubtotal, sub: 'Before GST',                                                                              color: 'var(--text)' },
          { label: 'Total GST',          val: totalTax,      sub: totalSubtotal > 0 ? `${((totalTax/totalSubtotal)*100).toFixed(1)}% eff. rate` : '—',       color: 'var(--secondary)' },
        ].map((k, i) => (
          <div key={i} className="lux-card px-4 py-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, letterSpacing: '-0.02em' }}>{shortFmt(k.val)}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── FY Bar Chart + Status Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 p-5">
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Revenue by Financial Year</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Apr – Mar</div>
          </div>
          {fyChartGroups.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text-3)' }}>No data</div>
          ) : (
            <SimpleBarChart
              groups={fyChartGroups}
              colors={['var(--chart-2)', 'var(--chart-3)', 'var(--chart-1)']}
              barNames={['Subtotal', 'GST', 'Grand Total']}
              labels={fyChartData.map(d => d.label)}
              valueFormatter={shortFmt}
              chartHeight={180}
            />
          )}
        </Card>
        <Card className="lg:col-span-2 p-5">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Invoice Status</div>
          <DonutChart segs={donutSegs} />
          <div className="mt-4 pt-4 grid grid-cols-2 gap-2" style={{ borderTop: '1px solid var(--border)', fontSize: 11.5 }}>
            <div style={{ color: 'var(--text-2)' }}>Cash Received</div>
            <div className="text-right" style={{ fontWeight: 700, color: 'var(--success-ink)' }}>{shortFmt(collected)}</div>
            {totalTds > 0 && <>
              <div style={{ color: 'var(--text-2)' }}>TDS Deducted</div>
              <div className="text-right" style={{ fontWeight: 700, color: '#8B5CF6' }}>{shortFmt(totalTds)}</div>
              <div style={{ color: 'var(--text-2)' }}>Total Cleared</div>
              <div className="text-right" style={{ fontWeight: 700, color: 'var(--primary)' }}>{shortFmt(collected + totalTds)}</div>
            </>}
            <div style={{ color: 'var(--text-2)' }}>Outstanding</div>
            <div className="text-right" style={{ fontWeight: 700, color: 'var(--warning-ink)' }}>{shortFmt(pending)}</div>
            <div style={{ color: 'var(--text-2)' }}>Collection Rate</div>
            <div className="text-right" style={{ fontWeight: 700, color: 'var(--secondary)' }}>{totalRevenue > 0 ? `${(((collected+totalTds)/totalRevenue)*100).toFixed(1)}%` : '—'}</div>
          </div>
        </Card>
      </div>

      {/* ── Monthly Trend ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Monthly Revenue Trend</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fyFilter === 'ALL' ? 'All time' : fyFilter}</div>
        </div>
        <MiniLineChart data={monthData} valueKey="grand" labelKey="label" color="var(--chart-1)" height={170} />
      </Card>

      {/* ── Company-wise TDS ── */}
      {totalTds > 0 && (
        <Card className="p-5">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Company-wise TDS Summary</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 16, marginTop: 2 }}>TDS deducted by clients — cancelled invoices excluded</div>
          <div className="table-scroll">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Company', 'Invoices with TDS', 'TDS Amount', '% of Total TDS'].map(h => (
                    <th key={h} className="pb-2 text-left" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companyTdsRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2.5" style={{ fontWeight: 600, color: 'var(--text)' }}>{row.name}</td>
                    <td className="py-2.5" style={{ color: 'var(--text-2)' }}>{row.tdsCount} invoice{row.tdsCount !== 1 ? 's' : ''}</td>
                    <td className="py-2.5" style={{ color: '#8B5CF6', fontWeight: 700 }}>{fmtInr(row.tdsAmount)}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1" style={{ height: 6, background: 'var(--surface-2)', borderRadius: 9999, maxWidth: 96 }}>
                          <div style={{ height: 6, background: '#8B5CF6', borderRadius: 9999, width: `${totalTds > 0 ? (row.tdsAmount / totalTds) * 100 : 0}%` }} />
                        </div>
                        <span style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{totalTds > 0 ? `${((row.tdsAmount / totalTds) * 100).toFixed(1)}%` : '—'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border-strong)' }}>
                  <td className="py-2.5" style={{ fontWeight: 700, color: 'var(--text)' }}>Total</td>
                  <td className="py-2.5" style={{ fontWeight: 700, color: 'var(--text)' }}>{activeInvs.filter(i => (i.tdsAmount || 0) > 0).length} invoices</td>
                  <td className="py-2.5" style={{ fontWeight: 700, color: '#8B5CF6' }}>{fmtInr(totalTds)}</td>
                  <td className="py-2.5" style={{ fontWeight: 700, color: 'var(--text-2)' }}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ── Client Chart + GST Breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Top Clients by Revenue</div>
          {clientRows.length === 0 ? (
            <div className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>No data</div>
          ) : (
            <div className="flex flex-col gap-3">
              {clientRows.map(([name, v], i) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 20, height: 20, borderRadius: 7, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 10, fontWeight: 800 }}>{i + 1}</div>
                      <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{shortFmt(v.grand)}</div>
                      {v.paid > 0 && <div style={{ fontSize: 10.5, color: 'var(--success-ink)' }}>{shortFmt(v.paid)} paid</div>}
                    </div>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div className="flex overflow-hidden" style={{ height: 8, borderRadius: 9999 }}>
                      <div className="transition-all duration-500" style={{ background: 'var(--success)', width: `${(v.paid / maxClientGrand) * 100}%` }} />
                      <div className="transition-all duration-500" style={{ background: 'var(--chart-muted)', width: `${Math.max(0, (v.grand - v.paid) / maxClientGrand * 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-0.5" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                    <span>Sub {shortFmt(v.subtotal)}</span>
                    <span>+GST {shortFmt(v.tax)}</span>
                    <span>{v.count} inv.</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--border)', fontSize: 10.5, color: 'var(--text-3)' }}>
                <span className="flex items-center gap-1"><span style={{ width: 12, height: 6, background: 'var(--success)', borderRadius: 3, display: 'inline-block' }}/>Paid</span>
                <span className="flex items-center gap-1"><span style={{ width: 12, height: 6, background: 'var(--chart-muted)', borderRadius: 3, display: 'inline-block' }}/>Pending</span>
              </div>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>GST Rate Breakdown</div>
          {gstRateRows.length === 0 ? (
            <div className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>No data</div>
          ) : (
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['GST Rate','Taxable Value','Tax Amount','% of Total Tax'].map(h => (
                      <th key={h} className="pb-2 text-left" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gstRateRows.map(([rate, v]) => (
                    <tr key={rate} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2.5">
                        <span style={{ padding: '2px 8px', background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: 9999, fontWeight: 700 }}>{rate}%</span>
                      </td>
                      <td className="py-2.5" style={{ color: 'var(--text)', fontWeight: 500 }}>{shortFmt(v.taxable)}</td>
                      <td className="py-2.5" style={{ color: 'var(--secondary)', fontWeight: 600 }}>{shortFmt(v.tax)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1" style={{ height: 6, background: 'var(--surface-2)', borderRadius: 9999, maxWidth: 64 }}>
                            <div style={{ height: 6, background: 'var(--secondary)', borderRadius: 9999, width: `${totalGstTax > 0 ? (v.tax/totalGstTax)*100 : 0}%` }} />
                          </div>
                          <span style={{ color: 'var(--text-2)' }}>{totalGstTax > 0 ? `${((v.tax/totalGstTax)*100).toFixed(1)}%` : '—'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border-strong)' }}>
                    <td className="py-2.5" style={{ fontWeight: 700, color: 'var(--text)' }}>Total</td>
                    <td className="py-2.5" style={{ fontWeight: 700, color: 'var(--text)' }}>{shortFmt(gstRateRows.reduce((a,[,v])=>a+v.taxable,0))}</td>
                    <td className="py-2.5" style={{ fontWeight: 700, color: 'var(--secondary)' }}>{shortFmt(totalGstTax)}</td>
                    <td className="py-2.5" style={{ fontWeight: 700, color: 'var(--text-2)' }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>

      </div>
    </div>
  );
}

// ─── Create invoice form ──────────────────────────────────────
function emptyForm() {
  return {
    clientName: '', clientEmail: '', clientPhone: '', clientGst: '', clientAddress: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    paymentTerms: 'Net 30', notes: '',
    bankDetails: { bankName: '', accountNumber: '', ifsc: '', accountName: '', upiId: '' },
    items: [BLANK()],
  };
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function InvoicesPage() {
  const [isSuperAdmin] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').role === 'SUPER_ADMIN'; } catch { return false; }
  });

  const [companies,   setCompanies]   = useState<any[]>([]);
  const [cid,         setCid]         = useState('');
  const [coProfile,   setCoProfile]   = useState<any>({});
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [hasMore,       setHasMore]       = useState(false);
  const [tab,           setTab]           = useState('ALL');
  const [showCancelled, setShowCancelled] = useState(false);
  const [previewInv,    setPreviewInv]    = useState<any>(null);
  const [paidInv,       setPaidInv]       = useState<any>(null);
  const [editInv,       setEditInv]       = useState<any>(null);
  const [cancelInv,     setCancelInv]     = useState<any>(null);
  const [assignInv,     setAssignInv]     = useState<any>(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [form,          setForm]          = useState(emptyForm());
  const [clients,       setClients]       = useState<any[]>([]);
  const [clientSearch,  setClientSearch]  = useState('');
  const [showClientDrop,setShowClientDrop]= useState(false);
  const [viewMode,      setViewMode]      = useState<'invoices' | 'analytics'>('invoices');
  const [createCo,      setCreateCo]      = useState('');
  // client history
  const [clientFilter,  setClientFilter]  = useState<string | null>(null);
  const [clientHistCid, setClientHistCid] = useState('');
  const [clientInvs,    setClientInvs]    = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const { toast, ToastContainer }         = useToast();
  const scrollRef    = useRef<HTMLDivElement>(null);
  const pageRef      = useRef(1);
  const hasMoreRef   = useRef(false);
  const loadingMoreRef = useRef(false);
  const PAGE_SIZE    = 15;

  // Load companies (uses /companies/mine — works for all roles)
  const loadCos = useCallback(async () => {
    try {
      const d   = await companyApi.mine();
      const cos = d.companies || [];
      setCompanies(cos);
      if (cos.length > 1) setCid('ALL');
      else if (cos[0]) setCid(cos[0].companyId);
    } catch {}
  }, []);
  useEffect(() => { loadCos(); }, []);

  // When company changes — load profile + invoices + clients
  useEffect(() => {
    if (!cid) return;
    if (cid === 'ALL') {
      // In all-companies mode — clear profile, load invoices from all companies
      setCoProfile({});
      setClients([]);
      loadInvoices();
      return;
    }
    companyApi.getSettings(cid).then((d: any) => {
      setCoProfile(d);
      const bd = d.bankDetails || {};
      setForm(f => ({
        ...f,
        paymentTerms: (bd.paymentTerms || f.paymentTerms),
        bankDetails: {
          bankName:      bd.bankName      || '',
          accountNumber: bd.accountNumber || '',
          ifsc:          bd.ifsc          || '',
          accountName:   bd.accountName   || '',
          upiId:         bd.upiId         || '',
        }
      }));
    }).catch(() => {});
    // Load clients for auto-fill
    clientApi.list(cid, { limit: '200' }).then((d: any) => setClients(d.clients || [])).catch(() => {});
    loadInvoices();
  }, [cid]);

  // In all-companies (ALL) mode, the client list must follow the billing company
  // chosen in the Create Invoice modal, otherwise the client search is empty.
  useEffect(() => {
    if (cid !== 'ALL') return;
    if (!createCo) { setClients([]); return; }
    clientApi.list(createCo, { limit: '200' }).then((d: any) => setClients(d.clients || [])).catch(() => {});
  }, [cid, createCo]);

  const loadInvoices = async () => {
    if (!cid) return;
    setLoading(true);
    pageRef.current = 1;
    try {
      if (cid === 'ALL') {
        // Fetch from all companies in parallel and merge
        const results = await Promise.all(
          companies.map((co: any) =>
            invoiceApi.list(co.companyId, { limit: '500', page: '1' })
              .then((d: any) => (d.invoices || []).map((inv: any) => ({ ...inv, _companyName: co.name, _companyId: co.companyId })))
              .catch(() => [])
          )
        );
        const merged = (results as any[][]).flat().sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setAllInvoices(merged);
        hasMoreRef.current = false;
        setHasMore(false);
      } else {
        const d = await invoiceApi.list(cid, { limit: String(PAGE_SIZE), page: '1' });
        const fetched = d.invoices || [];
        setAllInvoices(fetched);
        const total = d.pagination?.total || fetched.length;
        const more = total > PAGE_SIZE;
        hasMoreRef.current = more;
        setHasMore(more);
      }
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setLoading(false); }
  };

  const loadMore = async () => {
    if (!cid || loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const d = await invoiceApi.list(cid, { limit: String(PAGE_SIZE), page: String(nextPage) });
      const fetched = d.invoices || [];
      setAllInvoices(prev => [...prev, ...fetched]);
      pageRef.current = nextPage;
      const total = d.pagination?.total || 0;
      const more = total > nextPage * PAGE_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch {}
    finally { loadingMoreRef.current = false; setLoadingMore(false); }
  };

  const openClientHistory = async (name: string, invCompanyId?: string) => {
    const targetCid = invCompanyId || (cid !== 'ALL' ? cid : '');
    if (!targetCid) return;
    setClientFilter(name);
    setClientHistCid(targetCid);
    setClientLoading(true);
    setClientInvs([]);
    try {
      const d = await invoiceApi.list(targetCid, { limit: '200', page: '1', clientName: name });
      // Enrich with _companyId so modals work in ALL mode
      setClientInvs((d.invoices || []).map((inv: any) => ({ ...inv, _companyId: targetCid })));
    } catch {}
    finally { setClientLoading(false); }
  };

  // Infinite scroll — fires loadMore when near bottom
  useEffect(() => {
    if (viewMode !== 'invoices' || clientFilter) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadMore();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [viewMode, clientFilter, cid]);

  // Tabs — cancelled always hidden unless toggled on
  const visibleInvoices = showCancelled ? allInvoices : allInvoices.filter(i => i.status !== 'CANCELLED');
  const cancelledCount  = allInvoices.filter(i => i.status === 'CANCELLED').length;

  const TABS = [
    { key: 'ALL',     label: 'All',     fn: () => true },
    { key: 'SENT',    label: 'Unpaid',  fn: (i: any) => i.status === 'SENT' },
    { key: 'PAID',    label: 'Paid',    fn: (i: any) => i.status === 'PAID' },
    { key: 'PARTIAL', label: 'Partial', fn: (i: any) => i.status === 'PARTIAL' },
    { key: 'OVERDUE', label: 'Overdue', fn: (i: any) => i.status === 'OVERDUE' || (i.status === 'SENT' && new Date(i.dueDate) < new Date()) },
    { key: 'DRAFT',   label: 'Draft',   fn: (i: any) => i.status === 'DRAFT' },
    ...(showCancelled ? [{ key: 'CANCELLED', label: 'Cancelled', fn: (i: any) => i.status === 'CANCELLED' }] : []),
  ];
  const activeTab = TABS.find(t => t.key === tab) || TABS[0];
  // if cancelled tab was active but now hidden, fall back to ALL
  if (tab === 'CANCELLED' && !showCancelled) setTab('ALL');
  const invoices  = visibleInvoices.filter(activeTab.fn);

  // Totals — exclude CANCELLED from all financial calculations
  const activeInvs    = allInvoices.filter(i => i.status !== 'CANCELLED');
  const totalSubtotal = activeInvs.reduce((a, i) => a + (i.subtotal   || 0), 0);
  const totalTax      = activeInvs.reduce((a, i) => a + (i.totalGst   || 0), 0);
  const totalRevenue  = activeInvs.reduce((a, i) => a + (i.grandTotal || 0), 0);
  const totalTds      = activeInvs.reduce((a, i) => a + (i.tdsAmount  || 0), 0);

  const collected = activeInvs.reduce((a, i) => a + (i.paidAmount || 0), 0);

  // Pending = DRAFT full amount + SENT/PARTIAL remaining balance (after paid + TDS)
  const pending = activeInvs
    .filter(i => ['DRAFT', 'SENT', 'PARTIAL'].includes(i.status))
    .reduce((a, i) => {
      if (i.status === 'DRAFT') return a + (i.grandTotal || 0);
      return a + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - (i.tdsAmount || 0));
    }, 0);

  const overdue = activeInvs
    .filter(i => i.status === 'SENT' && i.dueDate && new Date(i.dueDate) < new Date())
    .reduce((a, i) => a + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - (i.tdsAmount || 0)), 0);

  const fmtL = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : inr(n);

  // TDS breakdown — company-wise and invoice-wise (active only)
  const companyTdsMap: Record<string, { name: string; tdsAmount: number; count: number }> = {};
  activeInvs.filter(i => (i.tdsAmount || 0) > 0).forEach(i => {
    const key  = i._companyId || (cid !== 'ALL' ? cid : '');
    const name = i._companyName || companies.find((c: any) => c.companyId === key)?.name || 'Company';
    if (!companyTdsMap[key]) companyTdsMap[key] = { name, tdsAmount: 0, count: 0 };
    companyTdsMap[key].tdsAmount += i.tdsAmount || 0;
    companyTdsMap[key].count     += 1;
  });
  const companyTdsRows = Object.values(companyTdsMap).sort((a, b) => b.tdsAmount - a.tdsAmount);
  const tdsInvoices    = activeInvs.filter(i => (i.tdsAmount || 0) > 0)
    .sort((a, b) => (b.tdsAmount || 0) - (a.tdsAmount || 0));

  // Item helpers
  const updItem = (i: number, k: string, v: any) => setForm(f => ({ ...f, items: f.items.map((it: any, idx: number) => idx === i ? { ...it, [k]: v } : it) }));
  const subtotal   = form.items.reduce((a, it: any) => a + it.quantity * it.unitPrice - (it.discount || 0), 0);
  const gstTotal   = form.items.reduce((a: number, it: any) => {
    if (it.gstPercent == null) return a;
    return a + Math.round((it.quantity * it.unitPrice - (it.discount || 0)) * it.gstPercent / 100);
  }, 0);
  const grandTotal = subtotal + gstTotal;
  const formGstByRate: Record<number, number> = {};
  form.items.forEach((it: any) => {
    if (it.gstPercent == null) return;
    const taxable = it.quantity * it.unitPrice - (it.discount || 0);
    const tax = Math.round(taxable * it.gstPercent / 100);
    formGstByRate[it.gstPercent] = (formGstByRate[it.gstPercent] || 0) + tax;
  });

  const openCreate = () => {
    setForm(emptyForm());
    setClientSearch('');
    setShowClientDrop(false);
    const bd = coProfile?.bankDetails || {};
    setForm(f => ({
      ...f,
      paymentTerms: bd.paymentTerms || 'Net 30',
      bankDetails: { bankName: bd.bankName||'', accountNumber: bd.accountNumber||'', ifsc: bd.ifsc||'', accountName: bd.accountName||'', upiId: bd.upiId||'' }
    }));
    // Set default billing company for the create modal
    setCreateCo(cid !== 'ALL' ? cid : (companies[0]?.companyId || ''));
    setShowCreate(true);
  };

  // Select client → auto-fill invoice client fields
  const selectLead = (c: any) => {
    const addr = [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ');
    setForm(f => ({
      ...f,
      clientName:    c.name    || '',
      clientEmail:   c.email   || '',
      clientPhone:   c.phone   || '',
      clientGst:     c.gst     || '',
      clientAddress: addr || c.address || '',
    }));
    setClientSearch(c.name || '');
    setShowClientDrop(false);
  };

  const create = async () => {
    if (!form.clientName)               return toast('Client name required', 'err');
    if (!form.items[0]?.description)    return toast('Add at least one item', 'err');
    const targetCid = cid === 'ALL' ? createCo : cid;
    if (!targetCid)                     return toast('Select a billing company', 'err');
    setSaving(true);
    try {
      const bd = form.bankDetails.bankName ? form.bankDetails : null;
      await invoiceApi.create(targetCid, { ...form, bankDetails: bd });
      toast('Invoice created!');
      setShowCreate(false);
      loadInvoices();
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  const STAT_TILES = [
    { label: 'Collected',      value: fmtL(collected),           sub: `${activeInvs.filter(i=>i.status==='PAID').length} paid`, grad: 'var(--grad-green)',  icon: 'invoices' },
    { label: 'Pending',        value: fmtL(pending),             sub: 'Draft + Sent + Partial',                                  grad: 'var(--grad-brand)',  icon: 'quotations' },
    { label: 'Overdue',        value: fmtL(overdue),             sub: `${activeInvs.filter(i=>i.status==='SENT'&&i.dueDate&&new Date(i.dueDate)<new Date()).length} invoices`, grad: 'linear-gradient(135deg,#F87171,#DC2626)', icon: 'expenses' },
    { label: 'TDS Deducted',   value: fmtL(totalTds),            sub: `${tdsInvoices.length} invoice${tdsInvoices.length!==1?'s':''}`, grad: 'var(--grad-violet)', icon: 'finance' },
    { label: 'Total Invoices', value: String(activeInvs.length), sub: `excl. ${cancelledCount} cancelled`,                       grad: 'var(--grad-teal)',   icon: 'templates' },
  ];

  return (
    <>
      <Topbar title="Invoices" subtitle={`${activeInvs.length} active invoices · ${fmtL(collected)} collected`}
        actions={<>
          <div className="seg">
            <button onClick={() => setViewMode('invoices')} className={`seg-btn ${viewMode === 'invoices' ? 'on' : ''}`}>Invoices</button>
            <button onClick={() => setViewMode('analytics')} className={`seg-btn ${viewMode === 'analytics' ? 'on' : ''}`}>Analytics</button>
          </div>
          <select value={cid} onChange={e => setCid(e.target.value)} className="fld fld-xs" style={{ width: 'auto', fontWeight: 600, maxWidth: 200 }}>
            {companies.length > 1 && <option value="ALL">All Companies ({companies.length})</option>}
            {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          {viewMode === 'invoices' && <Btn variant="primary" size="sm" onClick={openCreate}>{UIIcons.plus(13)} New Invoice</Btn>}
        </>}
      />

      {viewMode === 'analytics' ? (
        <AnalyticsView allInvoices={allInvoices} companies={companies} cid={cid} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        <div className="mx-auto p-4 md:p-6 flex flex-col gap-5" style={{ maxWidth: 1440 }}>

          {/* Summary row 1 — status tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 stagger">
            {STAT_TILES.map((s, i) => (
              <div key={i} className="lux-card px-4 py-3.5 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
                <div className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 38, height: 38, borderRadius: 12, background: s.grad, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>
                  <NavIcon name={s.icon} size={17} />
                </div>
                <div className="min-w-0">
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>{s.value}</div>
                  <div className="truncate" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary row 2 — revenue breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger">
            <div className="lux-card px-5 py-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Subtotal (Taxable)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{fmtL(totalSubtotal)}</div>
              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Before GST</span>
                <span style={{ fontSize: 10.5, background: 'var(--surface-2)', color: 'var(--text-2)', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>{activeInvs.length} invoices</span>
              </div>
            </div>
            <div className="lux-card px-5 py-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
              <div style={{ fontSize: 10.5, color: 'var(--secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total GST</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--secondary)', letterSpacing: '-0.02em' }}>{fmtL(totalTax)}</div>
              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Effective rate</span>
                <span style={{ fontSize: 10.5, background: 'var(--primary-soft)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>{totalSubtotal > 0 ? ((totalTax / totalSubtotal) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
            <div className="lux-card px-5 py-4 flex flex-col gap-2 relative overflow-hidden" style={{ borderRadius: 18, background: 'var(--grad-brand-deep)', color: '#fff', border: '1px solid transparent' }}>
              <div aria-hidden className="absolute pointer-events-none" style={{ width: 220, height: 220, right: -80, top: -120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)' }} />
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.75)' }}>Total Revenue</div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmtL(totalRevenue)}</div>
              <div className="flex flex-col gap-1 mt-0.5" style={{ fontSize: 11.5 }}>
                <div className="flex justify-between">
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>Collected (Cash)</span>
                  <span style={{ fontWeight: 600, color: '#6EE7B7' }}>{fmtL(collected)}</span>
                </div>
                {totalTds > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>TDS Deducted</span>
                    <span style={{ fontWeight: 600, color: '#C4B5FD' }}>{fmtL(totalTds)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 mt-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>Pending</span>
                  <span style={{ fontWeight: 600, color: '#FCD34D' }}>{fmtL(pending)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TDS Section — company-wise + invoice-wise */}
          {totalTds > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Company-wise TDS */}
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Company-wise TDS</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>TDS deducted by clients · cancelled excluded</div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <th className="tbl-th" style={{ padding: '8px 16px' }}>Company</th>
                      <th className="tbl-th text-center" style={{ padding: '8px 12px', textAlign: 'center' }}>Invoices</th>
                      <th className="tbl-th" style={{ padding: '8px 16px', textAlign: 'right' }}>TDS Amount</th>
                      <th className="tbl-th" style={{ padding: '8px 16px', textAlign: 'right' }}>% Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyTdsRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5" style={{ fontWeight: 600, color: 'var(--text)' }}>{row.name}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: 'var(--text-2)' }}>{row.count}</td>
                        <td className="px-4 py-2.5 text-right" style={{ fontWeight: 700, color: '#8B5CF6' }}>{inr(row.tdsAmount)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div style={{ width: 48, height: 6, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden' }}>
                              <div style={{ height: 6, background: '#8B5CF6', borderRadius: 9999, width: `${totalTds > 0 ? (row.tdsAmount / totalTds) * 100 : 0}%` }} />
                            </div>
                            <span style={{ color: 'var(--text-2)', width: 40, textAlign: 'right' }}>{totalTds > 0 ? `${((row.tdsAmount / totalTds) * 100).toFixed(1)}%` : '—'}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border-strong)' }}>
                      <td className="px-4 py-2.5" style={{ fontWeight: 700, color: 'var(--text)' }}>Total</td>
                      <td className="px-3 py-2.5 text-center" style={{ fontWeight: 700, color: 'var(--text)' }}>{tdsInvoices.length}</td>
                      <td className="px-4 py-2.5 text-right" style={{ fontWeight: 700, color: '#8B5CF6' }}>{inr(totalTds)}</td>
                      <td className="px-4 py-2.5 text-right" style={{ fontWeight: 700, color: 'var(--text-2)' }}>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </Card>

              {/* Invoice-wise TDS */}
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Invoice-wise TDS</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{tdsInvoices.length} invoice{tdsInvoices.length !== 1 ? 's' : ''} with TDS deduction</div>
                </div>
                <div className="table-scroll max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-2)' }}>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="tbl-th" style={{ padding: '8px 16px' }}>Invoice</th>
                        {cid === 'ALL' && <th className="tbl-th" style={{ padding: '8px 12px' }}>Company</th>}
                        <th className="tbl-th" style={{ padding: '8px 12px' }}>Client</th>
                        <th className="tbl-th" style={{ padding: '8px 12px', textAlign: 'right' }}>Invoice Total</th>
                        <th className="tbl-th" style={{ padding: '8px 16px', textAlign: 'right' }}>TDS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tdsInvoices.map((inv: any) => (
                        <tr key={inv.invoiceId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2.5">
                            <button onClick={() => setPreviewInv(inv)} className="font-mono hover:underline" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{inv.invoiceNumber}</button>
                            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{inr(inv.grandTotal)}</div>
                          </td>
                          {cid === 'ALL' && (
                            <td className="px-3 py-2.5">
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, background: 'var(--primary-soft)', color: 'var(--primary)' }}>{inv._companyName}</span>
                            </td>
                          )}
                          <td className="px-3 py-2.5 truncate" style={{ color: 'var(--text-2)', maxWidth: 120 }}>{inv.clientName}</td>
                          <td className="px-3 py-2.5 text-right" style={{ color: 'var(--text)', fontWeight: 500 }}>{inr(inv.grandTotal)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div style={{ fontWeight: 700, color: '#8B5CF6' }}>{inr(inv.tdsAmount)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{inv.tdsRate}%</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          )}

          {/* Tabs + cancelled toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="seg flex-wrap">
              {TABS.map(t => {
                const count = t.key === 'ALL' ? visibleInvoices.length : visibleInvoices.filter(t.fn).length;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)} className={`seg-btn ${tab === t.key ? 'on' : ''}`}>
                    {t.label}
                    {count > 0 && (
                      <span style={{
                        fontSize: 10, padding: '1px 7px', borderRadius: 9999, fontWeight: 700,
                        background: tab === t.key ? 'var(--primary-soft)' : 'var(--surface-3)',
                        color: tab === t.key ? 'var(--primary)' : 'var(--text-3)',
                      }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Cancelled toggle */}
            {cancelledCount > 0 && (
              <button onClick={() => { setShowCancelled(p => !p); if (tab === 'CANCELLED') setTab('ALL'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
                style={{
                  borderRadius: 11, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: showCancelled ? 'var(--surface-3)' : 'var(--surface)',
                  border: `1px solid ${showCancelled ? 'var(--border-strong)' : 'var(--border)'}`,
                  color: showCancelled ? 'var(--text)' : 'var(--text-3)',
                }}>
                Cancelled
                <span style={{ padding: '1px 7px', borderRadius: 9999, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 10, fontWeight: 700 }}>{cancelledCount}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{showCancelled ? 'Hide' : 'Show'}</span>
              </button>
            )}
          </div>

          {/* Table */}
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="p-4 flex flex-col gap-3">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton w={90} h={14} />
                    <Skeleton w={160} h={14} />
                    <Skeleton w={100} h={14} />
                    <Skeleton w={72} h={18} r={9999} />
                    <div className="flex-1" />
                    <Skeleton w={180} h={14} />
                  </div>
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <div className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  <NavIcon name="invoices" size={24} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {tab === 'ALL' ? 'No invoices yet' : `No ${activeTab.label.toLowerCase()} invoices`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>
                    {tab === 'ALL' ? 'Create your first invoice or convert a quotation' : 'Switch tabs to see other invoices'}
                  </div>
                </div>
                {tab === 'ALL' && <Btn variant="primary" size="sm" onClick={openCreate}>{UIIcons.plus(13)} Create Invoice</Btn>}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      {(cid === 'ALL' ? ['Company', 'Invoice #', 'Bill To', 'Amount', 'Status', 'Due Date', 'Payment', 'Actions'] : ['Invoice #', 'Bill To', 'Amount', 'Status', 'Due Date', 'Payment', 'Actions']).map(h => (
                        <th key={h} className="tbl-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv: any) => {
                      const isOverdue = inv.status === 'SENT' && inv.dueDate && new Date(inv.dueDate) < new Date();
                      const displayS  = isOverdue ? 'OVERDUE' : inv.status;
                      const balance   = (inv.grandTotal || 0) - (inv.paidAmount || 0);
                      const invCid    = inv._companyId || cid;
                      const EDGE: Record<string, string> = {
                        PAID: 'var(--success)', OVERDUE: 'var(--danger)', PARTIAL: 'var(--warning)',
                        SENT: 'var(--primary)', DRAFT: 'var(--border-strong)', CANCELLED: 'var(--border)',
                      };
                      return (
                        <tr key={inv.invoiceId} className="group"
                          style={{ borderBottom: '1px solid var(--border)', boxShadow: `inset 3px 0 0 ${EDGE[displayS] || 'transparent'}`, opacity: displayS === 'CANCELLED' ? 0.55 : 1, transition: 'background 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          {/* Company (only in ALL mode) */}
                          {cid === 'ALL' && (
                            <td className="px-4 py-3">
                              <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600, background: 'var(--primary-soft)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{inv._companyName}</span>
                            </td>
                          )}
                          {/* Invoice # */}
                          <td className="px-4 py-3">
                            <button onClick={() => setPreviewInv(inv)} className="font-mono hover:underline" style={{ fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12 }}>{inv.invoiceNumber}</button>
                            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{dateStr(inv.invoiceDate || inv.createdAt)}</div>
                          </td>
                          {/* Bill To */}
                          <td className="px-4 py-3" style={{ maxWidth: 190 }}>
                            <div className="flex items-center gap-2">
                              <Avatar name={inv.clientName} size={26} />
                              <div className="min-w-0">
                                <button onClick={() => openClientHistory(inv.clientName, invCid)}
                                  className="truncate block text-left w-full transition-colors hover:underline"
                                  style={{ fontWeight: 600, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12.5 }}
                                  title="View client history">{inv.clientName}</button>
                                {inv.clientGst   && <div className="font-mono truncate" style={{ fontSize: 10, color: 'var(--text-3)' }}>GST: {inv.clientGst}</div>}
                                {inv.clientEmail && <div className="truncate" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{inv.clientEmail}</div>}
                              </div>
                            </div>
                          </td>
                          {/* Amount */}
                          <td className="px-4 py-3">
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{inr(inv.grandTotal)}</div>
                            {(inv.subtotal > 0 || inv.totalGst > 0) && (
                              <div className="flex gap-2" style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>
                                {inv.subtotal > 0 && <span>Sub {inr(inv.subtotal)}</span>}
                                {inv.totalGst > 0 && <span>+GST {inr(inv.totalGst)}</span>}
                              </div>
                            )}
                            {inv.tdsAmount > 0 && (
                              <div style={{ fontSize: 10.5, color: '#8B5CF6', marginTop: 2, fontWeight: 600 }}>TDS {inr(inv.tdsAmount)} ({inv.tdsRate}%)</div>
                            )}
                            {inv.status === 'PAID' && <div style={{ fontSize: 10.5, color: 'var(--success-ink)', fontWeight: 600, marginTop: 2 }}>✓ Fully Paid</div>}
                            {inv.status === 'PARTIAL' && balance > 0 && <div style={{ fontSize: 10.5, color: 'var(--warning-ink)', marginTop: 2 }}>Due {inr(balance)}</div>}
                            {inv.paidAmount > 0 && !['PAID'].includes(inv.status) && <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Paid {inr(inv.paidAmount)}</div>}
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3"><StatusBadge s={displayS} /></td>
                          {/* Due Date */}
                          <td className="px-4 py-3">
                            <div style={{ fontSize: 11.5, fontWeight: isOverdue ? 700 : 500, color: isOverdue ? 'var(--danger-ink)' : 'var(--text-2)' }}>{dateStr(inv.dueDate)}</div>
                            {isOverdue && <div style={{ fontSize: 10, color: 'var(--danger-ink)', opacity: 0.8 }}>Overdue!</div>}
                          </td>
                          {/* Payment */}
                          <td className="px-4 py-3">
                            {inv.paymentMethod ? (
                              <div>
                                <div className="capitalize" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>{inv.paymentMethod.replace(/_/g, ' ')}</div>
                                {inv.transactionId && <div className="font-mono truncate" style={{ fontSize: 10, color: 'var(--text-3)', maxWidth: 112 }}>{inv.transactionId}</div>}
                                {inv.paidAt && (
                                  <div style={{ fontSize: 10.5, color: 'var(--success-ink)', fontWeight: 500, marginTop: 2 }}>Received: {dateStr(inv.paidAt)}</div>
                                )}
                                {inv.tdsAmount > 0 && (
                                  <div className="flex items-center gap-1" style={{ fontSize: 10.5, color: '#8B5CF6', fontWeight: 600, marginTop: 2 }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#8B5CF6', display: 'inline-block', flexShrink: 0 }} />
                                    TDS: {inr(inv.tdsAmount)}
                                  </div>
                                )}
                              </div>
                            ) : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {inv.status !== 'DRAFT' && (
                                <button onClick={() => setPreviewInv(inv)} title="Preview & Download" className="act-btn"
                                  style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>PDF</button>
                              )}
                              {!['PAID','CANCELLED'].includes(inv.status) && (
                                <button onClick={() => setPaidInv(inv)} title="Mark Paid" className="act-btn"
                                  style={{ background: 'var(--success-soft)', color: 'var(--success-ink)' }}>Paid</button>
                              )}
                              {(isSuperAdmin || inv.status !== 'CANCELLED') && (
                                <button onClick={() => setEditInv(inv)} title="Edit" className="act-btn"
                                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>Edit</button>
                              )}
                              {isSuperAdmin && (
                                <button onClick={() => setAssignInv(inv)} title={inv.assignedUserIds?.length ? `Assigned to ${inv.assignedUserIds.length} user(s)` : 'Assign to users'}
                                  className="act-btn" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                                  Assign{inv.assignedUserIds?.length ? ` (${inv.assignedUserIds.length})` : ''}
                                </button>
                              )}
                              {!['PAID','CANCELLED'].includes(inv.status) && (
                                <button onClick={() => setCancelInv(inv)} title="Cancel" className="act-btn"
                                  style={{ background: 'var(--danger-soft)', color: 'var(--danger-ink)' }}>Cancel</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Load-more indicator */}
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-3">
              <svg className="animate-spin w-4 h-4" style={{ color: 'var(--primary)' }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading more invoices…</span>
            </div>
          )}
          {!loadingMore && !hasMore && allInvoices.length > 0 && (
            <div className="text-center py-2" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>— All {allInvoices.length} invoices loaded —</div>
          )}

          {/* Analytics hint */}
          {allInvoices.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary-ring)', borderRadius: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>View FY-wise revenue, client breakdown, GST analysis, and download reports</div>
              <button onClick={() => setViewMode('analytics')} className="act-btn flex-shrink-0"
                style={{ background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border-strong)', padding: '6px 12px' }}>
                Open Analytics {UIIcons.arrowRight(12)}
              </button>
            </div>
          )}

        </div>
        </div>
      )}

      {/* ── Client History Panel ── */}
      {clientFilter && (
        <div className="fixed inset-0 z-40 flex" style={{ background: 'rgba(11,17,32,0.45)', backdropFilter: 'blur(3px)' }} onClick={() => setClientFilter(null)}>
          <div className="ml-auto w-full max-w-2xl h-full flex flex-col animate-slide-in-right"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-xl)', borderLeft: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <Avatar name={clientFilter} size={38} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{clientFilter}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Invoice History</div>
                </div>
              </div>
              <button onClick={() => setClientFilter(null)} aria-label="Close"
                className="flex items-center justify-center transition-all hover:bg-[var(--surface-2)]"
                style={{ width: 30, height: 30, borderRadius: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {UIIcons.x(14)}
              </button>
            </div>

            {clientLoading ? (
              <div className="flex-1 flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" style={{ color: 'var(--primary)' }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading history…</span>
              </div>
            ) : (
              <>
                {clientInvs.length > 0 && (() => {
                  // Exclude cancelled from all calculations
                  const activeCI   = clientInvs.filter(i => i.status !== 'CANCELLED');
                  const cancelledCI = clientInvs.filter(i => i.status === 'CANCELLED');
                  const total      = activeCI.reduce((a, i) => a + (i.grandTotal || 0), 0);
                  const collected  = activeCI.reduce((a, i) => a + (i.paidAmount  || 0), 0);
                  const tdsTotal   = activeCI.reduce((a, i) => a + (i.tdsAmount   || 0), 0);
                  const sub        = activeCI.reduce((a, i) => a + (i.subtotal    || 0), 0);
                  const gst        = activeCI.reduce((a, i) => a + (i.totalGst    || 0), 0);
                  const pending    = activeCI
                    .filter(i => ['DRAFT','SENT','PARTIAL'].includes(i.status))
                    .reduce((a, i) => {
                      if (i.status === 'DRAFT') return a + (i.grandTotal || 0);
                      return a + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - (i.tdsAmount || 0));
                    }, 0);

                  // Company-wise TDS
                  const coTdsMap: Record<string, { name: string; tdsAmount: number; count: number }> = {};
                  activeCI.filter(i => (i.tdsAmount || 0) > 0).forEach(i => {
                    const key  = i._companyId || clientHistCid;
                    const name = i._companyName || companies.find((c: any) => c.companyId === key)?.name || 'Company';
                    if (!coTdsMap[key]) coTdsMap[key] = { name, tdsAmount: 0, count: 0 };
                    coTdsMap[key].tdsAmount += i.tdsAmount || 0;
                    coTdsMap[key].count     += 1;
                  });
                  const coTdsRows = Object.values(coTdsMap).sort((a, b) => b.tdsAmount - a.tdsAmount);

                  return (
                    <>
                      {/* Stats cards */}
                      <div className="grid grid-cols-3 gap-2 px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                        {[
                          { label: 'Total Revenue', value: inr(total),     color: 'var(--text)',        note: `${activeCI.length} invoices` },
                          { label: 'Collected',      value: inr(collected), color: 'var(--success-ink)', note: `${activeCI.filter(i=>i.status==='PAID').length} paid` },
                          { label: 'Pending',        value: inr(pending),   color: 'var(--warning-ink)', note: 'Draft + Sent + Partial' },
                          { label: 'Total GST',      value: inr(gst),       color: 'var(--secondary)',   note: `Sub ${inr(sub)}` },
                          { label: 'TDS Deducted',   value: inr(tdsTotal),  color: '#8B5CF6',            note: `${activeCI.filter(i=>(i.tdsAmount||0)>0).length} invoices` },
                          { label: 'Cancelled',      value: String(cancelledCI.length), color: 'var(--text-3)', note: 'excluded from totals' },
                        ].map(s => (
                          <div key={s.label} className="px-3 py-2.5" style={{ background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{s.note}</div>
                          </div>
                        ))}
                      </div>

                      {/* Company-wise TDS (only when TDS exists) */}
                      {tdsTotal > 0 && (
                        <div className="px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Company-wise TDS</div>
                          <div className="flex flex-col gap-1.5">
                            {coTdsRows.map((row, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs">
                                <span className="flex-1 truncate" style={{ fontWeight: 500, color: 'var(--text-2)' }}>{row.name}</span>
                                <span style={{ color: 'var(--text-3)' }}>{row.count} inv.</span>
                                <span className="text-right" style={{ fontWeight: 700, color: '#8B5CF6', width: 96 }}>{inr(row.tdsAmount)}</span>
                                <div className="flex-shrink-0" style={{ width: 64, height: 6, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden' }}>
                                  <div style={{ height: 6, background: '#8B5CF6', borderRadius: 9999, width: `${tdsTotal > 0 ? (row.tdsAmount / tdsTotal) * 100 : 0}%` }} />
                                </div>
                                <span className="text-right" style={{ color: 'var(--text-3)', width: 40 }}>{tdsTotal > 0 ? `${((row.tdsAmount / tdsTotal) * 100).toFixed(0)}%` : '—'}</span>
                              </div>
                            ))}
                            <div className="flex items-center gap-3 text-xs pt-1.5 mt-0.5" style={{ borderTop: '1px solid var(--border)' }}>
                              <span className="flex-1" style={{ fontWeight: 700, color: 'var(--text)' }}>Total TDS</span>
                              <span className="text-right" style={{ fontWeight: 700, color: '#8B5CF6', width: 96 }}>{inr(tdsTotal)}</span>
                              <div className="flex-shrink-0" style={{ width: 64 }} />
                              <span style={{ width: 40 }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Invoice list */}
                <div className="flex-1 overflow-y-auto">
                  {clientInvs.length === 0 ? (
                    <div className="py-16 text-center text-sm" style={{ color: 'var(--text-3)' }}>No invoices found for this client</div>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-2)' }}>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Invoice #', 'Date', 'Amount', 'TDS', 'Status', 'Due Date', cid === 'ALL' ? 'Company' : '', ''].filter(Boolean).map(h => (
                            <th key={h} className="tbl-th" style={{ padding: '10px 12px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {clientInvs.map((inv: any) => {
                          const isCancelled = inv.status === 'CANCELLED';
                          const isOverdue   = inv.status === 'SENT' && inv.dueDate && new Date(inv.dueDate) < new Date();
                          const displayS    = isOverdue ? 'OVERDUE' : inv.status;
                          return (
                            <tr key={inv.invoiceId}
                              style={{ borderBottom: '1px solid var(--border)', opacity: isCancelled ? 0.45 : 1, transition: 'background 0.12s' }}
                              onMouseEnter={e => { if (!isCancelled) e.currentTarget.style.background = 'var(--surface-2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                              <td className="px-3 py-2.5">
                                <button onClick={() => { setClientFilter(null); setTimeout(() => setPreviewInv(inv), 50); }}
                                  className="font-mono hover:underline"
                                  style={{ fontWeight: 700, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isCancelled ? 'var(--text-3)' : 'var(--primary)', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                  {inv.invoiceNumber}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-2)' }}>{dateStr(inv.invoiceDate || inv.createdAt)}</td>
                              <td className="px-3 py-2.5">
                                <div style={{ fontWeight: 700, color: isCancelled ? 'var(--text-3)' : 'var(--text)', textDecoration: isCancelled ? 'line-through' : 'none' }}>{inr(inv.grandTotal)}</div>
                                {inv.totalGst > 0 && !isCancelled && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+GST {inr(inv.totalGst)}</div>}
                                {inv.paidAmount > 0 && !isCancelled && <div style={{ fontSize: 10, color: 'var(--success-ink)' }}>Paid {inr(inv.paidAmount)}</div>}
                              </td>
                              <td className="px-3 py-2.5">
                                {(inv.tdsAmount || 0) > 0 && !isCancelled ? (
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#8B5CF6' }}>{inr(inv.tdsAmount)}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{inv.tdsRate}%</div>
                                  </div>
                                ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                              </td>
                              <td className="px-3 py-2.5"><StatusBadge s={displayS} /></td>
                              <td className="px-3 py-2.5">
                                <div style={{ fontSize: 11.5, fontWeight: isOverdue ? 700 : 400, color: isOverdue ? 'var(--danger-ink)' : 'var(--text-2)' }}>{dateStr(inv.dueDate)}</div>
                              </td>
                              {cid === 'ALL' && (
                                <td className="px-3 py-2.5">
                                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, background: 'var(--primary-soft)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{inv._companyName}</span>
                                </td>
                              )}
                              <td className="px-3 py-2.5">
                                {!isCancelled && (
                                  <div className="flex gap-1">
                                    {inv.status !== 'DRAFT' && (
                                      <button onClick={() => { setClientFilter(null); setTimeout(() => setPreviewInv(inv), 50); }}
                                        className="act-btn" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 10, padding: '3px 8px' }}>PDF</button>
                                    )}
                                    {!['PAID','CANCELLED'].includes(inv.status) && (
                                      <button onClick={() => { setClientFilter(null); setTimeout(() => setPaidInv(inv), 50); }}
                                        className="act-btn" style={{ background: 'var(--success-soft)', color: 'var(--success-ink)', fontSize: 10, padding: '3px 8px' }}>Paid</button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Footer totals — active only */}
                      {clientInvs.filter(i => i.status !== 'CANCELLED').length > 0 && (() => {
                        const activeCI = clientInvs.filter(i => i.status !== 'CANCELLED');
                        const footTotal = activeCI.reduce((a, i) => a + (i.grandTotal || 0), 0);
                        const footTds   = activeCI.reduce((a, i) => a + (i.tdsAmount  || 0), 0);
                        const footPaid  = activeCI.reduce((a, i) => a + (i.paidAmount || 0), 0);
                        return (
                          <tfoot>
                            <tr className="text-xs" style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border-strong)', fontWeight: 600 }}>
                              <td className="px-3 py-2.5" style={{ color: 'var(--text-2)' }}>Total ({activeCI.length})</td>
                              <td className="px-3 py-2.5" style={{ color: 'var(--text-3)' }}>excl. cancelled</td>
                              <td className="px-3 py-2.5" style={{ fontWeight: 700, color: 'var(--text)' }}>{inr(footTotal)}</td>
                              <td className="px-3 py-2.5" style={{ fontWeight: 700, color: '#8B5CF6' }}>{footTds > 0 ? inr(footTds) : '—'}</td>
                              <td colSpan={cid === 'ALL' ? 4 : 3} className="px-3 py-2.5" style={{ color: 'var(--success-ink)' }}>{inr(footPaid)} paid</td>
                            </tr>
                          </tfoot>
                        );
                      })()}
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {previewInv && <PdfModal    inv={previewInv} cid={previewInv._companyId || cid} onClose={() => setPreviewInv(null)} />}
      {paidInv    && <PaidModal   inv={paidInv}    cid={paidInv._companyId    || cid} onClose={() => setPaidInv(null)}   onDone={loadInvoices} />}
      {editInv    && <EditModal   inv={editInv}    cid={editInv._companyId    || cid} onClose={() => setEditInv(null)}   onDone={loadInvoices} isSuperAdmin={isSuperAdmin} />}
      {cancelInv  && <CancelModal inv={cancelInv}  cid={cancelInv._companyId  || cid} onClose={() => setCancelInv(null)} onDone={loadInvoices} />}
      {assignInv  && <AssignModal inv={assignInv}  cid={assignInv._companyId  || cid} onClose={() => setAssignInv(null)} onDone={loadInvoices} />}

      {/* ── Create Invoice ── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Invoice" size="xl"
        footer={<><Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={create}>Create Invoice</Btn></>}>
        <div className="flex flex-col gap-4">

          {/* Billing Company selector (ALL mode) or profile preview (single mode) */}
          {cid === 'ALL' ? (
            <div className="flex flex-col gap-1.5">
              <label style={{ ...lbl, marginBottom: 0 }}>Billing Company *</label>
              <select value={createCo} onChange={e => setCreateCo(e.target.value)} className="fld">
                <option value="">— Select company to invoice from —</option>
                {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
              </select>
            </div>
          ) : coProfile?.name && (
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary-ring)', borderRadius: 14 }}>
              {coProfile.logo
                ? <img src={coProfile.logo} alt="" className="h-10 w-10 rounded-lg object-contain flex-shrink-0 p-1" style={{ background: '#fff', border: '1px solid var(--border)' }} />
                : <div className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--grad-brand)', color: '#fff', fontWeight: 700, fontSize: 13 }}>{coProfile.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
              }
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{coProfile.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{coProfile.gst ? `GSTIN: ${coProfile.gst}` : ''} {coProfile.email || ''}</div>
                {(coProfile.address?.city || coProfile.address?.state) && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{[coProfile.address?.city, coProfile.address?.state].filter(Boolean).join(', ')}</div>
                )}
              </div>
              <div className="flex-shrink-0" style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>Billing Company ✓</div>
            </div>
          )}

          {/* Client Search / Bill To */}
          <div>
            <div style={sectionLbl}>Client / Bill To</div>

            {/* Lead search */}
            <div className="relative mb-3">
              <label style={lbl}>
                Select Saved Client
                <a href="/dashboard/clients" target="_blank" className="ml-2 hover:underline" style={{ color: 'var(--primary)', fontWeight: 500 }}>+ Add New Client</a>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>{UIIcons.search(13)}</span>
                <input
                  className="fld"
                  style={{ paddingLeft: 32, paddingRight: 32 }}
                  placeholder="Search clients by name, email, or GST..."
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); }}
                  onFocus={() => setShowClientDrop(true)}
                  onBlur={() => setTimeout(() => setShowClientDrop(false), 150)}
                />
                {clientSearch && (
                  <button onClick={() => { setClientSearch(''); setShowClientDrop(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>✕</button>
                )}
              </div>
              {clients.length === 0 && !clientSearch && (
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>No saved clients yet. <a href="/dashboard/clients" target="_blank" className="hover:underline" style={{ color: 'var(--primary)' }}>Add clients here</a>, or fill manually below.</p>
              )}
              {showClientDrop && clients.filter(c => (c.name||'').toLowerCase().includes(clientSearch.toLowerCase()) || (c.email||'').toLowerCase().includes(clientSearch.toLowerCase()) || (c.gst||'').toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8).length > 0 && (
                <div className="pop-panel absolute z-30 top-full mt-1 left-0 right-0 overflow-hidden" style={{ transformOrigin: 'top center' }}>
                  {clients.filter(c => (c.name||'').toLowerCase().includes(clientSearch.toLowerCase()) || (c.email||'').toLowerCase().includes(clientSearch.toLowerCase()) || (c.gst||'').toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8).map((c: any) => (
                    <button key={c.clientId} onMouseDown={() => selectLead(c)}
                      className="w-full text-left px-4 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                      <div className="flex gap-3 flex-wrap" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                        {c.email && <span>{c.email}</span>}
                        {c.phone && <span>{c.phone}</span>}
                        {c.gst   && <span className="font-mono">GST: {c.gst}</span>}
                        {(c.city || c.state) && <span>{[c.city, c.state].filter(Boolean).join(', ')}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Client Name *"    value={form.clientName}    onChange={e => setForm(f => ({ ...f, clientName:    e.target.value }))} placeholder="Rahul Sharma / Ariya Corp" />
              <Input label="Client GSTIN"     value={form.clientGst}     onChange={e => setForm(f => ({ ...f, clientGst:     e.target.value }))} placeholder="27AAAA0000A1Z5" />
              <Input label="Client Email"     value={form.clientEmail}   onChange={e => setForm(f => ({ ...f, clientEmail:   e.target.value }))} placeholder="client@example.com" />
              <Input label="Client Phone"     value={form.clientPhone}   onChange={e => setForm(f => ({ ...f, clientPhone:   e.target.value }))} placeholder="+91 98765 43210" />
            </div>
            <div className="mt-3">
              <Input label="Billing Address"  value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))} placeholder="123 Park, Mumbai, Maharashtra 400001" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Invoice Date" type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} />
            <Input label="Due Date" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            <Sel label="Payment Terms" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
              options={[{value:'Net 30',label:'Net 30'},{value:'Net 15',label:'Net 15'},{value:'Net 7',label:'Net 7'},{value:'Due on Receipt',label:'Due on Receipt'},{value:'50% Advance',label:'50% Advance'}]} />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div style={{ ...sectionLbl, marginBottom: 0 }}>Line Items</div>
              <button onClick={() => setForm(f => ({ ...f, items: [...f.items, BLANK()] }))}
                className="hover:underline" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>+ Add Item</button>
            </div>
            <LineItemsTable items={form.items} updItem={updItem} removeItem={(i: number) => setForm(f => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }))} />
            <TotalsBlock subtotal={subtotal} gstByRate={formGstByRate} grandTotal={grandTotal} />
          </div>

          {/* Bank details — auto-filled from settings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div style={{ ...sectionLbl, marginBottom: 0 }}>Bank Details (shown on PDF)</div>
              {form.bankDetails.bankName && <span style={{ fontSize: 10.5, color: 'var(--success-ink)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>✓ Auto-filled from Settings</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Bank Name"      value={form.bankDetails.bankName}      onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, bankName:      e.target.value } }))} placeholder="HDFC Bank" />
              <Input label="Account Name"   value={form.bankDetails.accountName}   onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, accountName:   e.target.value } }))} placeholder="Raulji Technologies" />
              <Input label="Account Number" value={form.bankDetails.accountNumber} onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, accountNumber: e.target.value } }))} placeholder="50100123456789" />
              <Input label="IFSC Code"      value={form.bankDetails.ifsc}          onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, ifsc:          e.target.value } }))} placeholder="HDFC0001234" />
              <Input label="UPI ID"         value={form.bankDetails.upiId || ''}   onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, upiId:         e.target.value } }))} placeholder="raulji@hdfc" className="col-span-2" />
            </div>
            {!form.bankDetails.bankName && (
              <div className="mt-2 px-3 py-2" style={{ fontSize: 11.5, color: 'var(--text-2)', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                💡 Save bank details in <strong>Settings → Billing Details</strong> to auto-fill here every time.
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="fld" style={{ resize: 'none', fontSize: 12 }} placeholder="Thank you for your business. Payment within due date is appreciated." />
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
