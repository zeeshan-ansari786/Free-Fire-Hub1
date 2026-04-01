import { Router, type IRouter } from "express";
import { db, tournamentsTable, registrationsTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

router.get("/tournaments", async (req, res): Promise<void> => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 50);
  const offset = (pageNum - 1) * limitNum;

  let query = db.select().from(tournamentsTable).$dynamic();
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(tournamentsTable).$dynamic();

  if (status && ["upcoming", "ongoing", "completed"].includes(status)) {
    query = query.where(eq(tournamentsTable.status, status));
    countQuery = countQuery.where(eq(tournamentsTable.status, status));
  }

  const [tournaments, [{ count }]] = await Promise.all([
    query.orderBy(desc(tournamentsTable.startDateTime)).limit(limitNum).offset(offset),
    countQuery,
  ]);

  res.json({ tournaments, total: Number(count), page: pageNum, limit: limitNum });
});

router.post("/tournaments", requireAdmin, async (req, res): Promise<void> => {
  const { title, description, prizePool, entryFee, startDateTime, maxSlots, mapName, gameMode, bannerUrl } = req.body;

  if (!title || !startDateTime || !maxSlots) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [tournament] = await db.insert(tournamentsTable).values({
    title,
    description,
    prizePool: prizePool ?? 0,
    entryFee: entryFee ?? 0,
    startDateTime: new Date(startDateTime),
    maxSlots,
    mapName: mapName ?? "Bermuda",
    gameMode: gameMode ?? "squad",
    bannerUrl,
  }).returning();

  res.status(201).json(tournament);
});

router.get("/tournaments/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  let isRegistered = false;
  let registrationStatus: string | null = null;

  if (req.session.userId) {
    const [reg] = await db.select()
      .from(registrationsTable)
      .where(and(
        eq(registrationsTable.tournamentId, id),
        eq(registrationsTable.userId, req.session.userId)
      ));
    if (reg) {
      isRegistered = true;
      registrationStatus = reg.paymentStatus;
    }
  }

  // Only show room details to verified registered players or admins
  let tournamentData: typeof tournament & { isRegistered: boolean; registrationStatus: string | null } = {
    ...tournament,
    isRegistered,
    registrationStatus,
  };

  const canSeeRoom = isRegistered && (registrationStatus === "verified" || registrationStatus === "free");
  let isAdmin = false;
  if (req.session.userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
    isAdmin = user?.isAdmin ?? false;
  }

  if (!canSeeRoom && !isAdmin) {
    tournamentData = { ...tournamentData, roomId: null, roomPassword: null };
  }

  res.json(tournamentData);
});

router.put("/tournaments/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const { title, description, prizePool, entryFee, startDateTime, maxSlots, status, mapName, gameMode, bannerUrl } = req.body;

  const updates: Partial<typeof tournamentsTable.$inferInsert> = {};
  if (title != null) updates.title = title;
  if (description != null) updates.description = description;
  if (prizePool != null) updates.prizePool = prizePool;
  if (entryFee != null) updates.entryFee = entryFee;
  if (startDateTime != null) updates.startDateTime = new Date(startDateTime);
  if (maxSlots != null) updates.maxSlots = maxSlots;
  if (status != null) updates.status = status;
  if (mapName != null) updates.mapName = mapName;
  if (gameMode != null) updates.gameMode = gameMode;
  if (bannerUrl != null) updates.bannerUrl = bannerUrl;

  const [tournament] = await db.update(tournamentsTable)
    .set(updates)
    .where(eq(tournamentsTable.id, id))
    .returning();

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  res.json(tournament);
});

router.post("/tournaments/:id/room", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const { roomId, roomPassword } = req.body;

  if (!roomId || !roomPassword) {
    res.status(400).json({ error: "Room ID and password required" });
    return;
  }

  const [tournament] = await db.update(tournamentsTable)
    .set({ roomId, roomPassword })
    .where(eq(tournamentsTable.id, id))
    .returning();

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  res.json(tournament);
});

// Admin: kick/disqualify a player from a tournament
router.post("/tournaments/:id/players/:regId/kick", requireAdmin, async (req, res): Promise<void> => {
  const tournamentId = parseInt(req.params.id, 10);
  const regId = parseInt(req.params.regId, 10);

  if (isNaN(tournamentId) || isNaN(regId)) {
    res.status(400).json({ error: "Invalid IDs" });
    return;
  }

  const { reason } = req.body;

  const [reg] = await db.select().from(registrationsTable)
    .where(and(eq(registrationsTable.id, regId), eq(registrationsTable.tournamentId, tournamentId)));

  if (!reg) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  // Mark registration as rejected with reason
  await db.update(registrationsTable)
    .set({ paymentStatus: "rejected", adminNote: reason || "Disqualified by admin" })
    .where(eq(registrationsTable.id, regId));

  // If they paid entry, refund to wallet
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (tournament && tournament.entryFee > 0 && (reg.paymentStatus === "verified" || reg.paymentStatus === "free")) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, reg.userId));
    if (user) {
      await db.update(usersTable)
        .set({ walletBalance: user.walletBalance + tournament.entryFee })
        .where(eq(usersTable.id, reg.userId));
    }
    // Reduce filled slots
    await db.update(tournamentsTable)
      .set({ filledSlots: Math.max(0, (tournament.filledSlots ?? 1) - 1) })
      .where(eq(tournamentsTable.id, tournamentId));
  }

  res.json({ message: "Player disqualified" });
});

// Admin: get all players in a tournament
router.get("/tournaments/:id/players", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const regs = await db.select().from(registrationsTable).where(eq(registrationsTable.tournamentId, id));
  const results = await Promise.all(regs.map(async (reg) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, reg.userId));
    return { ...reg, user: user ? formatUser(user) : null };
  }));

  res.json(results);
});

export default router;
