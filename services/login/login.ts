import dz from "../../drizzle.service";
import { usersTable } from "../../db/users.schema";
import pool from "../../pg-connector";

export default class LoginService {
  async login(name: string) {
    try {
      const user = await dz.insert(usersTable).values({name:name}).returning();
      return user[0];
    } catch (error) {
      console.log("error", error);

      throw error;
    }
  }
}
