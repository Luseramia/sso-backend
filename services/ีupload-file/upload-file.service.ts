import dz from "../../drizzle.service";
import { usersTable } from "../../db/users.schema";
import { fileUploadTable } from "../../db/file-upload.schema";
import { and, eq, sql } from "drizzle-orm";

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

  async getFilesByCategory(category: string) {
    try {
      const data = await dz
        .select()
        .from(fileUploadTable)
        .where(
          and(
            eq(fileUploadTable.file_category, category),
            eq(fileUploadTable.is_public, true),
          ),
        );

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

  async getFilesByUser(userId: number) {
    try {
      const data = await dz
        .select()
        .from(fileUploadTable)
        .where(eq(fileUploadTable.create_by_user_id, userId));

      return data;
    } catch (error) {
      console.log("error", error);

      throw error;
    }
  }

  async getPublicFiles() {
    try {
      const data = await dz
        .select()
        .from(fileUploadTable)
        .where(eq(fileUploadTable.is_public, true));

      return data;
    } catch (error) {
      console.log("error", error);

      throw error;
    }
  }

  async updateVisibility(fileId: number, userId: number, isPublic: boolean) {
    try {
      const data = await dz
        .update(fileUploadTable)
        .set({ is_public: isPublic })
        .where(
          and(
            eq(fileUploadTable.id, fileId),
            eq(fileUploadTable.create_by_user_id, userId),
          ),
        )
        .returning();

      return data[0];
    } catch (error) {
      console.log("error", error);

      throw error;
    }
  }
}
