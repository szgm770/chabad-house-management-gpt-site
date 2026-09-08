import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attentionItems,
  donations,
  donorCards,
  engagements,
  people,
  recurringCommitments,
  reviewRecipients,
  specialDates,
  tasks,
} from "@/db/schema";

type Db = ReturnType<typeof getDb>;

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function refreshAttentionItems(db: Db) {
  const candidates: Array<{
    kind: string;
    entityType: string;
    entityId: string;
    donorCardId?: number | null;
    personId?: number | null;
    title: string;
    detail: string;
    priority: string;
    dueDate?: string | null;
    dedupeKey: string;
  }> = [];

  const [badRecipients, unmatchedDonations, dueTasks, endingRecurring, followUps, upcomingSpecialDates, donorFollowUps] =
    await Promise.all([
      db
        .select()
        .from(reviewRecipients)
        .where(and(ne(reviewRecipients.issue, ""), eq(reviewRecipients.status, "pending"))),
      db
        .select()
        .from(donations)
        .where(and(eq(donations.movementType, "donation"), isNull(donations.donorId))),
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.completed, false), lte(tasks.dueDate, today()))),
      db
        .select()
        .from(recurringCommitments)
        .where(
          and(
            or(
              eq(recurringCommitments.status, "active"),
              eq(recurringCommitments.status, "paused"),
            ),
            lte(recurringCommitments.endDate, inDays(30)),
          ),
        ),
      db
        .select()
        .from(engagements)
        .where(lte(engagements.followUpDate, today())),
      db
        .select()
        .from(specialDates)
        .where(and(ne(specialDates.civilDate, ""), lte(specialDates.civilDate, inDays(30)))),
      db.select().from(donorCards).where(and(lte(donorCards.nextContactDate,today()),ne(donorCards.relationshipStatus,"handled"),ne(donorCards.relationshipStatus,"not_now"))),
    ]);

  for (const row of badRecipients)
    candidates.push({
      kind: "review_destination",
      entityType: "review_recipient",
      entityId: String(row.id),
      donorCardId: row.donorCardId,
      personId: row.personId,
      title: `פרטי משלוח חסרים עבור ${row.greetingName}`,
      detail: row.issue,
      priority: "high",
      dedupeKey: `review-recipient:${row.id}:${row.issue}`,
    });
  for (const row of unmatchedDonations)
    candidates.push({
      kind: "unmatched_donation",
      entityType: "donation",
      entityId: String(row.id),
      title: `תרומה של ${row.donorName} אינה משויכת`,
      detail: row.matchReason || "נדרש לבחור כרטיס תורם",
      priority: "high",
      dedupeKey: `unmatched-donation:${row.id}`,
    });
  for (const row of dueTasks)
    candidates.push({
      kind: "due_task",
      entityType: "task",
      entityId: String(row.id),
      donorCardId: row.donorCardId,
      personId: row.personId,
      title: row.title,
      detail: row.detail,
      priority: row.priority,
      dueDate: row.dueDate,
      dedupeKey: `task:${row.id}`,
    });
  for (const row of endingRecurring)
    candidates.push({
      kind: "recurring_ending",
      entityType: "recurring",
      entityId: String(row.id),
      donorCardId: row.donorCardId,
      personId: row.personId,
      title: row.endDate && row.endDate < today() ? "הוראת קבע הסתיימה" : "הוראת קבע מתקרבת לסיום",
      detail: `${row.amount} ${row.currency} · תאריך סיום ${row.endDate || "לא הוגדר"}`,
      priority: row.endDate && row.endDate < today() ? "high" : "medium",
      dueDate: row.endDate,
      dedupeKey: `recurring-ending:${row.id}`,
    });
  for (const row of followUps)
    candidates.push({
      kind: "engagement_follow_up",
      entityType: "engagement",
      entityId: String(row.id),
      donorCardId: row.donorCardId,
      personId: row.personId,
      title: "הגיע מועד פעולת המשך",
      detail: row.summary,
      priority: "medium",
      dueDate: row.followUpDate,
      dedupeKey: `engagement-follow-up:${row.id}`,
    });
  for (const row of upcomingSpecialDates) {
    if (!row.civilDate || row.civilDate < today()) continue;
    candidates.push({
      kind: "special_date",
      entityType: "special_date",
      entityId: String(row.id),
      donorCardId: row.donorCardId,
      personId: row.personId,
      title: `${row.customName || row.kind} מתקרב`,
      detail: `${row.hebrewDay} ב${row.hebrewMonth}${row.notes ? ` · ${row.notes}` : ""}`,
      priority: row.civilDate <= inDays(7) ? "high" : "medium",
      dueDate: row.civilDate,
      dedupeKey: `special-date:${row.id}:${row.civilDate}`,
    });
  }
  for(const row of donorFollowUps)candidates.push({kind:"relationship_follow_up",entityType:"donor_card",entityId:String(row.id),donorCardId:row.id,title:`הגיע מועד קשר עם ${row.cardName}`,detail:row.nextAction||row.relationshipNotes||"נדרש ליצור קשר",priority:row.priorityRank<=4?"high":"medium",dueDate:row.nextContactDate,dedupeKey:`relationship-follow-up:${row.id}:${row.nextContactDate}`});

  for (const item of candidates)
    await db
      .insert(attentionItems)
      .values(item)
      .onConflictDoUpdate({
        target: attentionItems.dedupeKey,
        set: {
          title: item.title,
          detail: item.detail,
          priority: item.priority,
          dueDate: item.dueDate || null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  return candidates.length;
}
