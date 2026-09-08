import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLog,
  donations,
  donorCards,
  engagements,
  people,
  specialDates,
} from "@/db/schema";
const idFrom = (request: Request) =>
  Number(new URL(request.url).pathname.split("/").filter(Boolean).at(-1));
const headers = {
  "cache-control": "private, max-age=15, stale-while-revalidate=45",
};

export async function GET(request: Request) {
  try {
    const id = idFrom(request),
      section = new URL(request.url).searchParams.get("section") || "summary",
      db = getDb();
    if (!id) return Response.json({ error: "מזהה חסר" }, { status: 400 });
    if (section === "donations") {
      const rows = await db
        .select()
        .from(donations)
        .where(
          and(
            eq(donations.donorId, id),
            eq(donations.movementType, "donation"),
          ),
        )
        .orderBy(desc(donations.date), desc(donations.id))
        .limit(200);
      return Response.json({ donations: rows }, { headers });
    }
    if (section === "engagements") {
      const rows = await db
        .select()
        .from(engagements)
        .where(eq(engagements.donorCardId, id))
        .orderBy(desc(engagements.occurredAt), desc(engagements.id))
        .limit(100);
      return Response.json({ engagements: rows }, { headers });
    }
    const [[donor], persons, dates, statsRows, trend] = await Promise.all([
      db.select().from(donorCards).where(eq(donorCards.id, id)).limit(1),
      db
        .select()
        .from(people)
        .where(eq(people.donorCardId, id))
        .orderBy(people.id),
      db.select().from(specialDates).where(eq(specialDates.donorCardId, id)),
      db
        .select({
          total: sql<number>`coalesce(sum(${donations.amount}),0)`,
          yearTotal: sql<number>`coalesce(sum(case when ${donations.date} >= date('now','-12 months') then ${donations.amount} else 0 end),0)`,
          count: sql<number>`count(*)`,
          average: sql<number>`coalesce(avg(case when ${donations.isRecurring}=0 then ${donations.amount} end),0)`,
          lastDate: sql<string | null>`max(${donations.date})`,
        })
        .from(donations)
        .where(
          and(
            eq(donations.donorId, id),
            eq(donations.movementType, "donation"),
          ),
        ),
      db
        .select({
          month: sql<string>`substr(${donations.date},1,7)`,
          amount: sql<number>`sum(${donations.amount})`,
          count: sql<number>`count(*)`,
        })
        .from(donations)
        .where(
          and(
            eq(donations.donorId, id),
            eq(donations.movementType, "donation"),
            sql`${donations.date} >= date('now','start of month','-11 months')`,
          ),
        )
        .groupBy(sql`substr(${donations.date},1,7)`)
        .orderBy(sql`substr(${donations.date},1,7)`),
    ]);
    if (!donor)
      return Response.json({ error: "כרטיס התורם לא נמצא" }, { status: 404 });
    const personDates = persons.length
      ? await db
          .select()
          .from(specialDates)
          .where(
            inArray(
              specialDates.personId,
              persons.map((p) => p.id),
            ),
          )
      : [];
    let linkedIds: number[] = [];
    try {
      linkedIds = JSON.parse(donor.linkedPeopleIds || "[]");
    } catch {}
    const orderedPeople = linkedIds.length
      ? [...persons].sort(
          (a, b) => linkedIds.indexOf(a.id) - linkedIds.indexOf(b.id),
        )
      : persons;
    return Response.json(
      {
        donor: {
          ...donor,
          name: donor.cardName,
          linkedPeopleIds: orderedPeople.map((person) => person.id),
          specialDates: dates,
        },
        people: orderedPeople.map((person) => ({
          ...person,
          specialDates: personDates.filter(
            (date) => date.personId === person.id,
          ),
        })),
        stats: statsRows[0],
        trend,
      },
      { headers },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const donorCardId = idFrom(request),
      p = (await request.json()) as Record<string, unknown>,
      db = getDb();
    if (!donorCardId)
      return Response.json({ error: "מזהה חסר" }, { status: 400 });
    if (p.action === "person") {
      const fullName = String(p.fullName || "").trim();
      if (!fullName)
        return Response.json({ error: "יש להזין שם" }, { status: 400 });
      const [person] = await db
        .insert(people)
        .values({
          donorCardId,
          fullName,
          greetingName: String(p.greetingName || ""),
          alternativeNames: String(p.alternativeNames || ""),
          phone: String(p.phone || ""),
          secondaryPhone: String(p.secondaryPhone || ""),
          email: String(p.email || ""),
          postalAddress: String(p.postalAddress || ""),
          idNumber: String(p.idNumber || ""),
          preferredMethod: String(p.preferredMethod || "WhatsApp"),
          notes: String(p.notes || ""),
        })
        .returning();
      await db
        .insert(auditLog)
        .values({
          action: "person_created",
          entityType: "person",
          entityId: String(person.id),
          details: JSON.stringify({ donorCardId }),
        });
      return Response.json({ person }, { status: 201 });
    }
    const summary = String(p.summary || "").trim();
    if (!summary)
      return Response.json({ error: "יש להזין סיכום קצר" }, { status: 400 });
    const [engagement] = await db
      .insert(engagements)
      .values({
        donorCardId,
        personId: p.personId ? Number(p.personId) : null,
        kind: String(p.kind || "שיחת טלפון"),
        summary,
        occurredAt: String(p.occurredAt || new Date().toISOString()),
        outcome: String(p.outcome || ""),
        followUpDate: p.followUpDate ? String(p.followUpDate) : null,
      })
      .returning();
    await db
      .insert(auditLog)
      .values({
        action: "engagement_created",
        entityType: "engagement",
        entityId: String(engagement.id),
        details: JSON.stringify({ donorCardId }),
      });
    return Response.json({ engagement }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 500 },
    );
  }
}
