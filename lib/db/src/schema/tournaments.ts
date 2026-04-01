import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  prizePool: integer("prize_pool").notNull().default(0),
  entryFee: integer("entry_fee").notNull().default(0),
  startDateTime: timestamp("start_date_time", { withTimezone: true }).notNull(),
  maxSlots: integer("max_slots").notNull(),
  filledSlots: integer("filled_slots").notNull().default(0),
  status: text("status").notNull().default("upcoming"),
  roomId: text("room_id"),
  roomPassword: text("room_password"),
  mapName: text("map_name").notNull().default("Bermuda"),
  gameMode: text("game_mode").notNull().default("squad"),
  bannerUrl: text("banner_url"),
  perKillPrize: integer("per_kill_prize").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true, filledSlots: true, createdAt: true, status: true, roomId: true, roomPassword: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
