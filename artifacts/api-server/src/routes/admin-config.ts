import { Router, type IRouter } from "express";
import { db, adminConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAuth";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `qr-code-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

async function getConfig(key: string): Promise<string | null> {
  const [row] = await db.select().from(adminConfigTable).where(eq(adminConfigTable.key, key));
  return row?.value ?? null;
}

async function setConfig(key: string, value: string): Promise<void> {
  const existing = await getConfig(key);
  if (existing !== null) {
    await db.update(adminConfigTable).set({ value, updatedAt: new Date() }).where(eq(adminConfigTable.key, key));
  } else {
    await db.insert(adminConfigTable).values({ key, value });
  }
}

// GET payment config (public - shown to players in deposit form)
router.get("/payment-config", async (req, res): Promise<void> => {
  const [upiId, qrCodeUrl, upiName] = await Promise.all([
    getConfig("upi_id"),
    getConfig("qr_code_url"),
    getConfig("upi_name"),
  ]);
  res.json({
    upiId: upiId ?? "ffarena@upi",
    upiName: upiName ?? "FF Arena Official",
    qrCodeUrl: qrCodeUrl ?? null,
  });
});

// GET admin config (full config for admin panel)
router.get("/admin/config", requireAdmin, async (req, res): Promise<void> => {
  const [upiId, qrCodeUrl, upiName] = await Promise.all([
    getConfig("upi_id"),
    getConfig("qr_code_url"),
    getConfig("upi_name"),
  ]);
  res.json({
    upiId: upiId ?? "ffarena@upi",
    upiName: upiName ?? "FF Arena Official",
    qrCodeUrl: qrCodeUrl ?? null,
  });
});

// PUT admin config (update UPI ID, name)
router.put("/admin/config", requireAdmin, async (req, res): Promise<void> => {
  const { upiId, upiName } = req.body;
  if (upiId !== undefined) await setConfig("upi_id", upiId.trim());
  if (upiName !== undefined) await setConfig("upi_name", upiName.trim());
  res.json({ message: "Payment config updated" });
});

// POST upload QR code image
router.post("/admin/config/qr-code", requireAdmin, upload.single("qrCode"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No image file uploaded. Supported: JPEG, PNG, WebP" });
    return;
  }

  // Build the public URL for this file — served via /api/uploads/ on the API server
  const fileName = req.file.filename;
  const publicUrl = `/api/uploads/${fileName}`;

  // Clean up old QR code file if it exists
  const oldUrl = await getConfig("qr_code_url");
  if (oldUrl) {
    const oldFile = path.join(uploadsDir, path.basename(oldUrl));
    if (fs.existsSync(oldFile)) {
      try { fs.unlinkSync(oldFile); } catch {}
    }
  }

  await setConfig("qr_code_url", publicUrl);
  res.json({ qrCodeUrl: publicUrl, message: "QR code updated successfully" });
});

// POST upload any image (tournament banners, etc.)
router.post("/admin/upload/image", requireAdmin, upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No image file uploaded. Supported: JPEG, PNG, WebP" });
    return;
  }
  const publicUrl = `/api/uploads/${req.file.filename}`;
  res.json({ url: publicUrl, message: "Image uploaded successfully" });
});

export default router;
