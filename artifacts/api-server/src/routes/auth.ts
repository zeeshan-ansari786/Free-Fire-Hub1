import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password, freeFireUid, inGameName, whatsappNumber } = req.body;

  if (!username || !email || !password || !freeFireUid || !inGameName || !whatsappNumber) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingUser) {
    res.status(409).json({ error: "User already exists with this email" });
    return;
  }

  const [existingUid] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.freeFireUid, freeFireUid));

  if (existingUid) {
    res.status(409).json({ error: "Free Fire UID already registered" });
    return;
  }

  const passwordHash = hashPassword(password);

  const [user] = await db.insert(usersTable).values({
    username,
    email,
    passwordHash,
    freeFireUid,
    inGameName,
    whatsappNumber,
  }).returning();

  req.session.userId = user.id;
  res.status(201).json({ user: formatUser(user), message: "Registration successful" });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.userId = user.id;
  res.json({ user: formatUser(user), message: "Login successful" });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

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

  res.json(formatUser(user));
});

export default router;
