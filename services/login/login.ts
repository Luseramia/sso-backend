import dz from "../../drizzle.service";
import { usersTable } from "../../db/users.schema";
import pool from "../../pg-connector";
import { eq, sql } from "drizzle-orm";
export default class LoginService {
  async login(name: string) {
    try {
      const isExist = await dz
        .select()
        .from(usersTable)
        .where(eq(usersTable.name, name));
      if (isExist.length > 0) {
        return isExist[0];
      }
      const user = await dz
        .insert(usersTable)
        .values({ name: name })
        .returning();
      return user[0];
    } catch (error) {
      console.log("error", error);

      throw error;
    }
  }
}
