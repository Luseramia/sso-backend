import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { SQL } from "bun";
import pool from "./pg-connector";

const dz = drizzle(pool);

export default dz;
