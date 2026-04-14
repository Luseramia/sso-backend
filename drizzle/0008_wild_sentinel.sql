CREATE TABLE "bank_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"datetime" timestamp NOT NULL,
	"transaction_type" varchar(100) NOT NULL,
	"withdrawal" numeric(15, 2),
	"deposit" numeric(15, 2),
	"balance" numeric(15, 2) NOT NULL,
	"channel" varchar(50) NOT NULL,
	"details" text,
	"craeted_at" timestamp DEFAULT now(),
	"updated_at" date,
	"updatedAt" timestamp (3),
	"deleted_at" date
);
