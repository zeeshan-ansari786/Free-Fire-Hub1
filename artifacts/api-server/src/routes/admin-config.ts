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

// GET support config (public — no auth required — used by the support page)
router.get("/support-config", async (req, res): Promise<void> => {
  const [instagram, whatsapp] = await Promise.all([
    getConfig("support_instagram"),
    getConfig("support_whatsapp"),
  ]);
  res.json({
    instagram: instagram ?? "Sufi33k",
    whatsapp: whatsapp ?? "917777915823",
  });
});

// GET admin config (full config for admin panel)
router.get("/admin/config", requireAdmin, async (req, res): Promise<void> => {
  const [upiId, qrCodeUrl, upiName, whatsappApiKey, supportInstagram, supportWhatsapp] = await Promise.all([
    getConfig("upi_id"),
    getConfig("qr_code_url"),
    getConfig("upi_name"),
    getConfig("whatsapp_api_key"),
    getConfig("support_instagram"),
    getConfig("support_whatsapp"),
  ]);
  res.json({
    upiId: upiId ?? "ffarena@upi",
    upiName: upiName ?? "FF Arena Official",
    qrCodeUrl: qrCodeUrl ?? null,
    whatsappApiKey: whatsappApiKey ? "••••••••" : null,
    whatsappConfigured: !!whatsappApiKey,
    supportInstagram: supportInstagram ?? "Sufi33k",
    supportWhatsapp: supportWhatsapp ?? "917777915823",
  });
});

// PUT admin config (update UPI ID, name, WhatsApp API key, support contacts)
router.put("/admin/config", requireAdmin, async (req, res): Promise<void> => {
  const { upiId, upiName, whatsappApiKey, supportInstagram, supportWhatsapp } = req.body;
  if (upiId !== undefined) await setConfig("upi_id", upiId.trim());
  if (upiName !== undefined) await setConfig("upi_name", upiName.trim());
  if (whatsappApiKey !== undefined && whatsappApiKey.trim()) {
    await setConfig("whatsapp_api_key", whatsappApiKey.trim());
  }
  // Validate and save support contact details
  if (supportInstagram !== undefined) {
    const ig = supportInstagram.trim().replace(/^@/, "");
    if (ig && !/^[a-zA-Z0-9._]{1,30}$/.test(ig)) {
      res.status(400).json({ error: "Invalid Instagram username. Use only letters, numbers, dots, and underscores (max 30 chars)." });
      return;
    }
    if (ig) await setConfig("support_instagram", ig);
  }
  if (supportWhatsapp !== undefined) {
    const wa = supportWhatsapp.trim().replace(/\D/g, "");
    if (wa && !/^\d{10,15}$/.test(wa)) {
      res.status(400).json({ error: "Invalid WhatsApp number. Include country code, digits only (10–15 digits, e.g. 917777915823)." });
      return;
    }
    if (wa) await setConfig("support_whatsapp", wa);
  }
  res.json({ message: "Config updated" });
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
