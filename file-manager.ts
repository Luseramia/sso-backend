import Elysia, { t } from "elysia";
import s3 from "./seaweedfs-connector";
import UploadFileService from "./services/ีupload-file/upload-file.service";
import { getFileCategory } from "./file-category";

const uploadFileService = new UploadFileService();

export const fileManagerController = new Elysia().group("/file", (app) =>
  app
    .post(
      "/upload/presign",
      async ({ body, headers }) => {
        const token = headers.authorization?.split(" ")[1]?.split(".")[0];

        if (token) {
          const userData = Buffer.from(token, "base64").toString("utf-8");
          const JsonData = JSON.parse(userData);

          const json = JSON.parse(body);
          const { name, type, size, thumbnailUrl } = json;

          const uuid = crypto.randomUUID();
          const category = getFileCategory(type);

          // Save thumbnail only if provided (video uploads)
          if (thumbnailUrl) {
            const base64Data = thumbnailUrl.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");
            s3.write(`thumbnails/${uuid}.jpg`, buffer);
          }

          const url = s3.presign(`uploads/${category}/${uuid}`, {
            method: "PUT",
            expiresIn: 300,
            bucket: "school",
            type: "application/octet-stream",
          });

          uploadFileService.uploadFile({
            file_name: uuid,
            original_file_name: name,
            create_by_user_id: JsonData.id,
            file_category: category,
          });

          return { url };
        }
      },
      {
        body: t.String(),
      },
    )
    .post(
      "/dowload/presign",
      async ({ body, headers, set }) => {
        const token = headers.authorization?.split(" ")[1]?.split(".")[0];
        let userId: number | null = null;
        if (token) {
          const userData = Buffer.from(token, "base64").toString("utf-8");
          userId = JSON.parse(userData).id;
        }

        const jsonData = JSON.parse(body);
        const { id } = jsonData;
        const file = await uploadFileService.getOne(id);
        if (!file) return true;

        // private file — only the owner can download
        if (!file.is_public && file.create_by_user_id !== userId) {
          set.status = 403;
          return { error: "ไม่มีสิทธิ์เข้าถึงไฟล์นี้" };
        }

        const category = file.file_category || "video";
        const url = s3.presign(`uploads/${category}/${file.file_name}`, {
          method: "GET",
          expiresIn: 3600,
          bucket: "school",
        });
        return { url };
      },
      {
        body: t.String(),
      },
    )
    .post(
      "/vdo/presign",
      async ({ body, headers, set }) => {
        const token = headers.authorization?.split(" ")[1]?.split(".")[0];
        let userId: number | null = null;
        if (token) {
          const userData = Buffer.from(token, "base64").toString("utf-8");
          userId = JSON.parse(userData).id;
        }

        const jsonData = JSON.parse(body);
        const { id } = jsonData;
        const file = await uploadFileService.getOne(id);
        if (!file) return true;

        // private file — only the owner can download
        if (!file.is_public && file.create_by_user_id !== userId) {
          set.status = 403;
          return { error: "ไม่มีสิทธิ์เข้าถึงไฟล์นี้" };
        }

        const category = file.file_category || "video";
        const url = s3.presign(`uploads/${category}/${file.file_name}`, {
          method: "GET",
          expiresIn: 3600,
          bucket: "school",
        });
        return {
          url,
          file_name: file.file_name,
          original_file_name: file.original_file_name,
        };
      },
      {
        body: t.String(),
      },
    )
    .get(
      "/all/thumnail",
      async () => {
        const data = await uploadFileService.getFilesByCategory("video");

        const baseUrl = "http://192.168.1.44:30304/school/thumbnails/";
        const mapData = data.map((item) => {
          return {
            id: item.id,
            title: item.original_file_name,
            thumbnail: baseUrl + item.file_name + ".jpg",
          };
        });

        return mapData;
      },
      {
        body: t.String(),
      },
    )
    .get("/my-files", async ({ headers }) => {
      const token = headers.authorization?.split(" ")[1]?.split(".")[0];
      if (!token) return [];

      const userData = Buffer.from(token, "base64").toString("utf-8");
      const jsonData = JSON.parse(userData);

      const files = await uploadFileService.getFilesByUser(jsonData.id);

      return files.map((item) => ({
        id: item.id,
        fileName: item.file_name,
        originalName: item.original_file_name,
        category: item.file_category,
        isPublic: item.is_public,
        createdAt: item.craeted_at,
      }));
    })
    .get("/public-files", async () => {
      const files = await uploadFileService.getPublicFiles();

      return files.map((item) => ({
        id: item.id,
        fileName: item.file_name,
        originalName: item.original_file_name,
        category: item.file_category,
        createdAt: item.craeted_at,
      }));
    })
    .post(
      "/visibility",
      async ({ body, headers, set }) => {
        const token = headers.authorization?.split(" ")[1]?.split(".")[0];
        if (!token) {
          set.status = 401;
          return { error: "unauthorized" };
        }

        const userData = Buffer.from(token, "base64").toString("utf-8");
        const jsonData = JSON.parse(userData);

        const { id, isPublic } = JSON.parse(body);

        const updated = await uploadFileService.updateVisibility(
          id,
          jsonData.id,
          isPublic,
        );

        if (!updated) {
          set.status = 403;
          return { error: "ไม่มีสิทธิ์แก้ไขไฟล์นี้" };
        }

        return { id: updated.id, isPublic: updated.is_public };
      },
      {
        body: t.String(),
      },
    ),
);
