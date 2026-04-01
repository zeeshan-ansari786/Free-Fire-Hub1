import { Router, type IRouter } from "express";
import { db, leaderboardTable, usersTable, tournamentsTable } from "@workspace/db";
import { eq, desc, sql, isNotNull } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

const MIN_DISPLAYED_PLAYERS = 300;

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

const KILL_POINTS = 1;

function getRankPoints(placement: number): number {
  if (placement === 1) return 12;
  if (placement === 2) return 8;
  if (placement === 3) return 6;
  if (placement <= 6) return 4;
  if (placement <= 10) return 2;
  if (placement <= 15) return 1;
  return 0;
}

async function recalculateGlobalRanks() {
  const allUsers = await db.select().from(usersTable).orderBy(desc(usersTable.totalEarnings));
  for (let i = 0; i < allUsers.length; i++) {
    await db.update(usersTable).set({ globalRank: i + 1 }).where(eq(usersTable.id, allUsers[i].id));
  }
}

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

  await db.delete(leaderboardTable).where(eq(leaderboardTable.tournamentId, id));

  const sorted = entries
    .map((entry) => {
      const rankPts = getRankPoints(entry.placement);
      const totalPoints = rankPts + (entry.kills * KILL_POINTS);
      return { ...entry, rankPoints: rankPts, totalPoints };
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

  for (const entry of inserted) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, entry.userId));
    if (user) {
      await db.update(usersTable).set({
        matchesPlayed: user.matchesPlayed + 1,
        totalEarnings: user.totalEarnings + entry.prize,
      }).where(eq(usersTable.id, entry.userId));
    }
  }

  await recalculateGlobalRanks();

  const results = await Promise.all(inserted.map(async (entry) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, entry.userId));
    return { ...entry, user: formatUser(user!) };
  }));

  res.json(results);
});

router.get("/leaderboard/stats", async (req, res): Promise<void> => {
  const [[{ totalPlayers }], topKillerRow] = await Promise.all([
    db.select({ totalPlayers: sql<number>`count(*)` }).from(usersTable),
    db.select({
      userId: leaderboardTable.userId,
      totalKills: sql<number>`sum(${leaderboardTable.kills})`,
    })
      .from(leaderboardTable)
      .groupBy(leaderboardTable.userId)
      .orderBy(desc(sql`sum(${leaderboardTable.kills})`))
      .limit(1),
  ]);

  let topKiller = null;
  if (topKillerRow[0]) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, topKillerRow[0].userId));
    if (user) {
      topKiller = { userId: user.id, totalKills: Number(topKillerRow[0].totalKills), user: formatUser(user) };
    }
  }

  const displayedPlayers = Math.max(Number(totalPlayers), MIN_DISPLAYED_PLAYERS);
  res.json({ totalPlayers: displayedPlayers, topKiller });
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

// ── Admin leaderboard management ──────────────────────────────────────────────

router.get("/admin/leaderboard", requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.globalRank);

  const results = await Promise.all(users.map(async (user) => {
    const killRows = await db.select({ total: sql<number>`sum(kills)` })
      .from(leaderboardTable).where(eq(leaderboardTable.userId, user.id));
    const pointRows = await db.select({ total: sql<number>`sum(total_points)` })
      .from(leaderboardTable).where(eq(leaderboardTable.userId, user.id));

    return {
      rank: user.globalRank,
      user: formatUser(user),
      totalPoints: Number(pointRows[0]?.total ?? 0),
      totalKills: Number(killRows[0]?.total ?? 0),
      matchesPlayed: user.matchesPlayed,
      totalEarnings: user.totalEarnings,
    };
  }));

  res.json(results);
});

router.put("/admin/leaderboard/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const { matchesPlayed, totalEarnings, globalRank } = req.body as {
    matchesPlayed?: number; totalEarnings?: number; globalRank?: number;
  };

  const updates: Record<string, number> = {};
  if (matchesPlayed !== undefined) updates.matchesPlayed = matchesPlayed;
  if (totalEarnings !== undefined) updates.totalEarnings = totalEarnings;
  if (globalRank !== undefined) updates.globalRank = globalRank;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" }); return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));

  if (globalRank === undefined) {
    await recalculateGlobalRanks();
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  res.json({ message: "Player stats updated", user: formatUser(user!) });
});

router.delete("/admin/leaderboard/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  await db.delete(leaderboardTable).where(eq(leaderboardTable.userId, userId));
  await db.update(usersTable).set({
    matchesPlayed: 0,
    totalEarnings: 0,
    globalRank: null,
  }).where(eq(usersTable.id, userId));

  await recalculateGlobalRanks();

  res.json({ message: "Player removed from leaderboard" });
});

export default router;
