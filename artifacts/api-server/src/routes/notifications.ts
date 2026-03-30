import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const { limit = "20" } = req.query as Record<string, string>;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 50);

  const notifications = await db.select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limitNum);

  res.json(notifications);
});

router.post("/notifications", requireAdmin, async (req, res): Promise<void> => {
  const { type, title, message, tournamentId } = req.body;

  if (!type || !title || !message) {
    res.status(400).json({ error: "type, title and message are required" });
    return;
  }

  const [notification] = await db.insert(notificationsTable).values({
    type,
    title,
    message,
    tournamentId: tournamentId ?? null,
  }).returning();

  res.status(201).json(notification);
});

export default router;
