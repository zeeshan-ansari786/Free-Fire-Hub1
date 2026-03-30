import { Router, type IRouter } from "express";
import { db, reportsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

async function buildReport(report: typeof reportsTable.$inferSelect) {
  const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, report.reporterUserId));
  const [reported] = await db.select().from(usersTable).where(eq(usersTable.id, report.reportedUserId));
  return { ...report, reporter: formatUser(reporter!), reported: formatUser(reported!) };
}

router.post("/reports", requireAuth, async (req, res): Promise<void> => {
  const { reportedUserId, tournamentId, reason, description } = req.body;

  if (!reportedUserId || !tournamentId || !reason || !description) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  const [report] = await db.insert(reportsTable).values({
    reporterUserId: req.session.userId!,
    reportedUserId,
    tournamentId,
    reason,
    description,
  }).returning();

  const result = await buildReport(report);
  res.status(201).json(result);
});

router.get("/reports", requireAdmin, async (req, res): Promise<void> => {
  const reports = await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));
  const results = await Promise.all(reports.map(buildReport));
  res.json(results);
});

export default router;
