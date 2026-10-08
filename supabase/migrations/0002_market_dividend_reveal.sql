-- Upgrade an existing classroom database once in Supabase SQL Editor.
-- The old positive/zero dividend call keeps its original behaviour.
-- A -1 dividend is an internal signal to close trading without paying yet.
BEGIN;

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
  IF current_room.type = 'market' AND current_room.stage NOT IN ('lobby', 'trading') THEN
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
