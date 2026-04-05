import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  freeFireUid: text("free_fire_uid").notNull(),
  inGameName: text("in_game_name").notNull(),
  whatsappNumber: text("whatsapp_number").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  walletBalance: integer("wallet_balance").notNull().default(0),
  totalEarnings: integer("total_earnings").notNull().default(0),
  globalRank: integer("global_rank").notNull().default(0),
  matchesPlayed: integer("matches_played").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailOtpTable = pgTable("email_otp", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  resendCount: integer("resend_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, isAdmin: true, isBanned: true, walletBalance: true, totalEarnings: true, globalRank: true, matchesPlayed: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
