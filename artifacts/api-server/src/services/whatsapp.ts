import { db, adminConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const NOTIFY_PHONE = "917777915823";

async function getApiKey(): Promise<string | null> {
  const [row] = await db.select().from(adminConfigTable).where(eq(adminConfigTable.key, "whatsapp_api_key"));
  return row?.value ?? null;
}

export async function sendWhatsAppNotification(message: string): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${NOTIFY_PHONE}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn("[WhatsApp] Notification failed, status:", res.status);
    }
  } catch (err) {
    console.warn("[WhatsApp] Notification error:", err);
  }
}

export async function notifyDeposit(opts: {
  playerName: string;
  amount: number;
  ref: string;
  method: string;
}): Promise<void> {
  const msg =
    `💰 *FF Arena — New Deposit Request*\n` +
    `Player: ${opts.playerName}\n` +
    `Amount: ₹${opts.amount}\n` +
    `Method: ${opts.method}\n` +
    `Ref/UTR: ${opts.ref}\n` +
    `⏳ Awaiting admin approval.`;
  await sendWhatsAppNotification(msg);
}

export async function notifyWithdrawal(opts: {
  playerName: string;
  amount: number;
  upiId: string;
}): Promise<void> {
  const msg =
    `🏧 *FF Arena — Withdrawal Request*\n` +
    `Player: ${opts.playerName}\n` +
    `Amount: ₹${opts.amount}\n` +
    `UPI ID: ${opts.upiId}\n` +
    `⚡ Please process within 24 hours.`;
  await sendWhatsAppNotification(msg);
}
