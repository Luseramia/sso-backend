import dz from "../../drizzle.service";
import { usersTable } from "../../db/users.schema";
import { fileUploadTable } from "../../db/file-upload.schema";
import { eq, sql } from "drizzle-orm";

type FileUploadInsert = typeof fileUploadTable.$inferInsert;

export default class UploadFileService {
  async uploadFile(fileUploadInsert: FileUploadInsert) {
    try {
      const data = await dz.insert(fileUploadTable).values(fileUploadInsert);

      return data;
    } catch (error) {
      console.log("error", error);

      throw error;
    }
  }

  async getAllFile() {
    try {
      const data = await dz.select().from(fileUploadTable);

      return data;
    } catch (error) {
      console.log("error", error);

      throw error;
    }
  }

  async getOne(id: number) {
    try {
      const data = await dz
        .select()
        .from(fileUploadTable)
        .where(eq(fileUploadTable.id, id));

      return data[0];
    } catch (error) {
      console.log("error", error);

      throw error;
    }
  }
}
