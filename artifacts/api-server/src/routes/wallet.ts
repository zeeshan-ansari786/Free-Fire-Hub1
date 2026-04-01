import { Router, type IRouter } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const transactions = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, req.session.userId!))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);

  res.json({ walletBalance: user.walletBalance, transactions });
});

router.post("/wallet/deposit", requireAuth, async (req, res): Promise<void> => {
  const { amount, transactionRef } = req.body;
  const amountNum = parseInt(amount, 10);

  if (!amountNum || amountNum <= 0 || amountNum > 50000) {
    res.status(400).json({ error: "Amount must be between ₹1 and ₹50,000" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const newBalance = user.walletBalance + amountNum;

  await db.update(usersTable).set({ walletBalance: newBalance }).where(eq(usersTable.id, req.session.userId!));

  await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "deposit",
    amount: amountNum,
    status: "completed",
    description: transactionRef ? `Deposit via UPI (Ref: ${transactionRef})` : "Wallet deposit",
  });

  res.json({ walletBalance: newBalance, message: `₹${amountNum} added to wallet` });
});

router.post("/wallet/withdraw", requireAuth, async (req, res): Promise<void> => {
  const { amount, upiId } = req.body;
  const amountNum = parseInt(amount, 10);

  if (!amountNum || amountNum < 100) {
    res.status(400).json({ error: "Minimum withdrawal is ₹100" });
    return;
  }
  if (!upiId) {
    res.status(400).json({ error: "UPI ID is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (user.walletBalance < amountNum) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  const newBalance = user.walletBalance - amountNum;
  await db.update(usersTable).set({ walletBalance: newBalance }).where(eq(usersTable.id, req.session.userId!));

  await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "withdrawal",
    amount: amountNum,
    status: "pending",
    description: `Withdrawal to UPI: ${upiId}`,
  });

  res.json({ walletBalance: newBalance, message: `₹${amountNum} withdrawal requested. Admin will process within 24 hours.` });
});

export default router;
