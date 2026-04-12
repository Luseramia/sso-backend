CREATE TABLE "file_upload" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "file_upload_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"file_Fname" varchar(200) NOT NULL,
	"craeted_at" timestamp DEFAULT now(),
	"updated_at" date,
	"updatedAt" timestamp (3),
	"alwaysNull" text,
	"deleted_at" date
);
