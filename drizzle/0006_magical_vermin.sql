CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL,
	"test" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_upload" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "file_upload_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"file_name" varchar(200) NOT NULL,
	"create_by_user_id" integer,
	"craeted_at" timestamp DEFAULT now(),
	"updated_at" date,
	"updatedAt" timestamp (3),
	"deleted_at" date
);
