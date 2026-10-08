-- NEW, EMPTY SUPABASE PROJECT ONLY. Run once in SQL Editor.
-- Existing classroom accounts and rooms are not copied by this file.
BEGIN;
-- 0000_hot_ultimatum.sql
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


-- 0001_classroom_transactions.sql
-- These functions are server-only. Public visitors have no direct table access.
CREATE OR REPLACE FUNCTION public.bump_classroom_version() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE rooms SET version = version + 1
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.room_id ELSE NEW.room_id END;
  RETURN NULL;
END;
$$;

CREATE TRIGGER room_members_version AFTER INSERT OR UPDATE OR DELETE ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.bump_classroom_version();
CREATE TRIGGER market_holdings_version AFTER INSERT OR UPDATE OR DELETE ON public.market_holdings
FOR EACH ROW EXECUTE FUNCTION public.bump_classroom_version();

CREATE OR REPLACE FUNCTION public.join_classroom(
  p_member_id text, p_room_id text, p_user_id text, p_nickname text,
  p_role_key text, p_private_info text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  current_room rooms%ROWTYPE;
  existing_id text;
  settings jsonb;
BEGIN
  SELECT * INTO current_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR current_room.status = 'complete' THEN
    RAISE sqlstate 'PT409' USING message = '이미 종료되었거나 없는 방입니다.';
  END IF;
  SELECT id INTO existing_id FROM room_members WHERE room_id = p_room_id AND user_id = p_user_id;
  IF FOUND THEN RETURN existing_id; END IF;

  INSERT INTO room_members (id, room_id, user_id, nickname, role_key, private_info)
  VALUES (p_member_id, p_room_id, p_user_id, p_nickname, p_role_key, p_private_info);
  IF current_room.type = 'market' THEN
    settings := current_room.config::jsonb;
    INSERT INTO market_holdings (id, room_id, member_id, cash_cents, shares)
    VALUES (gen_random_uuid()::text, p_room_id, p_member_id,
      round(COALESCE((settings->>'initialCash')::numeric, 50) * 100)::integer,
      floor(COALESCE((settings->>'initialShares')::numeric, 5))::integer);
  END IF;
  RETURN p_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_market_order(p_order jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  current_room rooms%ROWTYPE;
  current_holding market_holdings%ROWTYPE;
  order_side text := p_order->>'side';
  order_price integer := (p_order->>'price_cents')::integer;
  order_quantity integer := (p_order->>'quantity')::integer;
BEGIN
  SELECT * INTO current_room FROM rooms WHERE id = p_order->>'room_id' FOR UPDATE;
  IF NOT FOUND OR current_room.type <> 'market' OR current_room.stage <> 'trading'
    OR current_room.experiment IS DISTINCT FROM (p_order->>'experiment')::integer
    OR current_room.round IS DISTINCT FROM (p_order->>'round')::integer THEN
    RAISE sqlstate 'PT409' USING message = '장이 마감되었습니다. 다음 라운드에 주문해주세요.';
  END IF;
  IF order_side IS NULL OR order_side NOT IN ('buy', 'sell')
    OR order_price IS NULL OR order_price <= 0 OR order_quantity IS NULL OR order_quantity <= 0 THEN
    RAISE sqlstate 'PT400' USING message = '가격과 수량을 확인해주세요.';
  END IF;
  SELECT * INTO current_holding FROM market_holdings
  WHERE room_id = current_room.id AND member_id = p_order->>'member_id';
  IF NOT FOUND THEN RAISE sqlstate 'PT409' USING message = '잔고를 찾을 수 없습니다.'; END IF;
  IF (order_side = 'buy' AND order_price::bigint * order_quantity > current_holding.cash_cents)
    OR (order_side = 'sell' AND order_quantity > current_holding.shares) THEN
    RAISE sqlstate 'PT409' USING message = '잔고가 변경되었습니다. 주문을 다시 확인해주세요.';
  END IF;

  INSERT INTO market_orders (id, room_id, member_id, experiment, round, side, price_cents, quantity, remaining, status, created_at)
  VALUES (p_order->>'id', current_room.id, p_order->>'member_id', current_room.experiment, current_room.round,
    order_side, order_price, order_quantity, order_quantity, 'open', CURRENT_TIMESTAMP)
  ON CONFLICT (room_id, member_id, experiment, round) DO UPDATE SET
    side = excluded.side, price_cents = excluded.price_cents, quantity = excluded.quantity,
    remaining = excluded.remaining, status = 'open', created_at = excluded.created_at;
  UPDATE rooms SET version = version + 1 WHERE id = current_room.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_market_close(
  p_room_id text, p_experiment integer, p_round integer, p_version integer, p_dividend_paid integer,
  p_holdings jsonb, p_trades jsonb, p_orders jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item jsonb;
  current_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO current_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR current_room.stage <> 'trading'
    OR current_room.experiment IS DISTINCT FROM p_experiment OR current_room.round IS DISTINCT FROM p_round
    OR current_room.version IS DISTINCT FROM p_version THEN
    RAISE sqlstate 'PT409' USING message = '주문이나 참가자가 갱신되었습니다. 장 마감을 다시 눌러주세요.';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_holdings) LOOP
    UPDATE market_holdings SET cash_cents = (item->>'cash_cents')::integer,
      shares = (item->>'shares')::integer, updated_at = CURRENT_TIMESTAMP
    WHERE id = item->>'id' AND room_id = p_room_id;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(p_trades) LOOP
    INSERT INTO market_trades (id, room_id, experiment, round, buyer_member_id, seller_member_id, price_cents, quantity)
    VALUES (item->>'id', p_room_id, p_experiment, p_round,
      item->>'buyer_member_id', item->>'seller_member_id', (item->>'price_cents')::integer, (item->>'quantity')::integer);
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(p_orders) LOOP
    UPDATE market_orders SET remaining = (item->>'remaining')::integer, status = item->>'status'
    WHERE id = item->>'id' AND room_id = p_room_id AND experiment = p_experiment AND round = p_round;
  END LOOP;
  UPDATE rooms SET stage = 'results', stage_ends_at = NULL, dividend_paid = p_dividend_paid,
    version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = p_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_classroom_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_classroom(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_market_order(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_market_close(text, integer, integer, integer, integer, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_classroom_version() TO service_role;
GRANT EXECUTE ON FUNCTION public.join_classroom(text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_market_order(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_market_close(text, integer, integer, integer, integer, jsonb, jsonb, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';


-- 0002_market_dividend_reveal.sql
-- Upgrade an existing classroom database once in Supabase SQL Editor.
-- The old positive/zero dividend call keeps its original behaviour.
-- A -1 dividend is an internal signal to close trading without paying yet.

-- Prevent a late entrant from receiving the just-closed round's dividend.
CREATE OR REPLACE FUNCTION public.join_classroom(
  p_member_id text, p_room_id text, p_user_id text, p_nickname text,
  p_role_key text, p_private_info text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  current_room rooms%ROWTYPE;
  existing_id text;
  settings jsonb;
BEGIN
  SELECT * INTO current_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR current_room.status = 'complete' THEN
    RAISE sqlstate 'PT409' USING message = '이미 종료되었거나 없는 방입니다.';
  END IF;
  SELECT id INTO existing_id FROM room_members WHERE room_id = p_room_id AND user_id = p_user_id;
  IF FOUND THEN RETURN existing_id; END IF;
  IF current_room.type = 'market' AND current_room.stage = 'awaiting_dividend' THEN
    RAISE sqlstate 'PT409' USING message = '배당 추첨이 끝난 다음 장에서 입장할 수 있습니다.';
  END IF;
  INSERT INTO room_members (id, room_id, user_id, nickname, role_key, private_info)
  VALUES (p_member_id, p_room_id, p_user_id, p_nickname, p_role_key, p_private_info);
  IF current_room.type = 'market' THEN
    settings := current_room.config::jsonb;
    INSERT INTO market_holdings (id, room_id, member_id, cash_cents, shares)
    VALUES (gen_random_uuid()::text, p_room_id, p_member_id,
      round(COALESCE((settings->>'initialCash')::numeric, 50) * 100)::integer,
      floor(COALESCE((settings->>'initialShares')::numeric, 5))::integer);
  END IF;
  RETURN p_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_market_close(
  p_room_id text, p_experiment integer, p_round integer, p_version integer, p_dividend_paid integer,
  p_holdings jsonb, p_trades jsonb, p_orders jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item jsonb;
  current_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO current_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR current_room.stage <> 'trading'
    OR current_room.experiment IS DISTINCT FROM p_experiment OR current_room.round IS DISTINCT FROM p_round
    OR current_room.version IS DISTINCT FROM p_version THEN
    RAISE sqlstate 'PT409' USING message = '주문이나 참가자가 갱신되었습니다. 장 마감을 다시 눌러주세요.';
  END IF;
  IF p_dividend_paid < -1 THEN
    RAISE sqlstate 'PT400' USING message = '배당금을 확인해주세요.';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_holdings) LOOP
    UPDATE market_holdings SET cash_cents = (item->>'cash_cents')::integer,
      shares = (item->>'shares')::integer, updated_at = CURRENT_TIMESTAMP
    WHERE id = item->>'id' AND room_id = p_room_id;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(p_trades) LOOP
    INSERT INTO market_trades (id, room_id, experiment, round, buyer_member_id, seller_member_id, price_cents, quantity)
    VALUES (item->>'id', p_room_id, p_experiment, p_round,
      item->>'buyer_member_id', item->>'seller_member_id', (item->>'price_cents')::integer, (item->>'quantity')::integer);
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(p_orders) LOOP
    UPDATE market_orders SET remaining = (item->>'remaining')::integer, status = item->>'status'
    WHERE id = item->>'id' AND room_id = p_room_id AND experiment = p_experiment AND round = p_round;
  END LOOP;
  UPDATE rooms SET stage = CASE WHEN p_dividend_paid = -1 THEN 'awaiting_dividend' ELSE 'results' END,
    stage_ends_at = NULL, dividend_paid = greatest(p_dividend_paid, 0),
    version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = p_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.market_dividend_v2_available() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT true $$;

CREATE OR REPLACE FUNCTION public.decide_market_dividend(
  p_room_id text, p_experiment integer, p_round integer, p_version integer, p_dividend_paid integer
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  current_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO current_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR current_room.type <> 'market' OR current_room.stage <> 'awaiting_dividend'
    OR current_room.experiment IS DISTINCT FROM p_experiment OR current_room.round IS DISTINCT FROM p_round
    OR current_room.version IS DISTINCT FROM p_version THEN
    RAISE sqlstate 'PT409' USING message = '이미 배당이 결정되었거나 방이 갱신되었습니다.';
  END IF;
  IF p_dividend_paid < 0 OR p_dividend_paid > 2147483647 THEN
    RAISE sqlstate 'PT400' USING message = '배당금을 확인해주세요.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM market_holdings
    WHERE room_id = p_room_id AND cash_cents::bigint + shares::bigint * p_dividend_paid > 2147483647
  ) THEN
    RAISE sqlstate 'PT400' USING message = '배당 지급 결과가 잔고 한도를 넘었습니다.';
  END IF;
  UPDATE market_holdings
  SET cash_cents = (cash_cents::bigint + shares::bigint * p_dividend_paid)::integer,
    updated_at = CURRENT_TIMESTAMP
  WHERE room_id = p_room_id;
  UPDATE rooms SET dividend_paid = p_dividend_paid, stage = 'results',
    stage_ends_at = CURRENT_TIMESTAMP + INTERVAL '8 seconds',
    version = version + 1, updated_at = CURRENT_TIMESTAMP
  WHERE id = p_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.market_dividend_v2_available() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_market_dividend(text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_dividend_v2_available() TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_market_dividend(text, integer, integer, integer, integer) TO service_role;
NOTIFY pgrst, 'reload schema';


COMMIT;
