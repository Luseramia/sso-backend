import dz from "../../drizzle.service";
import { usersTable } from "../../db/users.schema";
import { fileUploadTable } from "../../db/file-upload.schema";
import { and, count, desc, eq, sql } from "drizzle-orm";

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

  async getPublicFilesByCategoryPaged(params: {
    category: string;
    page?: number;
    pageSize?: number;
  }) {
    try {
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 12));
      const offset = (page - 1) * pageSize;

      const conds = [
        eq(fileUploadTable.file_category, params.category),
        eq(fileUploadTable.is_public, true),
      ];

      const [items, totalRow] = await Promise.all([
        dz
          .select()
          .from(fileUploadTable)
          .where(and(...conds))
          .orderBy(desc(fileUploadTable.craeted_at))
          .limit(pageSize)
          .offset(offset),
        dz
          .select({ value: count() })
          .from(fileUploadTable)
          .where(and(...conds)),
      ]);

      const total = Number(totalRow[0]?.value ?? 0);
      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    } catch (error) {
      console.log("getPublicFilesByCategoryPaged error", error);
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

  async getFilesByUserPaged(params: {
    userId: number;
    category?: string;
    page?: number;
    pageSize?: number;
  }) {
    try {
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
      const offset = (page - 1) * pageSize;

      const conds = [eq(fileUploadTable.create_by_user_id, params.userId)];
      if (params.category) {
        conds.push(eq(fileUploadTable.file_category, params.category));
      }

      const [items, totalRow] = await Promise.all([
        dz
          .select()
          .from(fileUploadTable)
          .where(and(...conds))
          .orderBy(desc(fileUploadTable.craeted_at))
          .limit(pageSize)
          .offset(offset),
        dz
          .select({ value: count() })
          .from(fileUploadTable)
          .where(and(...conds)),
      ]);

      const total = Number(totalRow[0]?.value ?? 0);
      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    } catch (error) {
      console.log("getFilesByUserPaged error", error);
      throw error;
    }
  }

  async getCategoryCountsByUser(userId: number) {
    try {
      const rows = await dz
        .select({
          category: fileUploadTable.file_category,
          c: count(),
        })
        .from(fileUploadTable)
        .where(eq(fileUploadTable.create_by_user_id, userId))
        .groupBy(fileUploadTable.file_category);

      const byCategory: Record<string, number> = {};
      let total = 0;
      for (const row of rows) {
        const n = Number(row.c);
        byCategory[row.category] = n;
        total += n;
      }
      return { total, byCategory };
    } catch (error) {
      console.log("getCategoryCountsByUser error", error);
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
