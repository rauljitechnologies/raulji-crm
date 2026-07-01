// backend/services/emailService.js
// Gmail SMTP via nodemailer.
// Logs in as SMTP_USER (rauljigroup@gmail.com, using a Gmail App Password) but
// sends "From" SMTP_FROM (admin@raulji.com) — that address must be a verified
// "Send mail as" alias on the Gmail account, or Gmail rewrites From to SMTP_USER.

const nodemailer = require('nodemailer');

let _transporter = null;

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const getTransporter = () => {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: SMTP_PORT === 465, // implicit TLS on 465, STARTTLS otherwise
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transporter;
};

const FROM = () => {
  const name  = process.env.SMTP_FROM_NAME || 'CRM';
  const email = process.env.SMTP_FROM || SMTP_USER || 'noreply@example.com';
  return `"${name}" <${email}>`;
};

const isConfigured = () => !!(SMTP_USER && SMTP_PASS);

// ── Send OTP for password reset ────────────────────────────────
exports.sendOtp = async ({ to, name, otp }) => {
  if (!isConfigured()) {
    console.warn('[email] SMTP not configured — OTP not sent. OTP:', otp);
    return;
  }
  await getTransporter().sendMail({
    from:    FROM(),
    to,
    subject: 'Your Password Reset OTP',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:8px">
        <h2 style="color:#1e293b;margin-bottom:8px">Password Reset</h2>
        <p style="color:#475569">Hi ${name || 'there'},</p>
        <p style="color:#475569">Use this OTP to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#4f46e5;text-align:center;padding:16px 0">${otp}</div>
        <p style="color:#94a3b8;font-size:12px">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
};

// ── Send user invite ───────────────────────────────────────────
exports.sendInvite = async ({ to, name, inviteToken, companyName }) => {
  if (!isConfigured()) {
    console.warn('[email] SMTP not configured — invite not sent. Token:', inviteToken);
    return;
  }
  const baseUrl   = process.env.FRONTEND_URL || 'http://localhost:3000';
  const inviteUrl = `${baseUrl}/accept-invite?token=${inviteToken}`;
  await getTransporter().sendMail({
    from:    FROM(),
    to,
    subject: `You've been invited to ${companyName || 'CRM'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:8px">
        <h2 style="color:#1e293b;margin-bottom:8px">You're invited!</h2>
        <p style="color:#475569">Hi ${name},</p>
        <p style="color:#475569">You've been added to <strong>${companyName || 'CRM'}</strong>. Click below to set up your account.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${inviteUrl}" style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">Accept Invite</a>
        </div>
        <p style="color:#94a3b8;font-size:12px">This link expires in 7 days. If you weren't expecting this, ignore this email.</p>
      </div>
    `,
  });
};

// ── Send invoice to client ─────────────────────────────────────
exports.sendInvoiceEmail = async ({ to, clientName, invoiceNumber, grandTotal, currency, dueDate, pdfBuffer, companyName }) => {
  if (!isConfigured()) {
    console.warn('[email] SMTP not configured — invoice email not sent.');
    return;
  }
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(n);
  const due = dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  const mailOpts = {
    from:    FROM(),
    to,
    subject: `Invoice ${invoiceNumber} from ${companyName || 'Us'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:8px">
        <h2 style="color:#1e293b;margin-bottom:4px">Invoice ${invoiceNumber}</h2>
        <p style="color:#475569">Hi ${clientName},</p>
        <p style="color:#475569">Please find your invoice attached. Here's a summary:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#64748b">Invoice #</td><td style="padding:8px;font-weight:600;color:#1e293b">${invoiceNumber}</td></tr>
          <tr style="background:#fff"><td style="padding:8px;color:#64748b">Amount Due</td><td style="padding:8px;font-weight:700;color:#4f46e5;font-size:18px">${fmt(grandTotal)}</td></tr>
          ${due ? `<tr><td style="padding:8px;color:#64748b">Due Date</td><td style="padding:8px;color:#ef4444;font-weight:600">${due}</td></tr>` : ''}
        </table>
        <p style="color:#94a3b8;font-size:12px">Please reply to this email if you have any questions.</p>
      </div>
    `,
  };

  if (pdfBuffer) {
    mailOpts.attachments = [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
  }

  await getTransporter().sendMail(mailOpts);
};
