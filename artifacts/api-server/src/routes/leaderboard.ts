import { Router, type IRouter } from "express";
import { db, leaderboardTable, usersTable, tournamentsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

const BOOYAH_POINTS = 12;
const KILL_POINTS = 1;

router.get("/tournaments/:id/leaderboard", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const entries = await db.select()
    .from(leaderboardTable)
    .where(eq(leaderboardTable.tournamentId, id))
    .orderBy(leaderboardTable.rank);

  const results = await Promise.all(entries.map(async (entry) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, entry.userId));
    return { ...entry, user: formatUser(user!) };
  }));

  res.json(results);
});

router.post("/tournaments/:id/leaderboard", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const { entries } = req.body as { entries: Array<{ userId: number; kills: number; placement: number; prize?: number }> };

  if (!Array.isArray(entries)) {
    res.status(400).json({ error: "entries must be an array" });
    return;
  }

  // Delete existing leaderboard for this tournament
  await db.delete(leaderboardTable).where(eq(leaderboardTable.tournamentId, id));

  // Calculate points: 12pts for Booyah (1st place), 1pt per kill
  const sorted = entries
    .map((entry, idx) => {
      const placementPts = entry.placement === 1 ? BOOYAH_POINTS : 0;
      const totalPoints = placementPts + (entry.kills * KILL_POINTS);
      return { ...entry, totalPoints };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const insertData = sorted.map((entry, idx) => ({
    tournamentId: id,
    userId: entry.userId,
    rank: idx + 1,
    kills: entry.kills,
    placement: entry.placement,
    totalPoints: entry.totalPoints,
    prize: entry.prize ?? 0,
  }));

  const inserted = await db.insert(leaderboardTable).values(insertData).returning();

  // Update player stats (matchesPlayed, totalEarnings, globalRank)
  for (const entry of inserted) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, entry.userId));
    if (user) {
      await db.update(usersTable).set({
        matchesPlayed: user.matchesPlayed + 1,
        totalEarnings: user.totalEarnings + entry.prize,
      }).where(eq(usersTable.id, entry.userId));
    }
  }

  // Recalculate global ranks
  const allUsers = await db.select().from(usersTable).orderBy(desc(usersTable.totalEarnings));
  for (let i = 0; i < allUsers.length; i++) {
    await db.update(usersTable).set({ globalRank: i + 1 }).where(eq(usersTable.id, allUsers[i].id));
  }

  const results = await Promise.all(inserted.map(async (entry) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, entry.userId));
    return { ...entry, user: formatUser(user!) };
  }));

  res.json(results);
});

router.get("/leaderboard/global", async (req, res): Promise<void> => {
  const { page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
  const offset = (pageNum - 1) * limitNum;

  const [players, [{ count }]] = await Promise.all([
    db.select().from(usersTable)
      .orderBy(usersTable.globalRank)
      .limit(limitNum)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
  ]);

  const results = await Promise.all(players.map(async (user) => {
    const killRows = await db.select({ total: sql<number>`sum(kills)` })
      .from(leaderboardTable)
      .where(eq(leaderboardTable.userId, user.id));

    const pointRows = await db.select({ total: sql<number>`sum(total_points)` })
      .from(leaderboardTable)
      .where(eq(leaderboardTable.userId, user.id));

    return {
      rank: user.globalRank || pageNum * limitNum,
      user: formatUser(user),
      totalPoints: Number(pointRows[0]?.total ?? 0),
      totalKills: Number(killRows[0]?.total ?? 0),
      matchesPlayed: user.matchesPlayed,
      totalEarnings: user.totalEarnings,
    };
  }));

  res.json({ players: results, total: Number(count), page: pageNum, limit: limitNum });
});

export default router;
