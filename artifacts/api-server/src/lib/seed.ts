import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const ADMIN_EMAIL = "admin@ffarena.com";
const ADMIN_PASSWORD = "admin123";

export async function seedAdminUser(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, ADMIN_EMAIL));

    if (existing) {
      // Ensure the existing admin is verified and has admin flag
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
