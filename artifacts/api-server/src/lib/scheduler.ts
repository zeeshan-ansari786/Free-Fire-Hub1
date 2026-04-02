import { db, tournamentsTable } from "@workspace/db";
import { eq, lte, and } from "drizzle-orm";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 30_000;
const ONGOING_DURATION_MS = 20 * 60 * 1000;

async function runStatusUpdates(): Promise<void> {
  try {
    const now = new Date();

    // ── upcoming → ongoing ──────────────────────────────────────────────
    // Any upcoming tournament whose start time has passed becomes ongoing
    const toOngoing = await db
      .update(tournamentsTable)
      .set({ status: "ongoing" })
      .where(
        and(
          eq(tournamentsTable.status, "upcoming"),
          lte(tournamentsTable.startDateTime, now)
        )
      )
      .returning({ id: tournamentsTable.id, title: tournamentsTable.title });

    for (const t of toOngoing) {
      logger.info(
        { tournamentId: t.id, title: t.title },
        "Tournament auto-transitioned: upcoming → ongoing"
      );
    }

    // ── ongoing → completed ─────────────────────────────────────────────
    // Any ongoing tournament whose start time + 20 minutes has passed
    const cutoff = new Date(now.getTime() - ONGOING_DURATION_MS);

    const toCompleted = await db
      .update(tournamentsTable)
      .set({ status: "completed" })
      .where(
        and(
          eq(tournamentsTable.status, "ongoing"),
          lte(tournamentsTable.startDateTime, cutoff)
        )
      )
      .returning({ id: tournamentsTable.id, title: tournamentsTable.title });

    for (const t of toCompleted) {
      logger.info(
        { tournamentId: t.id, title: t.title },
        "Tournament auto-transitioned: ongoing → completed"
      );
    }
  } catch (err) {
    logger.error({ err }, "Tournament scheduler: error during status update");
  }
}

export function startTournamentScheduler(): NodeJS.Timeout {
  logger.info(
    { intervalMs: POLL_INTERVAL_MS, ongoingDurationMs: ONGOING_DURATION_MS },
    "Tournament auto-status scheduler started"
  );

  runStatusUpdates();

  return setInterval(runStatusUpdates, POLL_INTERVAL_MS);
}
