import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const donorCards = sqliteTable("donor_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardName: text("name").notNull(),
  cardNameMode: text("card_name_mode").notNull().default("AUTO"),
  linkedPeopleIds: text("linked_people_ids").notNull().default("[]"),
  type: text("type").notNull().default("יחיד"),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  alias: text("alias").notNull().default(""),
  secondaryPhone: text("secondary_phone").notNull().default(""),
  idNumber: text("id_number").notNull().default(""),
  address: text("address").notNull().default(""),
  preferredMethod: text("preferred_method").notNull().default("WhatsApp"),
  status: text("status").notNull().default("פעיל"),
  notes: text("notes").notNull().default(""),
  cultivationPriority: text("cultivation_priority").notNull().default("רגילה"),
  estimatedCapacity: real("estimated_capacity").notNull().default(0),
  interests: text("interests").notNull().default(""),
  connection: text("connection").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  nextContactDate: text("next_contact_date"),
  recurringStatus: text("recurring_status").notNull().default("NONE"),
  recurringAmount: real("recurring_amount").notNull().default(0),
  recurringDay: integer("recurring_day"),
  recurringStartDate: text("recurring_start_date"),
  recurringEndDate: text("recurring_end_date"),
  fundraisingRank: integer("fundraising_rank").notNull().default(99),
  manualRelationshipGroups: text("manual_relationship_groups").notNull().default("[]"),
  automaticRelationshipGroups: text("automatic_relationship_groups").notNull().default("[]"),
  relationshipStatus: text("relationship_status").notNull().default("needs_contact"),
  relationshipNotes: text("relationship_notes").notNull().default(""),
  relationshipHandledBy: text("relationship_handled_by").notNull().default(""),
  eligibleForRecurringIncrease: integer("eligible_for_recurring_increase", { mode: "boolean" }).notNull().default(false),
  priorityRank: integer("priority_rank").notNull().default(99),
  priorityScore: integer("priority_score").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_donor_cards_relationship_rank").on(table.priorityRank, table.priorityScore),
  index("idx_donor_cards_follow_up").on(table.relationshipStatus, table.nextContactDate),
]);
export const donations = sqliteTable(
  "donations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    donorId: integer("donor_id").references(() => donorCards.id),
    personId: integer("person_id").references(() => people.id),
    donorName: text("donor_name").notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("ILS"),
    date: text("date").notNull(),
    paymentMethod: text("payment_method").notNull(),
    purpose: text("purpose").notNull().default(""),
    reason: text("reason").notNull().default(""),
    feePercentage: real("fee_percentage").notNull().default(0),
    feeAmount: real("fee_amount").notNull().default(0),
    netAmount: real("net_amount").notNull().default(0),
    expectedSettlementDate: text("expected_settlement_date"),
    actualSettlementDate: text("actual_settlement_date"),
    settlementReview: integer("settlement_review", { mode: "boolean" }).notNull().default(false),
    isRecurring: integer("is_recurring", { mode: "boolean" })
      .notNull()
      .default(false),
    externalId: text("external_id"),
    importFingerprint: text("import_fingerprint"),
    source: text("source").notNull().default("manual"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    movementType: text("movement_type").notNull().default("donation"),
    matchStatus: text("match_status").notNull().default("matched"),
    matchReason: text("match_reason").notNull().default(""),
    department: text("department").notNull().default(""),
    subcategory: text("subcategory").notNull().default(""),
    rawPayload: text("raw_payload").notNull().default("{}"),
  },
  (table) => [
    index("idx_donations_donor_type_date").on(
      table.donorId,
      table.movementType,
      table.date,
    ),
    index("idx_donations_source_external").on(table.source, table.externalId),
    index("idx_donations_match_status").on(table.matchStatus),
  ],
);
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  priority: text("priority").notNull().default("בינונית"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  donorCardId: integer("donor_card_id").references(() => donorCards.id),
  personId: integer("person_id").references(() => people.id),
  dueDate: text("due_date"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const paymentDeclines = sqliteTable("payment_declines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull().default("nedarim-plus"),
  externalId: text("external_id"),
  recurringId: text("recurring_id"),
  donorName: text("donor_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  idNumber: text("id_number").notNull().default(""),
  amount: real("amount").notNull().default(0),
  currency: text("currency").notNull().default("ILS"),
  message: text("message").notNull(),
  declineSource: text("decline_source").notNull().default("Transaction"),
  occurredAt: text("occurred_at").notNull(),
  rawJson: text("raw_json").notNull().default("{}"),
  handled: integer("handled", { mode: "boolean" }).notNull().default(false),
  handledAt: text("handled_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const feedbackItems = sqliteTable("feedback_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").notNull(),
  category: text("category").notNull().default("suggestion"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  handledAt: text("handled_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  period: text("period").notNull(),
  reviewDate: text("review_date").notNull(),
  status: text("status").notNull().default("active"),
  startDate: text("start_date"),
  includeRecurring: integer("include_recurring", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    donorCardId: integer("donor_card_id").references(() => donorCards.id),
    fullName: text("full_name").notNull(),
    greetingName: text("greeting_name").notNull().default(""),
    alternativeNames: text("alternative_names").notNull().default(""),
    phone: text("phone").notNull().default(""),
    secondaryPhone: text("secondary_phone").notNull().default(""),
    email: text("email").notNull().default(""),
    postalAddress: text("postal_address").notNull().default(""),
    idNumber: text("id_number").notNull().default(""),
    preferredMethod: text("preferred_method").notNull().default("WhatsApp"),
    doNotSend: integer("do_not_send", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_people_donor_card").on(table.donorCardId)],
);
export const specialDates = sqliteTable(
  "special_dates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id").references(() => people.id),
    donorCardId: integer("donor_card_id").references(() => donorCards.id),
    kind: text("kind").notNull(),
    customName: text("custom_name").notNull().default(""),
    hebrewDay: integer("hebrew_day").notNull(),
    hebrewMonth: text("hebrew_month").notNull(),
    hebrewYear: integer("hebrew_year"),
    civilDate: text("civil_date"),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    index("idx_special_dates_donor_card").on(table.donorCardId),
    index("idx_special_dates_person").on(table.personId),
  ],
);
export const engagements = sqliteTable(
  "engagements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    donorCardId: integer("donor_card_id").references(() => donorCards.id),
    personId: integer("person_id").references(() => people.id),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    occurredAt: text("occurred_at").notNull(),
    followUpDate: text("follow_up_date"),
    outcome: text("outcome").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_engagements_donor_occurred").on(
      table.donorCardId,
      table.occurredAt,
    ),
  ],
);
export const reviewRecipients = sqliteTable("review_recipients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reviewId: integer("review_id").references(() => reviews.id),
  personId: integer("person_id").references(() => people.id),
  donorCardId: integer("donor_card_id").references(() => donorCards.id),
  greetingName: text("greeting_name").notNull(),
  destination: text("destination").notNull().default(""),
  method: text("method").notNull(),
  received: integer("received", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("pending"),
  issue: text("issue").notNull().default(""),
  snapshotJson: text("snapshot_json").notNull().default("{}"),
});
export const importRuns = sqliteTable("import_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  filename: text("filename").notNull(),
  fingerprint: text("fingerprint").notNull().unique(),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsImported: integer("rows_imported").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: text("details").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const bankReconciliations = sqliteTable(
  "bank_reconciliations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    currency: text("currency").notNull().default("ILS"),
    expectedBalance: real("expected_balance").notNull(),
    actualBalance: real("actual_balance").notNull(),
    difference: real("difference").notNull(),
    matched: integer("matched", { mode: "boolean" }).notNull().default(false),
    note: text("note").notNull().default(""),
    verifiedBy: text("verified_by").notNull().default(""),
    verifiedAt: text("verified_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_bank_reconciliation_date_currency").on(table.date, table.currency)],
);

export const recurringCommitments = sqliteTable(
  "recurring_commitments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    donorCardId: integer("donor_card_id")
      .notNull()
      .references(() => donorCards.id),
    personId: integer("person_id").references(() => people.id),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("ILS"),
    paymentMethod: text("payment_method").notNull(),
    startDate: text("start_date").notNull(),
    durationMonths: integer("duration_months"),
    expectedDay: integer("expected_day").notNull(),
    endDate: text("end_date"),
    status: text("status").notNull().default("active"),
    source: text("source").notNull().default("manual"),
    externalId: text("external_id"),
    alertDaysBefore: integer("alert_days_before").notNull().default(30),
    rawPayload: text("raw_payload").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_recurring_card_status").on(table.donorCardId, table.status),
    uniqueIndex("idx_recurring_source_external").on(
      table.source,
      table.externalId,
    ),
  ],
);

export const attentionItems = sqliteTable(
  "attention_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    donorCardId: integer("donor_card_id").references(() => donorCards.id),
    personId: integer("person_id").references(() => people.id),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    priority: text("priority").notNull().default("medium"),
    dueDate: text("due_date"),
    status: text("status").notNull().default("open"),
    resolution: text("resolution").notNull().default(""),
    dedupeKey: text("dedupe_key").notNull(),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_attention_dedupe_key").on(table.dedupeKey),
    index("idx_attention_status_due").on(table.status, table.dueDate),
    index("idx_attention_card").on(table.donorCardId),
  ],
);

export const mergeEvents = sqliteTable("merge_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  survivorPersonId: integer("survivor_person_id").references(() => people.id),
  mergedPersonId: integer("merged_person_id").references(() => people.id),
  targetDonorCardId: integer("target_donor_card_id").references(
    () => donorCards.id,
  ),
  snapshotJson: text("snapshot_json").notNull(),
  status: text("status").notNull().default("applied"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  revertedAt: text("reverted_at"),
});

export const duplicateDecisions = sqliteTable("duplicate_decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pairKey: text("pair_key").notNull().unique(),
  leftDonorCardId: integer("left_donor_card_id").references(() => donorCards.id),
  rightDonorCardId: integer("right_donor_card_id").references(() => donorCards.id),
  decision: text("decision").notNull(),
  details: text("details").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
