CREATE TABLE "allocation_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"member_id" text NOT NULL,
	"version" integer NOT NULL,
	"weights" text NOT NULL,
	"risks" text DEFAULT '[]' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"cohort" text DEFAULT '' NOT NULL,
	"owner_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"member_id" text NOT NULL,
	"cash_cents" integer DEFAULT 5000 NOT NULL,
	"shares" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"member_id" text NOT NULL,
	"experiment" integer NOT NULL,
	"round" integer NOT NULL,
	"side" text NOT NULL,
	"price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"remaining" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_trades" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"experiment" integer NOT NULL,
	"round" integer NOT NULL,
	"buyer_member_id" text NOT NULL,
	"seller_member_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_members" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"nickname" text NOT NULL,
	"role_key" text,
	"private_info" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"owner_id" text NOT NULL,
	"course_id" text,
	"status" text DEFAULT 'lobby' NOT NULL,
	"stage" text DEFAULT 'lobby' NOT NULL,
	"experiment" integer DEFAULT 1 NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"shock_key" text,
	"dividend_paid" integer DEFAULT 0 NOT NULL,
	"stage_ends_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocation_submissions" ADD CONSTRAINT "allocation_submissions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_submissions" ADD CONSTRAINT "allocation_submissions_member_id_room_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."room_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_holdings" ADD CONSTRAINT "market_holdings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_holdings" ADD CONSTRAINT "market_holdings_member_id_room_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."room_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_member_id_room_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."room_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artifacts" ADD CONSTRAINT "user_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_allocation_submission_version" ON "allocation_submissions" USING btree ("room_id","member_id","version");--> statement-breakpoint
CREATE INDEX "idx_allocation_submissions_room_id" ON "allocation_submissions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_courses_owner_id" ON "courses" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_market_holdings_room_member" ON "market_holdings" USING btree ("room_id","member_id");--> statement-breakpoint
CREATE INDEX "idx_market_holdings_room_id" ON "market_holdings" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_market_order_round_member" ON "market_orders" USING btree ("room_id","member_id","experiment","round");--> statement-breakpoint
CREATE INDEX "idx_market_orders_round" ON "market_orders" USING btree ("room_id","experiment","round");--> statement-breakpoint
CREATE INDEX "idx_market_trades_round" ON "market_trades" USING btree ("room_id","experiment","round");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_members_room_user" ON "room_members" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_room_members_room_id" ON "room_members" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rooms_code" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_rooms_owner_id" ON "rooms" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_artifacts_user_type" ON "user_artifacts" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "idx_user_artifacts_user_id" ON "user_artifacts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_username" ON "users" USING btree ("username");
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "room_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "allocation_submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "market_holdings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "market_orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "market_trades" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_artifacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.users, public.sessions, public.courses, public.rooms, public.room_members, public.allocation_submissions, public.market_holdings, public.market_orders, public.market_trades, public.user_artifacts FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users, public.sessions, public.courses, public.rooms, public.room_members, public.allocation_submissions, public.market_holdings, public.market_orders, public.market_trades, public.user_artifacts TO service_role;
--> statement-breakpoint
