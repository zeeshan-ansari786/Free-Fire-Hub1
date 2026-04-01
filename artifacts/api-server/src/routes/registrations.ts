import { Router, type IRouter } from "express";
import { db, tournamentsTable, registrationsTable, usersTable, notificationsTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

async function buildRegistration(reg: typeof registrationsTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, reg.userId));
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, reg.tournamentId));
  return { ...reg, user: formatUser(user!), tournament: tournament! };
}

router.post("/tournaments/:id/register", requireAuth, async (req, res): Promise<void> => {
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

  if (tournament.status !== "upcoming") {
    res.status(400).json({ error: "Registration is closed for this tournament" });
    return;
  }

  if (tournament.filledSlots >= tournament.maxSlots) {
    res.status(400).json({ error: "Tournament is full" });
    return;
  }

  const [existing] = await db.select()
    .from(registrationsTable)
    .where(and(
      eq(registrationsTable.tournamentId, id),
      eq(registrationsTable.userId, req.session.userId!)
    ));

  if (existing) {
    res.status(409).json({ error: "Already registered for this tournament" });
    return;
  }

  const { teamMembers } = req.body;

  // Paid tournament: deduct from wallet
  if (tournament.entryFee > 0) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.walletBalance < tournament.entryFee) {
      res.status(402).json({
        error: "Insufficient wallet balance",
        code: "INSUFFICIENT_BALANCE",
        required: tournament.entryFee,
        balance: user.walletBalance,
      });
      return;
    }

    // Deduct entry fee from wallet
    await db.update(usersTable)
      .set({ walletBalance: user.walletBalance - tournament.entryFee })
      .where(eq(usersTable.id, req.session.userId!));

    // Record transaction
    await db.insert(transactionsTable).values({
      userId: req.session.userId!,
      type: "withdrawal",
      amount: tournament.entryFee,
      status: "completed",
      description: `Entry fee for tournament: ${tournament.title}`,
    });

    // Create registration as verified (wallet payment = instant verification)
    const [registration] = await db.insert(registrationsTable).values({
      tournamentId: id,
      userId: req.session.userId!,
      paymentStatus: "verified",
      teamMembers: teamMembers ?? null,
    }).returning();

    // Increment filled slots
    await db.update(tournamentsTable)
      .set({ filledSlots: tournament.filledSlots + 1 })
      .where(eq(tournamentsTable.id, id));

    const result = await buildRegistration(registration);
    res.status(201).json(result);
    return;
  }

  // Free tournament
  const [registration] = await db.insert(registrationsTable).values({
    tournamentId: id,
    userId: req.session.userId!,
    paymentStatus: "free",
    teamMembers: teamMembers ?? null,
  }).returning();

  await db.update(tournamentsTable)
    .set({ filledSlots: tournament.filledSlots + 1 })
    .where(eq(tournamentsTable.id, id));

  const result = await buildRegistration(registration);
  res.status(201).json(result);
});

router.get("/tournaments/:id/registrations", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const regs = await db.select()
    .from(registrationsTable)
    .where(eq(registrationsTable.tournamentId, id));

  const results = await Promise.all(regs.map(buildRegistration));
  res.json(results);
});

router.patch("/registrations/:id/verify", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid registration ID" });
    return;
  }

  const { status, adminNote } = req.body;

  if (!["verified", "rejected"].includes(status)) {
    res.status(400).json({ error: "Status must be verified or rejected" });
    return;
  }

  const [existingReg] = await db.select().from(registrationsTable).where(eq(registrationsTable.id, id));

  if (!existingReg) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  const [registration] = await db.update(registrationsTable)
    .set({ paymentStatus: status, adminNote: adminNote ?? null })
    .where(eq(registrationsTable.id, id))
    .returning();

  // Update filled slots if verified
  if (status === "verified" && existingReg.paymentStatus !== "verified") {
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, existingReg.tournamentId));
    if (tournament) {
      await db.update(tournamentsTable)
        .set({ filledSlots: tournament.filledSlots + 1 })
        .where(eq(tournamentsTable.id, existingReg.tournamentId));
    }
  }

  const result = await buildRegistration(registration);
  res.json(result);
});

export default router;
