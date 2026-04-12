import Elysia, { status, t } from "elysia";
import s3 from "./seaweedfs-connector";
import type { S3File } from "bun";
import { log2 } from "@noble/curves/abstract/fft.js";
import { $ } from "bun";
import UploadFileService from "./services/ีupload-file/upload-file.service";
import { fileUploadTable } from "./db/file-upload.schema";

const uploadFileService = new UploadFileService();

export const fileManagerController = new Elysia().group("/file", (app) =>
  app
    .post(
      "/upload/presign",
      async ({ body, headers }) => {
        const token = headers.authorization?.split(" ")[1]?.split(".")[0];
        console.log("token", token);

        if (token) {
          const userData = Buffer.from(token, "base64").toString("utf-8");
          const JsonData = JSON.parse(userData);

          const json = JSON.parse(body);
          const { name, type, size, thumbnailUrl } = json;

          const base64Data = thumbnailUrl.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");
          const uuid = crypto.randomUUID();

          s3.write(`thumbnails/${uuid}.jpg`, buffer);
          const url = s3.presign(`uploads/video/${uuid}`, {
            method: "PUT",
            expiresIn: 300, // 5 นาที
            bucket: "school",
            type: "application/octet-stream",
          });

          uploadFileService.uploadFile({
            file_name: uuid,
            original_file_name: name,
            create_by_user_id: JsonData.id,
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
      async ({ body }) => {
        // const key = `uploads/${crypto.randomUUID()}`;
        // console.log('at dowload');
        const jsonData = JSON.parse(body);
        const { id } = jsonData;
        const file = await uploadFileService.getOne(id);
        console.log("findoneee", file);
        if (file) {
          const url = s3.presign("uploads/video/" + file.file_name, {
            method: "GET",
            expiresIn: 3600,
            bucket: "school",
          });
          return { url };
        }
        return true;
      },
      {
        body: t.String(),
      },
    )
    .get(
      "/all/thumnail",
      async () => {
        const data = await uploadFileService.getAllFile();

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
    ),
);
