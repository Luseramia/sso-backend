CREATE TABLE "financial_companies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" varchar(240) NOT NULL,
	"ticker" varchar(30),
	"market" varchar(80),
	"industry" varchar(160),
	"sector" varchar(160),
	"country" varchar(80) DEFAULT 'TH',
	"default_currency" varchar(10) DEFAULT 'THB' NOT NULL,
	"create_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"company_id" integer NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_type" varchar(30) NOT NULL,
	"statement_type" varchar(40) DEFAULT 'BALANCE_SHEET' NOT NULL,
	"period_end" date NOT NULL,
	"fiscal_year" integer NOT NULL,
	"currency" varchar(10) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"status" varchar(40) DEFAULT 'READY' NOT NULL,
	"validation_status" varchar(20) NOT NULL,
	"validation_difference" numeric(30,4) NOT NULL,
	"create_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_values" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"company_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"canonical_code" varchar(100) NOT NULL,
	"period_end" date NOT NULL,
	"fiscal_year" integer NOT NULL,
	"value" numeric(30,4) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"original_label" text NOT NULL,
	"original_value" text NOT NULL,
	"mapping_confidence" numeric(5,4) NOT NULL,
	"mapping_source" varchar(30) NOT NULL,
	"source_row" integer NOT NULL,
	"create_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_account_mappings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"company_id" integer,
	"original_label" text NOT NULL,
	"normalized_label" text NOT NULL,
	"canonical_code" varchar(100) NOT NULL,
	"confidence" numeric(5,4) NOT NULL,
	"mapping_source" varchar(30) NOT NULL,
	"approved" integer DEFAULT 1 NOT NULL,
	"create_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "financial_companies_owner_idx" ON "financial_companies" ("create_by_user_id");
--> statement-breakpoint
CREATE INDEX "financial_values_company_period_idx" ON "financial_values" ("company_id", "period_end");
--> statement-breakpoint
CREATE INDEX "financial_mappings_owner_label_idx" ON "financial_account_mappings" ("create_by_user_id", "normalized_label");
