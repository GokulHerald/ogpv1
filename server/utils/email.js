const nodemailer = require('nodemailer');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

let cached = null;

function getTransporter() {
  if (cached) return cached;
  const user = requireEnv('SMTP_USER');
  const pass = requireEnv('SMTP_PASS');

  cached = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return cached;
}

async function sendOtpEmail({ to, otp, firstName }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appName = process.env.APP_NAME || 'OGP';

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `${appName} <${from}>`,
    to,
    subject: `${appName} verification code`,
    text: `Your ${appName} verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <p>Hi${firstName ? ` ${String(firstName)}` : ''},</p>
        <p>Your <strong>${appName}</strong> verification code is:</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:16px 0">${otp}</p>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#666;font-size:12px;margin-top:24px">If you didn’t request this, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };

