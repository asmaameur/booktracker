const nodemailer = require('nodemailer');
const env = require('./env');

const smtpConfigured = Boolean(env.smtp.host);

// Without SMTP settings (local development), emails are printed to the console
// so the verification link can still be opened by hand.
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

async function sendMail({ to, subject, text, html }) {
  const info = await transporter.sendMail({ from: env.mailFrom, to, subject, text, html });
  if (!smtpConfigured) {
    console.log(
      `\n[mail] SMTP is not configured, so this email was printed instead of sent.\n` +
        `  To: ${to}\n  Subject: ${subject}\n\n${text}\n`
    );
  }
  return info;
}

async function verifyConnection() {
  if (smtpConfigured) await transporter.verify();
}

module.exports = { sendMail, verifyConnection, smtpConfigured };
