import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { startTournamentScheduler } from "./lib/scheduler";
import { seedAdminUser, ensureSessionTable, ensureMigrations } from "./lib/seed";
import path from "path";
import fs from "fs";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);

const sessionStore =
  process.env.DATABASE_URL
    ? new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: "session",
        createTableIfMissing: false,
      })
    : undefined;

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET ?? "ff-arena-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

// Serve uploaded files (QR codes, payment proofs) under /api/uploads so the
// Replit workspace proxy routes them to this server alongside API calls.
const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/api/uploads", express.static(uploadsDir));

app.use("/api", router);

startTournamentScheduler();

ensureSessionTable()
  .then(() => ensureMigrations())
  .then(() => seedAdminUser())
  .catch((err) => logger.error({ err }, "Startup init failed"));

export default app;
