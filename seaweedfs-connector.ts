import { S3Client } from "bun";

const s3 = new S3Client({
  endpoint: "http://192.168.1.44:30304",
  region: "us-east-1",
  bucket: "school",
  accessKeyId: "KUCB4QNKZY908AVXYS87",
  secretAccessKey:process.env.SEAWEED_FS_SA
});

export default s3;
