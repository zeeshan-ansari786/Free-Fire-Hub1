import { db, usersTable, emailOtpTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const ADMIN_EMAIL = "admin@ffarena.com";
const ADMIN_PASSWORD = "admin123";

export async function ensureSessionTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
    `);
    logger.info("Session table ready");
  } catch (err) {
    logger.error({ err }, "Failed to ensure session table");
  }
}

export async function ensureMigrations(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE email_otp ADD COLUMN IF NOT EXISTS pending_data text
    `);
    await db.execute(sql`
      DELETE FROM users WHERE is_verified = false
    `);
    logger.info("DB migrations applied: pending_data column, zombie users cleaned up");
  } catch (err) {
    logger.error({ err }, "Migration step failed (non-fatal)");
  }
}

export async function seedAdminUser(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, ADMIN_EMAIL));

    if (existing) {
      await db
        .update(usersTable)
        .set({ isAdmin: true, isVerified: true })
        .where(eq(usersTable.email, ADMIN_EMAIL));
      logger.info({ email: ADMIN_EMAIL }, "Admin user already exists — ensured verified + admin flags");
      return;
    }

    await db.insert(usersTable).values({
      username: "admin",
      email: ADMIN_EMAIL,
      passwordHash: hashPassword(ADMIN_PASSWORD),
      freeFireUid: "ADMIN000001",
      inGameName: "ADMIN",
      whatsappNumber: "+910000000000",
      isAdmin: true,
      isVerified: true,
    });

    logger.info({ email: ADMIN_EMAIL }, "Admin user created successfully");
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
