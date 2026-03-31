// backend/services/emailService.js
// Brevo (Sendinblue) SMTP via nodemailer

const nodemailer = require('nodemailer');

let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port:   Number(process.env.BREVO_SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER || '',
      pass: process.env.BREVO_SMTP_PASS || '',
    },
  });
  return _transporter;
};

const FROM = () =>
  `"${process.env.BREVO_FROM_NAME || 'CRM'}" <${process.env.BREVO_FROM_EMAIL || 'noreply@example.com'}>`;

const isConfigured = () =>
  !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS);

// ── Send OTP for password reset ────────────────────────────────
exports.sendOtp = async ({ to, name, otp }) => {
  if (!isConfigured()) {
    console.warn('[email] Brevo not configured — OTP not sent. OTP:', otp);
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
    console.warn('[email] Brevo not configured — invite not sent. Token:', inviteToken);
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
    console.warn('[email] Brevo not configured — invoice email not sent.');
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
