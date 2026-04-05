import nodemailer from "nodemailer";
import crypto from "crypto";
import { logger } from "./logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT ?? 587) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function verifyOtp(plain: string, hash: string): boolean {
  return hashOtp(plain) === hash;
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "FF Arena <noreply@ffarena.com>";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { margin: 0; padding: 0; background: #0A0A0F; font-family: 'Courier New', monospace; color: #e0e0e0; }
          .wrapper { max-width: 520px; margin: 40px auto; background: #111118; border: 1px solid #00F5FF44; border-radius: 8px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #00F5FF22, #39FF1422); padding: 32px 24px; text-align: center; border-bottom: 1px solid #00F5FF33; }
          .header h1 { margin: 0; font-size: 22px; letter-spacing: 4px; color: #00F5FF; text-transform: uppercase; }
          .header p { margin: 8px 0 0; font-size: 12px; color: #888; letter-spacing: 2px; }
          .body { padding: 32px 24px; }
          .otp-box { background: #0A0A0F; border: 2px solid #39FF1466; border-radius: 6px; padding: 24px; text-align: center; margin: 24px 0; }
          .otp { font-size: 44px; font-weight: bold; letter-spacing: 12px; color: #39FF14; text-shadow: 0 0 12px #39FF1466; }
          .expiry { font-size: 12px; color: #888; margin-top: 12px; }
          .note { font-size: 12px; color: #666; margin-top: 24px; line-height: 1.6; }
          .footer { background: #0A0A0F; padding: 16px 24px; text-align: center; font-size: 11px; color: #444; border-top: 1px solid #ffffff11; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>⚔ FF Arena</h1>
            <p>Email Verification</p>
          </div>
          <div class="body">
            <p>Use the OTP below to verify your email address and activate your account.</p>
            <div class="otp-box">
              <div class="otp">${otp}</div>
              <div class="expiry">Expires in 5 minutes</div>
            </div>
            <p class="note">
              Do not share this OTP with anyone. If you did not request this, please ignore this email — your account is safe.
            </p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} FF Arena. Built for competitive mobile gamers.</div>
        </div>
      </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: "FF Arena — Email Verification OTP",
      html,
      text: `Your FF Arena verification OTP is: ${otp}\n\nThis OTP expires in 5 minutes. Do not share it with anyone.`,
    });
    logger.info({ email }, "OTP email sent");
  } catch (err) {
    logger.error({ err, email }, "Failed to send OTP email");
    throw err;
  }
}
