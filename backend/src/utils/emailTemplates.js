const FOREST = '#183D32';
const IVORY = '#F5F0E6';
const GOLD = '#C5A46D';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout({ heading, paragraphs, buttonLabel, link, footnote }) {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2B2B2B;">${p}</p>`)
    .join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${IVORY};font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF8;border:1px solid #E4DCCB;">
          <tr><td style="background:${FOREST};padding:28px 32px;">
            <span style="font-size:24px;letter-spacing:1px;color:${IVORY};">Book<span style="color:${GOLD};">Tracker</span></span>
          </td></tr>
          <tr><td style="padding:36px 32px 12px;">
            <h1 style="margin:0 0 20px;font-size:26px;font-weight:normal;color:${FOREST};">${heading}</h1>
            ${body}
            <p style="margin:28px 0;">
              <a href="${link}" style="display:inline-block;background:${FOREST};color:${IVORY};text-decoration:none;padding:14px 28px;font-size:15px;letter-spacing:0.5px;border-bottom:3px solid ${GOLD};">${buttonLabel}</a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6B6458;">If the button does not work, copy this link into your browser:</p>
            <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${link}" style="color:${FOREST};">${link}</a></p>
          </td></tr>
          <tr><td style="padding:20px 32px 28px;border-top:1px solid #E4DCCB;font-size:12px;line-height:1.6;color:#8A8274;">${footnote}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function verificationEmail({ name, link, hours }) {
  const safeName = escapeHtml(name);
  return {
    subject: 'Confirm your email address for BookTracker',
    text:
      `Hello ${name},\n\n` +
      `Welcome to BookTracker. Please confirm your email address by opening this link:\n${link}\n\n` +
      `The link expires in ${hours} hours. If you did not create an account, you can ignore this email.`,
    html: layout({
      heading: 'Welcome to your library',
      paragraphs: [
        `Hello ${safeName},`,
        'Thank you for joining BookTracker. Confirm your email address to open your personal library and start reading.',
      ],
      buttonLabel: 'Confirm my email',
      link,
      footnote: `This link expires in ${hours} hours. If you did not create a BookTracker account, you can safely ignore this email.`,
    }),
  };
}

function emailChangeEmail({ name, link, hours }) {
  const safeName = escapeHtml(name);
  return {
    subject: 'Confirm your new email address for BookTracker',
    text:
      `Hello ${name},\n\n` +
      `You asked to use this address for your BookTracker account. Confirm it by opening this link:\n${link}\n\n` +
      `The link expires in ${hours} hours. Until then, your previous address stays active. ` +
      'If you did not request this change, you can ignore this email.',
    html: layout({
      heading: 'Confirm your new address',
      paragraphs: [
        `Hello ${safeName},`,
        'You asked to use this email address for your BookTracker account. Confirm it below; until you do, your previous address stays active.',
      ],
      buttonLabel: 'Confirm new email',
      link,
      footnote: `This link expires in ${hours} hours. If you did not request this change, you can safely ignore this email.`,
    }),
  };
}

module.exports = { verificationEmail, emailChangeEmail };
