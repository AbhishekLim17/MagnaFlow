/**
 * Gmail sender, shared by the queue drainer and the daily reminder job.
 *
 * Replaces EmailJS. EmailJS existed because a browser cannot speak SMTP — it
 * relays on the browser's behalf, which meant a sending credential had to be
 * reachable from client code. That is how the private key ended up in the
 * bundle and then in a public repo. Sending now happens only here, in GitHub
 * Actions, where the credential is a repository secret the browser never sees.
 *
 * Auth is a Gmail App Password (Google Account -> Security -> 2-Step
 * Verification -> App passwords), not the account password. It is scoped to
 * this one use and can be revoked on its own.
 *
 * Quota: a consumer Gmail account allows roughly 500 recipients/day, Workspace
 * roughly 2,000. The queue drainer counts what it sends so a runaway loop shows
 * up in the job log rather than silently getting the account rate-limited.
 */
const nodemailer = require('nodemailer');

const REQUIRED = ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];

function assertConfigured() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(
      `Missing required environment variable(s): ${missing.join(', ')}\n` +
        'Add them as repository secrets. GMAIL_APP_PASSWORD is a 16-character\n' +
        'App Password from Google Account -> Security -> App passwords, not the\n' +
        'account password.'
    );
    process.exit(2);
  }
}

function createTransport() {
  assertConfigured();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      // App Passwords are shown with spaces for readability; Gmail wants them
      // without. Stripping here means either form works in the secret.
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ''),
    },
  });
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Render the notification template.
 *
 * Mirrors the field names the EmailJS template used (notification_type, title,
 * detail_N_label/value, button_text, ...) so queued payloads written by the
 * browser did not have to change shape.
 */
function renderHtml(data) {
  const rows = [1, 2, 3, 4, 5]
    .map((n) => ({ label: data[`detail_${n}_label`], value: data[`detail_${n}_value`] }))
    .filter((row) => row.label && String(row.label).trim())
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eef0f6;color:#6b7280;font-size:14px;width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eef0f6;color:#101223;font-size:14px;font-weight:600;">${escapeHtml(row.value)}</td>
        </tr>`
    )
    .join('');

  const accent = /^#[0-9a-f]{3,8}$/i.test(String(data.notification_color || ''))
    ? data.notification_color
    : '#3e30d9';

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef0f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(16,18,35,.08);">
        <tr><td style="background:${accent};padding:24px 28px;color:#ffffff;font-size:18px;font-weight:700;">
          ${escapeHtml(data.notification_icon || '')} ${escapeHtml(data.notification_type || 'Notification')}
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 6px;color:#101223;font-size:20px;font-weight:700;">${escapeHtml(data.title || '')}</p>
          <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.55;">${escapeHtml(data.message || '')}</p>
          ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ''}
          ${
            data.button_link
              ? `<p style="margin:26px 0 0;"><a href="${escapeHtml(data.button_link)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:12px;font-size:14px;font-weight:600;">${escapeHtml(data.button_text || 'Open MagnaFlow')}</a></p>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:18px 28px 26px;border-top:1px solid #eef0f6;color:#6b7280;font-size:12px;line-height:1.5;">
          ${escapeHtml(data.footer_text || '')}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:11px;">Sent by MagnaFlow</p>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(data) {
  const details = [1, 2, 3, 4, 5]
    .map((n) => ({ label: data[`detail_${n}_label`], value: data[`detail_${n}_value`] }))
    .filter((row) => row.label && String(row.label).trim())
    .map((row) => `${row.label}: ${row.value}`)
    .join('\n');

  return [
    `${data.notification_type || 'Notification'}`,
    '',
    data.title || '',
    data.message || '',
    '',
    details,
    '',
    data.button_link ? `${data.button_text || 'Open'}: ${data.button_link}` : '',
    '',
    data.footer_text || '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {import('nodemailer').Transporter} transport
 * @param {Object} data payload in the EmailJS template shape
 */
async function sendNotification(transport, data) {
  if (!data.to_email) throw new Error('to_email is required');

  return transport.sendMail({
    from: `"MagnaFlow" <${process.env.GMAIL_USER}>`,
    to: data.to_email,
    cc: data.cc_email || undefined,
    subject: `${data.notification_type ? `[${data.notification_type}] ` : ''}${data.title || 'MagnaFlow notification'}`,
    text: renderText(data),
    html: renderHtml(data),
  });
}

module.exports = { createTransport, sendNotification, renderHtml, renderText, escapeHtml };
