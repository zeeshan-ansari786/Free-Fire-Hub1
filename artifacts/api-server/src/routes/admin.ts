import { Router, type IRouter } from "express";
import { db, usersTable, tournamentsTable, registrationsTable, reportsTable, leaderboardTable, transactionsTable } from "@workspace/db";
import { eq, sql, desc, and } from "drizzle-orm";
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

// GET all users
router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map(formatUser));
});

// Ban / unban user
router.post("/admin/users/:id/ban", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.isAdmin) { res.status(403).json({ error: "Cannot ban admin users" }); return; }

  const newBanStatus = !user.isBanned;
  await db.update(usersTable).set({ isBanned: newBanStatus }).where(eq(usersTable.id, id));

  res.json({ isBanned: newBanStatus, message: newBanStatus ? "User banned" : "User unbanned" });
});

// Financial overview - deposits, withdrawals
router.get("/admin/financial", requireAdmin, async (req, res): Promise<void> => {
  const [deposits, withdrawals, pendingWithdrawals] = await Promise.all([
    db.select({
      total: sql<number>`coalesce(sum(amount), 0)`,
      count: sql<number>`count(*)`,
    }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed"))),
    db.select({
      total: sql<number>`coalesce(sum(amount), 0)`,
      count: sql<number>`count(*)`,
    }).from(transactionsTable).where(eq(transactionsTable.type, "withdrawal")),
    db.select().from(transactionsTable)
      .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")))
      .orderBy(desc(transactionsTable.createdAt)),
  ]);

  const pendingWithWithUsers = await Promise.all(pendingWithdrawals.map(async (t) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.userId));
    return { ...t, user: user ? formatUser(user) : null };
  }));

  res.json({
    totalDeposits: Number(deposits[0].total),
    depositCount: Number(deposits[0].count),
    totalWithdrawals: Number(withdrawals[0].total),
    withdrawalCount: Number(withdrawals[0].count),
    pendingWithdrawals: pendingWithWithUsers,
  });
});

// Approve or reject withdrawal
router.post("/admin/financial/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { action } = req.body; // "approve" | "reject"
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [txn] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }

  if (action === "approve") {
    await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, id));
  } else if (action === "reject") {
    // Refund the amount back to wallet
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, txn.userId));
    if (user) {
      await db.update(usersTable).set({ walletBalance: user.walletBalance + txn.amount }).where(eq(usersTable.id, txn.userId));
    }
    await db.update(transactionsTable).set({ status: "rejected" }).where(eq(transactionsTable.id, id));
  } else {
    res.status(400).json({ error: "Action must be 'approve' or 'reject'" }); return;
  }

  res.json({ message: `Withdrawal ${action}d` });
});

// Get registrations for a tournament (room management)
router.get("/admin/tournaments/:id/players", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid tournament ID" }); return; }

  const regs = await db.select().from(registrationsTable).where(eq(registrationsTable.tournamentId, id));
  const results = await Promise.all(regs.map(async (reg) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, reg.userId));
    return { ...reg, user: user ? formatUser(user) : null };
  }));

  res.json(results);
});

export default router;
