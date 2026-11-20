import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: integer().primaryKey({ autoIncrement: true }),
  session: text().notNull().unique(),
  name: text().notNull(),
  room: text().notNull(),
});

export const trips = sqliteTable("trips", {
  id: integer().primaryKey({ autoIncrement: true }),
  student: integer().notNull().unique().references(() => students.id, { onDelete: "cascade" }),
});
