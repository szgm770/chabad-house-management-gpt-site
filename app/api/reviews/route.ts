import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, donations, donorCards, people, recurringCommitments, reviewRecipients, reviews } from "@/db/schema";

const method = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === "mail" || normalized.includes("דואר")) return "mail";
  if (normalized.includes("email") || normalized.includes("מייל"))
    return "email";
  if (normalized.includes("none") || normalized.includes("לא לשלוח"))
    return "none";
  return "WhatsApp";
};
const cutoff = (period: string, customStart?: string) => {
  if (customStart) return customStart;
  const months =
    period === "חודש אחרון"
      ? 1
      : period === "חודשיים אחרונים"
        ? 2
        : period === "חצי שנה"
          ? 6
          : period === "שנה"
            ? 12
            : 3;
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 10);
};
const destinationIssue = (delivery: string, value: string) => {
  const clean = value.replace(/[\s\-().]/g, "");
  if (delivery === "WhatsApp") {
    if (!clean) return "חסר מספר טלפון";
    if (/^05\d{8}$/.test(clean) || /^\+\d{8,15}$/.test(clean) || /^00\d{8,15}$/.test(clean)) return "";
    return clean.startsWith("0") ? "מספר מקומי אינו מזוהה כמספר נייד ישראלי" : "חסרה קידומת מדינה";
  }
  if (delivery === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "כתובת מייל חסרה או לא תקינה";
  return value.trim() ? "" : "חסרה כתובת למשלוח דואר";
};

export async function GET() {
  try {
    const db = getDb();
    const reviewRows = await db
      .select()
      .from(reviews)
      .orderBy(desc(reviews.reviewDate), desc(reviews.id))
      .limit(100);
    const ids = reviewRows.map((row) => row.id);
    const recipients = ids.length
      ? await db
          .select()
          .from(reviewRecipients)
          .where(inArray(reviewRecipients.reviewId, ids))
      : [];
    return Response.json({
      reviews: reviewRows.map((review) => ({
        ...review,
        recipients: recipients.filter((item) => item.reviewId === review.id),
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "שגיאה" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      period?: string;
      reviewDate?: string;
      customStart?: string;
      includeRecurring?: boolean;
    };
    if (!body.name?.trim() || !body.reviewDate)
      return Response.json(
        { error: "יש למלא שם ותאריך סקירה" },
        { status: 400 },
      );
    const db = getDb();
    const active = await db
      .select()
      .from(reviews)
      .where(eq(reviews.status, "active"));
    for (const row of active)
      await db
        .update(reviews)
        .set({ status: "archived" })
        .where(eq(reviews.id, row.id));
    const period = body.period || "שלושת החודשים האחרונים",
      start = cutoff(period, body.customStart);
    const [review] = await db
      .insert(reviews)
      .values({
        name: body.name.trim(),
        period,
        reviewDate: body.reviewDate,
        startDate: start,
        includeRecurring: body.includeRecurring !== false,
        status: "active",
      })
      .returning();
    const [donors, persons, movements, recurring] = await Promise.all([
      db.select().from(donorCards),
      db.select().from(people),
      db
        .select()
        .from(donations)
        .where(
          and(
            eq(donations.movementType, "donation"),
            gte(donations.date, start),
          ),
        ),
      body.includeRecurring === false ? Promise.resolve([]) : db.select().from(recurringCommitments).where(eq(recurringCommitments.status, "active")),
    ]);
    const eligible = new Set(
      [...movements, ...recurring]
        .map((item) => "donorId" in item ? item.donorId : item.donorCardId)
        .filter((id): id is number => id !== null),
    );
    let added = 0;
    for (const donor of donors) {
      if (!eligible.has(donor.id)) continue;
      const cardPeople = persons.filter((person) => person.donorCardId === donor.id);
      const recipients = cardPeople.length ? cardPeople : [{ id: null, fullName: donor.cardName, greetingName: donor.alias, phone: donor.phone, email: donor.email, postalAddress: donor.address, preferredMethod: donor.preferredMethod, doNotSend: false }];
      for (const person of recipients) {
        const delivery = method(person.preferredMethod || "WhatsApp");
        if (delivery === "none" || person.doNotSend) continue;
        const destination = delivery === "WhatsApp" ? person.phone : delivery === "email" ? person.email : person.postalAddress;
        const issue = destinationIssue(delivery, destination || "");
        await db.insert(reviewRecipients).values({
          reviewId: review.id,
          donorCardId: donor.id,
          personId: person.id,
          greetingName: person.greetingName || person.fullName,
          destination: destination || "",
          method: delivery,
          received: false,
          status: "pending",
          issue,
          snapshotJson: JSON.stringify({ donorId: donor.id, personId: person.id, cardName: donor.cardName, name: person.fullName, phone: person.phone, email: person.email, address: person.postalAddress, preferredMethod: delivery }),
        });
        added++;
      }
    }
    return Response.json({ review, recipientsAdded: added }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "שגיאה" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      reviewId?: number;
      name?: string;
      period?: string;
      reviewDate?: string;
      status?: string;
      recipientIds?: number[];
      received?: boolean;
      recipientId?: number;
      destination?: string;
    };
    const db = getDb();
    if (body.reviewId) {
      if (!body.name?.trim() || !body.reviewDate)
        return Response.json({ error: "יש למלא שם ותאריך" }, { status: 400 });
      const status = body.status === "archived" ? "archived" : "active";
      if (status === "active") {
        const active = await db
          .select({ id: reviews.id })
          .from(reviews)
          .where(eq(reviews.status, "active"));
        for (const item of active)
          if (item.id !== body.reviewId)
            await db
              .update(reviews)
              .set({ status: "archived" })
              .where(eq(reviews.id, item.id));
      }
      const [review] = await db
        .update(reviews)
        .set({
          name: body.name.trim(),
          period: body.period || "שלושת החודשים האחרונים",
          reviewDate: body.reviewDate,
          status,
        })
        .where(eq(reviews.id, body.reviewId))
        .returning();
      return Response.json({ review });
    }
    if (body.recipientId && typeof body.destination === "string") {
      const [item] = await db
        .select()
        .from(reviewRecipients)
        .where(eq(reviewRecipients.id, body.recipientId))
        .limit(1);
      if (!item)
        return Response.json({ error: "הנמען לא נמצא" }, { status: 404 });
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(item.snapshotJson || "{}");
      } catch {}
      const key =
        item.method === "WhatsApp"
          ? "phone"
          : item.method === "email"
            ? "email"
            : "address";
      data[key] = body.destination.trim();
      await db
        .update(reviewRecipients)
        .set({
          destination: body.destination.trim(),
          issue: destinationIssue(item.method, body.destination.trim()),
          snapshotJson: JSON.stringify(data),
        })
        .where(eq(reviewRecipients.id, body.recipientId));
      return Response.json({ updated: 1 });
    }
    if (!Array.isArray(body.recipientIds) || !body.recipientIds.length)
      return Response.json({ error: "לא נבחרו נמענים" }, { status: 400 });
    await db
      .update(reviewRecipients)
      .set({ received: body.received !== false, status: body.received !== false ? "received" : "pending" })
      .where(inArray(reviewRecipients.id, body.recipientIds));
    return Response.json({ updated: body.recipientIds.length });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "שגיאה" },
      { status: 500 },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "מזהה חסר" }, { status: 400 });
    const db = getDb();
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!review) return Response.json({ error: "הסקירה לא נמצאה" }, { status: 404 });
    await db.batch([
      db.delete(reviewRecipients).where(eq(reviewRecipients.reviewId, id)),
      db.delete(reviews).where(eq(reviews.id, id)),
      db.insert(auditLog).values({ action: "review_deleted", entityType: "review", entityId: String(id), details: JSON.stringify({ name: review.name, reviewDate: review.reviewDate }) }),
    ]);
    const [latest] = await db
      .select()
      .from(reviews)
      .orderBy(desc(reviews.reviewDate), desc(reviews.id))
      .limit(1);
    if (latest)
      await db
        .update(reviews)
        .set({ status: "active" })
        .where(eq(reviews.id, latest.id));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "שגיאה" },
      { status: 500 },
    );
  }
}
