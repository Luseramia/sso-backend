import { migrate } from "drizzle-orm/bun-sql/migrator";
import dz from "./drizzle.service";

await migrate(dz, {
  migrationsFolder: "./drizzle",
});
