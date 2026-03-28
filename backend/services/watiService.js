// backend/services/watiService.js
// WhatsApp automation via WATI (https://wati.io)
// If WATI_API_ENDPOINT is not set, all sends are simulated (dev mode).

const ENDPOINT = process.env.WATI_API_ENDPOINT || '';
const TOKEN    = process.env.WATI_API_TOKEN    || '';

async function _watiRequest(method, path, data = null) {
  if (!ENDPOINT) return null; // simulation mode
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  const json = await res.json().catch(() => ({}));
  return json;
}

// Send a plain text session message (within 24h window)
exports.sendSessionMessage = async (phone, body) => {
  // Normalise phone: strip + and spaces, ensure no leading zeros
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (!ENDPOINT) {
    console.log(`[WATI SIMULATION] → ${cleanPhone}: ${body.slice(0, 80)}`);
    return { messageId: `sim_${Date.now()}`, simulated: true };
  }
  const result = await _watiRequest('POST', '/api/v1/sendSessionMessage', {
    whatsappNumber: cleanPhone,
    messageText: body
  });
  return { messageId: result?.id || result?.messageId || null, raw: result };
};

// Send a pre-approved template message
exports.sendTemplateMessage = async (phone, templateName, parameters = []) => {
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (!ENDPOINT) {
    console.log(`[WATI SIMULATION] TEMPLATE ${templateName} → ${cleanPhone}`, parameters);
    return { messageId: `sim_tmpl_${Date.now()}`, simulated: true };
  }
  const result = await _watiRequest('POST', '/api/v1/sendTemplateMessage', {
    whatsappNumber: cleanPhone,
    template_name: templateName,
    broadcast_name: `crm_${Date.now()}`,
    parameters: parameters.map((v, i) => ({ name: String(i + 1), value: String(v) }))
  });
  return { messageId: result?.id || null, raw: result };
};

// Parse inbound WATI webhook payload
exports.parseInboundWebhook = (payload) => {
  // WATI webhook format: { waId, text: { body }, timestamp, from }
  const phone   = payload?.waId || payload?.from || '';
  const body    = payload?.text?.body || payload?.body || '';
  const msgId   = payload?.id || '';
  const ts      = payload?.timestamp ? new Date(payload.timestamp * 1000) : new Date();
  return { phone, body, messageId: msgId, timestamp: ts };
};

exports.isConfigured = () => Boolean(ENDPOINT && TOKEN);
