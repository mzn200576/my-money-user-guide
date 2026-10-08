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
