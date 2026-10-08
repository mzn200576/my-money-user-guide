import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("student"),
    status: text("status").notNull().default("active"),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    createdAt,
  },
  (table) => [uniqueIndex("uq_users_username").on(table.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt,
  },
  (table) => [index("idx_sessions_user_id").on(table.userId)],
);

export const courses = pgTable(
  "courses",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    cohort: text("cohort").notNull().default(""),
    ownerId: text("owner_id").notNull().references(() => users.id),
    status: text("status").notNull().default("active"),
    createdAt,
  },
  (table) => [index("idx_courses_owner_id").on(table.ownerId)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    courseId: text("course_id").references(() => courses.id),
    status: text("status").notNull().default("lobby"),
    stage: text("stage").notNull().default("lobby"),
    experiment: integer("experiment").notNull().default(1),
    round: integer("round").notNull().default(1),
    config: text("config").notNull().default("{}"),
    shockKey: text("shock_key"),
    dividendPaid: integer("dividend_paid").notNull().default(0),
    stageEndsAt: timestamp("stage_ends_at", { withTimezone: true, mode: "string" }),
    version: integer("version").notNull().default(1),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_rooms_code").on(table.code),
    index("idx_rooms_owner_id").on(table.ownerId),
  ],
);

export const roomMembers = pgTable(
  "room_members",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    roleKey: text("role_key"),
    privateInfo: text("private_info"),
    joinedAt: createdAt,
  },
  (table) => [
    uniqueIndex("uq_room_members_room_user").on(table.roomId, table.userId),
    index("idx_room_members_room_id").on(table.roomId),
  ],
);

export const allocationSubmissions = pgTable(
  "allocation_submissions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull().references(() => roomMembers.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    weights: text("weights").notNull(),
    risks: text("risks").notNull().default("[]"),
    reason: text("reason").notNull().default(""),
    createdAt,
  },
  (table) => [
    uniqueIndex("uq_allocation_submission_version").on(table.roomId, table.memberId, table.version),
    index("idx_allocation_submissions_room_id").on(table.roomId),
  ],
);

export const marketHoldings = pgTable(
  "market_holdings",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull().references(() => roomMembers.id, { onDelete: "cascade" }),
    cashCents: integer("cash_cents").notNull().default(5000),
    shares: integer("shares").notNull().default(5),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_market_holdings_room_member").on(table.roomId, table.memberId),
    index("idx_market_holdings_room_id").on(table.roomId),
  ],
);

export const marketOrders = pgTable(
  "market_orders",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull().references(() => roomMembers.id, { onDelete: "cascade" }),
    experiment: integer("experiment").notNull(),
    round: integer("round").notNull(),
    side: text("side").notNull(),
    priceCents: integer("price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    remaining: integer("remaining").notNull(),
    status: text("status").notNull().default("open"),
    createdAt,
  },
  (table) => [
    uniqueIndex("uq_market_order_round_member").on(table.roomId, table.memberId, table.experiment, table.round),
    index("idx_market_orders_round").on(table.roomId, table.experiment, table.round),
  ],
);

export const marketTrades = pgTable(
  "market_trades",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    experiment: integer("experiment").notNull(),
    round: integer("round").notNull(),
    buyerMemberId: text("buyer_member_id").notNull(),
    sellerMemberId: text("seller_member_id").notNull(),
    priceCents: integer("price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt,
  },
  (table) => [index("idx_market_trades_round").on(table.roomId, table.experiment, table.round)],
);

export const userArtifacts = pgTable(
  "user_artifacts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    version: integer("version").notNull().default(1),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_user_artifacts_user_type").on(table.userId, table.type),
    index("idx_user_artifacts_user_id").on(table.userId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type RoomRow = typeof rooms.$inferSelect;
export type RoomMemberRow = typeof roomMembers.$inferSelect;
export type AllocationSubmissionRow = typeof allocationSubmissions.$inferSelect;
export type MarketHoldingRow = typeof marketHoldings.$inferSelect;
export type MarketOrderRow = typeof marketOrders.$inferSelect;
export type MarketTradeRow = typeof marketTrades.$inferSelect;
export type UserArtifactRow = typeof userArtifacts.$inferSelect;
