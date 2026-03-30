import { Router, type IRouter } from "express";
import { db, usersTable, leaderboardTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

router.get("/players/:userId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const [killRows] = await db.select({ total: sql<number>`sum(kills)` })
    .from(leaderboardTable)
    .where(eq(leaderboardTable.userId, userId));

  const recentTournaments = await db.select()
    .from(leaderboardTable)
    .where(eq(leaderboardTable.userId, userId))
    .orderBy(desc(leaderboardTable.createdAt))
    .limit(10);

  const recentWithUsers = await Promise.all(recentTournaments.map(async (entry) => ({
    ...entry,
    user: formatUser(user),
  })));

  const totalKills = Number(killRows?.total ?? 0);
  const matchesPlayed = user.matchesPlayed;
  const winRate = matchesPlayed > 0
    ? (recentTournaments.filter(e => e.placement === 1).length / matchesPlayed) * 100
    : 0;

  res.json({
    user: formatUser(user),
    matchesPlayed,
    totalKills,
    totalEarnings: user.totalEarnings,
    globalRank: user.globalRank,
    recentTournaments: recentWithUsers,
    winRate,
  });
});

export default router;
