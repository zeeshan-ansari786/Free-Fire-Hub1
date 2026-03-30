import { Router, type IRouter } from "express";
import { db, usersTable, tournamentsTable, registrationsTable, reportsTable, leaderboardTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const [
    [{ totalPlayers }],
    [{ totalTournaments }],
    [{ activeTournaments }],
    [{ totalPrize }],
    [{ pendingPayments }],
    [{ pendingReports }],
    [{ recentRegistrations }],
    upcomingTournaments,
  ] = await Promise.all([
    db.select({ totalPlayers: sql<number>`count(*)` }).from(usersTable),
    db.select({ totalTournaments: sql<number>`count(*)` }).from(tournamentsTable),
    db.select({ activeTournaments: sql<number>`count(*)` }).from(tournamentsTable).where(eq(tournamentsTable.status, "ongoing")),
    db.select({ totalPrize: sql<number>`sum(total_earnings)` }).from(usersTable),
    db.select({ pendingPayments: sql<number>`count(*)` }).from(registrationsTable).where(eq(registrationsTable.paymentStatus, "pending")),
    db.select({ pendingReports: sql<number>`count(*)` }).from(reportsTable).where(eq(reportsTable.status, "pending")),
    db.select({ recentRegistrations: sql<number>`count(*)` }).from(registrationsTable),
    db.select().from(tournamentsTable).where(eq(tournamentsTable.status, "upcoming")).orderBy(tournamentsTable.startDateTime).limit(5),
  ]);

  res.json({
    totalPlayers: Number(totalPlayers),
    totalTournaments: Number(totalTournaments),
    activeTournaments: Number(activeTournaments),
    totalPrizeDistributed: Number(totalPrize ?? 0),
    pendingPayments: Number(pendingPayments),
    pendingReports: Number(pendingReports),
    recentRegistrations: Number(recentRegistrations),
    upcomingTournaments,
  });
});

router.get("/admin/pending-registrations", requireAdmin, async (req, res): Promise<void> => {
  const regs = await db.select()
    .from(registrationsTable)
    .where(eq(registrationsTable.paymentStatus, "pending"))
    .orderBy(desc(registrationsTable.registeredAt));

  const results = await Promise.all(regs.map(async (reg) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, reg.userId));
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, reg.tournamentId));
    return { ...reg, user: formatUser(user!), tournament: tournament! };
  }));

  res.json(results);
});

export default router;
