import { Router, type IRouter } from "express";
import { db, usersTable, emailOtpTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";
import { generateOtp, hashOtp, verifyOtp, sendOtpEmail } from "../lib/mailer";
import { logger } from "../lib/logger";

declare module "express-session" {
  interface SessionData {
    userId: number;
    pendingEmail?: string;
  }
}

const router: IRouter = Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_RESEND_PER_WINDOW = 5;

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// ── Register: create unverified user + send OTP ───────────────────────────────
router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password, freeFireUid, inGameName, whatsappNumber } = req.body;

  if (!username || !email || !password || !freeFireUid || !inGameName || !whatsappNumber) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  // Check duplicates
  const [existingEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existingEmail) {
    if (!existingEmail.isVerified) {
      // Allow resending OTP if the previous registration wasn't verified
      await sendNewOtp(email);
      req.session.pendingEmail = email;
      res.status(200).json({ message: "OTP resent to your email. Please verify to continue.", requiresVerification: true });
      return;
    }
    res.status(409).json({ error: "User already exists with this email" });
    return;
  }

  const [existingUid] = await db.select().from(usersTable).where(eq(usersTable.freeFireUid, freeFireUid));
  if (existingUid) {
    res.status(409).json({ error: "Free Fire UID already registered" });
    return;
  }

  const passwordHash = hashPassword(password);

  await db.insert(usersTable).values({
    username,
    email,
    passwordHash,
    freeFireUid,
    inGameName,
    whatsappNumber,
    isVerified: false,
  });

  try {
    await sendNewOtp(email);
  } catch {
    res.status(500).json({ error: "Failed to send verification email. Please try again." });
    return;
  }

  req.session.pendingEmail = email;
  res.status(201).json({ message: "Account created. Check your email for the OTP.", requiresVerification: true });
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }

  const now = new Date();

  // Find active (non-expired) OTP record for this email
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

  // Mark user as verified
  const [user] = await db
    .update(usersTable)
    .set({ isVerified: true })
    .where(eq(usersTable.email, email))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Account not found. Please register again." });
    return;
  }

  // Clean up OTP records for this email
  await db.delete(emailOtpTable).where(eq(emailOtpTable.email, email));

  // Log user in
  req.session.userId = user.id;
  req.session.pendingEmail = undefined;

  logger.info({ userId: user.id, email }, "User verified and logged in");
  res.json({ user: formatUser(user), message: "Email verified successfully! Welcome to the arena." });
});

// ── Resend OTP ────────────────────────────────────────────────────────────────
router.post("/auth/resend-otp", async (req, res): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(404).json({ error: "No account found with this email" });
    return;
  }

  if (user.isVerified) {
    res.status(400).json({ error: "This email is already verified" });
    return;
  }

  // Check resend abuse: count recent OTP records
  const recentOtps = await db
    .select()
    .from(emailOtpTable)
    .where(eq(emailOtpTable.email, email));

  const totalResends = recentOtps.reduce((sum, r) => sum + r.resendCount, 0) + recentOtps.length;
  if (totalResends >= MAX_RESEND_PER_WINDOW) {
    res.status(429).json({ error: "Too many OTP requests. Please wait a few minutes before trying again." });
    return;
  }

  try {
    await sendNewOtp(email);
  } catch {
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
    return;
  }

  res.json({ message: "A new OTP has been sent to your email." });
});

// ── Login ─────────────────────────────────────────────────────────────────────
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
    // Send a fresh OTP so they can verify right away
    try {
      await sendNewOtp(email);
    } catch {
      // Non-fatal — still return the verification-required response
    }
    res.status(403).json({
      error: "Please verify your email first. A new OTP has been sent to your email.",
      requiresVerification: true,
      email,
    });
    return;
  }

  req.session.userId = user.id;
  res.json({ user: formatUser(user), message: "Login successful" });
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

// ── Get current user ──────────────────────────────────────────────────────────
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
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (user.isBanned) {
    req.session.destroy(() => {});
    res.status(403).json({ error: "Your account has been banned." });
    return;
  }

  res.json(formatUser(user));
});

// ── Helper: generate and store OTP ───────────────────────────────────────────
async function sendNewOtp(email: string): Promise<void> {
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Delete any existing OTPs for this email first
  await db.delete(emailOtpTable).where(eq(emailOtpTable.email, email));

  await db.insert(emailOtpTable).values({ email, otpHash, expiresAt });

  await sendOtpEmail(email, otp);
}

export default router;
