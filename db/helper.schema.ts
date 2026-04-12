import {
  date,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const helper = {
  craeted_at: timestamp().defaultNow(),
  updated_at: date(),
  updatedAt: timestamp({ mode: "date", precision: 3 }).$onUpdate(
    () => new Date(),
  ),
  deleted_at: date(),
};
