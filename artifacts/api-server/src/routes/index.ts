import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tournamentsRouter from "./tournaments";
import registrationsRouter from "./registrations";
import leaderboardRouter from "./leaderboard";
import playersRouter from "./players";
import notificationsRouter from "./notifications";
import reportsRouter from "./reports";
import adminRouter from "./admin";
import walletRouter from "./wallet";
import myMatchesRouter from "./my-matches";
import adminConfigRouter from "./admin-config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tournamentsRouter);
router.use(registrationsRouter);
router.use(leaderboardRouter);
router.use(playersRouter);
router.use(notificationsRouter);
router.use(reportsRouter);
router.use(adminRouter);
router.use(walletRouter);
router.use(myMatchesRouter);
router.use(adminConfigRouter);

export default router;
