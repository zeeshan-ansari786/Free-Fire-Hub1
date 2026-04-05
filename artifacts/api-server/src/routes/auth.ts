import { Router, type IRouter } from "express";
import { db, usersTable, emailOtpTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";
import { generateOtp, hashOtp, verifyOtp, sendOtpEmail } from "../lib/mailer";
import { logger } from "../lib/logger";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_RESEND_PER_EMAIL = 5;

interface PendingRegistration {
  username: string;
  passwordHash: string;
  freeFireUid: string;
  inGameName: string;
  whatsappNumber: string;
}

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// ── Register: store pending data + send OTP (user NOT created yet) ─────────────
router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password, freeFireUid, inGameName, whatsappNumber } = req.body;

  if (!username || !email || !password || !freeFireUid || !inGameName || !whatsappNumber) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  // Check if a verified user already exists with this email
  const [existingEmail] = await db
    .select({ id: usersTable.id, isVerified: usersTable.isVerified })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingEmail?.isVerified) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  // Check if a verified user already exists with this Free Fire UID
  const [existingUid] = await db
    .select({ id: usersTable.id, isVerified: usersTable.isVerified })
    .from(usersTable)
    .where(eq(usersTable.freeFireUid, freeFireUid));

  if (existingUid?.isVerified) {
    res.status(409).json({ error: "This Free Fire UID is already registered" });
    return;
  }

  const passwordHash = hashPassword(password);

  const pending: PendingRegistration = {
    username,
    passwordHash,
    freeFireUid,
    inGameName,
    whatsappNumber,
  };

  try {
    await createOtp(email, JSON.stringify(pending));
  } catch {
    res.status(500).json({ error: "Failed to send verification email. Please try again." });
    return;
  }

  res.status(200).json({
    message: "OTP sent to your email. Enter it to complete registration.",
    requiresVerification: true,
  });
});

// ── Verify OTP: create user (if registration) OR mark verified (if login resend) ─
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }

  const now = new Date();

  const [otpRecord] = await db
    .select()
    .from(emailOtpTable)
    .where(and(eq(emailOtpTable.email, email), gt(emailOtpTable.expiresAt, now)))
    .orderBy(emailOtpTable.createdAt)
    .limit(1);

  if (!otpRecord) {
    res.status(400).json({ error: "OTP has expired. Please request a new one." });
    return;
  }

  if (!verifyOtp(String(otp).trim(), otpRecord.otpHash)) {
    res.status(400).json({ error: "Invalid OTP. Please check and try again." });
    return;
  }

  // Clean up OTP records for this email
  await db.delete(emailOtpTable).where(eq(emailOtpTable.email, email));

  let user: typeof usersTable.$inferSelect;

  if (otpRecord.pendingData) {
    // ── NEW REGISTRATION: create the user now ──────────────────────────────────
    const pending = JSON.parse(otpRecord.pendingData) as PendingRegistration;

    // Final duplicate check (edge case: someone registered with same UID between OTP send and verify)
    const [dupe] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (dupe) {
      // Update to verified in case it's a leftover ghost row
      const [updated] = await db
        .update(usersTable)
        .set({ isVerified: true })
        .where(eq(usersTable.email, email))
        .returning();
      user = updated;
    } else {
      const [created] = await db
        .insert(usersTable)
        .values({
          username: pending.username,
          email,
          passwordHash: pending.passwordHash,
          freeFireUid: pending.freeFireUid,
          inGameName: pending.inGameName,
          whatsappNumber: pending.whatsappNumber,
          isVerified: true,
        })
        .returning();
      user = created;
    }
  } else {
    // ── EXISTING USER (login-triggered OTP): mark as verified ─────────────────
    const [updated] = await db
      .update(usersTable)
      .set({ isVerified: true })
      .where(eq(usersTable.email, email))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Account not found. Please register again." });
      return;
    }
    user = updated;
  }

  req.session.userId = user.id;
  logger.info({ userId: user.id, email }, "User verified and logged in");
  res.json({ user: formatUser(user), message: "Email verified successfully! Welcome to the arena." });
});

// ── Resend OTP ─────────────────────────────────────────────────────────────────
router.post("/auth/resend-otp", async (req, res): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  // Find any existing OTP record to check resend count and preserve pendingData
  const [existing] = await db
    .select()
    .from(emailOtpTable)
    .where(eq(emailOtpTable.email, email))
    .orderBy(emailOtpTable.createdAt)
    .limit(1);

  if (!existing) {
    // Also check if there's an unverified user (legacy path)
    const [user] = await db
      .select({ id: usersTable.id, isVerified: usersTable.isVerified })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (!user) {
      res.status(404).json({ error: "No pending registration found for this email. Please register again." });
      return;
    }
    if (user.isVerified) {
      res.status(400).json({ error: "This account is already verified. Please login." });
      return;
    }
  }

  // Enforce resend limit
  const totalResends = existing ? existing.resendCount + 1 : 0;
  if (totalResends >= MAX_RESEND_PER_EMAIL) {
    res.status(429).json({ error: "Too many OTP requests. Please wait a few minutes before trying again." });
    return;
  }

  const pendingData = existing?.pendingData ?? null;

  try {
    await createOtp(email, pendingData, totalResends);
  } catch {
    res.status(500).json({ error: "Failed to resend OTP. Please try again." });
    return;
  }

  res.json({ message: "A new OTP has been sent to your email." });
});

// ── Login ──────────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Your account has been banned. Contact support." });
    return;
  }

  if (!user.isVerified) {
    try {
      await createOtp(email, null);
    } catch {
      // Non-fatal
    }
    res.status(403).json({
      error: "Please verify your email first. A new OTP has been sent.",
      requiresVerification: true,
      email,
    });
    return;
  }

  req.session.userId = user.id;
  res.json({ user: formatUser(user), message: "Login successful" });
});

// ── Logout ─────────────────────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

// ── Get current user ───────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session expired. Please login again." });
    return;
  }

  if (user.isBanned) {
    req.session.destroy(() => {});
    res.status(403).json({ error: "Your account has been banned." });
    return;
  }

  res.json(formatUser(user));
});

// ── Helper: generate, store OTP (replace any existing) ────────────────────────
async function createOtp(
  email: string,
  pendingData: string | null,
  resendCount = 0,
): Promise<void> {
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.delete(emailOtpTable).where(eq(emailOtpTable.email, email));
  await db.insert(emailOtpTable).values({
    email,
    otpHash,
    expiresAt,
    resendCount,
    pendingData,
  });

  await sendOtpEmail(email, otp);
}

export default router;
