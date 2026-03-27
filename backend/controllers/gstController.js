// backend/controllers/gstController.js — GSTIN validation & lookup
'use strict';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const STATE_CODES = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan',
  '09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh',
  '13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura',
  '17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand',
  '21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
  '25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
  '28':'Andhra Pradesh (Old)','29':'Karnataka','30':'Goa','31':'Lakshadweep',
  '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar Islands',
  '36':'Telangana','37':'Andhra Pradesh',
};

// ── VALIDATE FORMAT ───────────────────────────────────────────
exports.validate = (req, res) => {
  const g = (req.params.gstin || '').toUpperCase().replace(/\s/g, '');
  if (!g) return res.status(400).json({ success: false, error: { message: 'GSTIN required.' } });

  if (!GSTIN_RE.test(g)) {
    return res.json({ success: true, data: {
      valid: false,
      gstin: g,
      message: g.length !== 15
        ? `GSTIN must be 15 characters (entered ${g.length})`
        : 'Invalid GSTIN format. Expected: 2 digits + 5 uppercase letters + 4 digits + letter + alphanumeric + Z + alphanumeric'
    }});
  }

  const stateCode = g.slice(0, 2);
  const pan       = g.slice(2, 12);
  const state     = STATE_CODES[stateCode] || 'Unknown State';

  return res.json({ success: true, data: {
    valid: true,
    gstin: g,
    stateCode,
    state,
    pan,
    entityType: g[12],
    message: `Valid GSTIN — ${state}`,
  }});
};

// ── LOOKUP (validate + fetch details from public NIC API) ─────
exports.lookup = async (req, res) => {
  const g = (req.params.gstin || '').toUpperCase().replace(/\s/g, '');
  if (!GSTIN_RE.test(g)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid GSTIN format.' } });
  }

  const stateCode = g.slice(0, 2);
  const pan       = g.slice(2, 12);
  const state     = STATE_CODES[stateCode] || '';
  const baseInfo  = { valid: true, gstin: g, stateCode, state, pan };

  try {
    // Try NIC public GST API (no auth required for basic lookup)
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch(
      `https://api.nic.in/gst/gstindetails/${g}`,
      { signal: ctrl.signal, headers: { Accept: 'application/json' } }
    ).finally(() => clearTimeout(timeout));

    if (resp.ok) {
      const json = await resp.json();
      if (json && json.taxpayerInfo) {
        const t = json.taxpayerInfo;
        const addr = t.pradr?.addr || {};
        const addrStr = [addr.bnm, addr.st, addr.loc, addr.dst, addr.stcd, addr.pncd].filter(Boolean).join(', ');
        return res.json({ success: true, data: {
          ...baseInfo,
          legalName:    t.lgnm  || '',
          tradeName:    t.tradeNam || t.lgnm || '',
          address:      addrStr,
          city:         addr.dst  || addr.loc || '',
          state:        addr.stcd || state,
          pincode:      addr.pncd || '',
          status:       t.sts    || '',
          regDate:      t.rgdt   || '',
          source:       'nic',
        }});
      }
    }
  } catch { /* fallback below */ }

  // Fallback: return info decoded from GSTIN itself
  return res.json({ success: true, data: {
    ...baseInfo,
    legalName: '',
    tradeName: '',
    address:   '',
    city:      '',
    pincode:   '',
    source:    'format_only',
    note:      'Live lookup unavailable. GSTIN format is valid.',
  }});
};
