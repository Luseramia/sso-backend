CREATE TABLE "financial_import_sources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"company_id" integer NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_type" varchar(30) NOT NULL,
	"scope" varchar(30) NOT NULL,
	"raw_hash" varchar(64) NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"create_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_documents" ADD COLUMN "source_id" integer;
--> statement-breakpoint
CREATE INDEX "financial_import_sources_owner_idx" ON "financial_import_sources" ("create_by_user_id");
