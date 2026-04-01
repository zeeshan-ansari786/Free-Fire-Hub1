import { Router, type IRouter } from "express";
import { db, registrationsTable, tournamentsTable, leaderboardTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/my-matches", requireAuth, async (req, res): Promise<void> => {
  const regs = await db.select()
    .from(registrationsTable)
    .where(eq(registrationsTable.userId, req.session.userId!))
    .orderBy(desc(registrationsTable.registeredAt));

  const results = await Promise.all(regs.map(async (reg) => {
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, reg.tournamentId));

    let leaderboardEntry = null;
    if (tournament?.status === "completed") {
      const [entry] = await db.select().from(leaderboardTable)
        .where(and(
          eq(leaderboardTable.tournamentId, reg.tournamentId),
          eq(leaderboardTable.userId, req.session.userId!)
        ));
      leaderboardEntry = entry ?? null;
    }

    const now = new Date();
    const startTime = tournament ? new Date(tournament.startDateTime) : null;
    const minutesUntilStart = startTime ? (startTime.getTime() - now.getTime()) / 60000 : null;
    const showRoom = (reg.paymentStatus === "verified" || reg.paymentStatus === "free") && minutesUntilStart !== null && minutesUntilStart <= 15;

    return {
      ...reg,
      tournament: tournament ? {
        ...tournament,
        roomId: showRoom ? tournament.roomId : null,
        roomPassword: showRoom ? tournament.roomPassword : null,
      } : null,
      leaderboardEntry,
      minutesUntilStart,
    };
  }));

  res.json({ matches: results });
});

export default router;
