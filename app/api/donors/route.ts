import { and, asc, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLog,
  donations,
  donorCards,
  engagements,
  people,
  recurringCommitments,
  specialDates,
} from "@/db/schema";
import { repairDonorModel, syncDonorCardPeople } from "@/app/donor-model";
import { normalizeSpecialDates, safeHebrewError, SpecialDateValidationError } from "@/app/special-date-validation";

let repairPromise: Promise<unknown> | null = null;

export async function GET(request: Request) {
  try {
    const db = getDb(),
      url = new URL(request.url),
      view = url.searchParams.get("view") || "list";
    repairPromise ||= repairDonorModel(db);
    await repairPromise;
    if (view === "options") {
      const donors = await db
        .select({ id: donorCards.id, name: donorCards.cardName })
        .from(donorCards)
        .orderBy(donorCards.cardName)
        .limit(500);
      return Response.json(
        { donors },
        {
          headers: {
            "cache-control": "private, max-age=30, stale-while-revalidate=60",
          },
        },
      );
    }
    const limit = Math.min(
        100,
        Math.max(20, Number(url.searchParams.get("limit") || 50)),
      ),
      offset = Math.max(0, Number(url.searchParams.get("offset") || 0)),
      query = (url.searchParams.get("q") || "").trim(),
      sort = url.searchParams.get("sort") || "newest",
      pattern = `%${query}%`,
      where = and(ne(donorCards.status, "merged"), ne(donorCards.status, "archived"), query
        ? or(
            like(donorCards.cardName, pattern),
            like(donorCards.alias, pattern),
            like(donorCards.phone, pattern),
            like(donorCards.email, pattern),
            like(donorCards.idNumber, pattern),
          )
        : undefined),
      order =
        sort === "name-asc"
          ? asc(donorCards.cardName)
          : sort === "name-desc"
            ? desc(donorCards.cardName)
            : desc(donorCards.id);
    const [donors, countRows] = await Promise.all([db
      .select({
        id: donorCards.id,
        name: donorCards.cardName,
        cardNameMode: donorCards.cardNameMode,
        linkedPeopleIds: donorCards.linkedPeopleIds,
        type: donorCards.type,
        alias: donorCards.alias,
        idNumber: donorCards.idNumber,
        phone: donorCards.phone,
        secondaryPhone: donorCards.secondaryPhone,
        email: donorCards.email,
        address: donorCards.address,
        notes: donorCards.notes,
        preferredMethod: donorCards.preferredMethod,
        nextAction: donorCards.nextAction,
        nextContactDate: donorCards.nextContactDate,
        cultivationPriority: donorCards.cultivationPriority,
        specialDateCount: sql<number>`(select count(*) from special_dates sd where sd.donor_card_id=${donorCards.id})`,
      })
      .from(donorCards)
      .where(where)
      .orderBy(order)
      .limit(limit)
      .offset(offset), db.select({ count: sql<number>`count(*)` }).from(donorCards).where(where)]);
    const listedPeople = donors.length
      ? await db
          .select({
            id: people.id,
            donorCardId: people.donorCardId,
            fullName: people.fullName,
          })
          .from(people)
          .where(
            inArray(
              people.donorCardId,
              donors.map((donor) => donor.id),
            ),
          )
      : [];
    const consistentDonors = donors.map((donor) => {
      let linkedIds: number[] = [];
      try {
        linkedIds = JSON.parse(donor.linkedPeopleIds || "[]");
      } catch {}
      const linked = listedPeople.filter(
        (person) => person.donorCardId === donor.id,
      );
      const ordered = linkedIds.length
        ? linkedIds
            .map((id) => linked.find((person) => person.id === id))
            .filter(Boolean)
        : linked;
      return {
        ...donor,
        peopleNames: ordered.map((person) => person!.fullName).join(" · "),
      };
    });
    return Response.json(
      { donors: consistentDonors, total: countRows[0]?.count || 0, hasMore: offset + donors.length < (countRows[0]?.count || 0) },
      {
        headers: {
          "cache-control": "private, max-age=15, stale-while-revalidate=45",
        },
      },
    );
  } catch (e) {
    console.error("donors list failed", e);
    return Response.json(
      { error: "לא ניתן לטעון את מאגר התורמים כרגע. נסה שוב." },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  let createdDonorId: number | null = null;
  try {
    const p = (await request.json()) as Record<string, unknown>;
    const name = String(p.name || "").trim();
    if (!name)
      return Response.json({ error: "חובה להזין שם מלא" }, { status: 400 });
    const dates = normalizeSpecialDates(p.specialDates);
    const db = getDb();
    const [donor] = await db
      .insert(donorCards)
      .values({
        cardName: name,
        cardNameMode: "AUTO",
        linkedPeopleIds: "[]",
        type: String(p.type || "יחיד"),
        alias: String(p.alias || ""),
        idNumber: String(p.idNumber || ""),
        phone: String(p.phone || ""),
        secondaryPhone: String(p.secondaryPhone || ""),
        email: String(p.email || ""),
        address: String(p.address || ""),
        notes: String(p.notes || ""),
        preferredMethod: String(p.preferredMethod || "WhatsApp"),
      })
      .returning();
    createdDonorId = donor.id;
    const [person] = await db
      .insert(people)
      .values({
        donorCardId: donor.id,
        fullName: String(p.fullName || name).trim(),
        greetingName: String(p.alias || ""),
        alternativeNames: String(p.alias || ""),
        idNumber: String(p.idNumber || ""),
        phone: String(p.phone || ""),
        secondaryPhone: String(p.secondaryPhone || ""),
        email: String(p.email || ""),
        postalAddress: String(p.address || ""),
        notes: String(p.notes || ""),
        preferredMethod: String(p.preferredMethod || "WhatsApp"),
      })
      .returning();
    await syncDonorCardPeople(db, donor.id);
    for (const d of dates) {
      await db.insert(specialDates).values({
        donorCardId: donor.id,
        personId: person.id,
        ...d,
      });
    }
    return Response.json(
      { donor: { ...donor, name: donor.cardName }, person },
      { status: 201 },
    );
  } catch (e) {
    console.error("donor creation failed", e);
    if (createdDonorId) {
      try {
        const db = getDb();
        await db.delete(specialDates).where(eq(specialDates.donorCardId, createdDonorId));
        await db.delete(people).where(eq(people.donorCardId, createdDonorId));
        await db.delete(donorCards).where(eq(donorCards.id, createdDonorId));
      } catch (cleanupError) {
        console.error("partial donor cleanup failed", cleanupError);
      }
    }
    return Response.json(
      { error: safeHebrewError(e, "לא ניתן לשמור את כרטיס התורם. הפרטים שהוזנו נשמרו בטופס ואפשר לנסות שוב.") },
      { status: e instanceof SpecialDateValidationError ? 400 : 500 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const p = (await request.json()) as Record<string, unknown>,
      id = Number(p.id),
      name = String(p.name || "").trim();
    if (!id || !name)
      return Response.json({ error: "חובה להזין שם מלא" }, { status: 400 });
    const dates = normalizeSpecialDates(p.specialDates);
    const db = getDb();
    const [before] = await db
      .select()
      .from(donorCards)
      .where(eq(donorCards.id, id))
      .limit(1);
    if (!before)
      return Response.json({ error: "התורם לא נמצא" }, { status: 404 });
    const regenerate = p.regenerateCardName === true;
    const [donor] = await db
      .update(donorCards)
      .set({
        cardName: regenerate ? before.cardName : name,
        cardNameMode: regenerate
          ? "AUTO"
          : name !== before.cardName
            ? "MANUAL"
            : before.cardNameMode,
        type: String(p.type || "יחיד"),
        alias: String(p.alias || ""),
        idNumber: String(p.idNumber || ""),
        phone: String(p.phone || ""),
        secondaryPhone: String(p.secondaryPhone || ""),
        email: String(p.email || ""),
        address: String(p.address || ""),
        notes: String(p.notes || ""),
        preferredMethod: String(p.preferredMethod || "WhatsApp"),
      })
      .where(eq(donorCards.id, id))
      .returning();
    if (!donor)
      return Response.json({ error: "התורם לא נמצא" }, { status: 404 });
    const synchronized = await syncDonorCardPeople(db, id);
    const finalName = synchronized?.cardName || donor.cardName;
    await db.delete(specialDates).where(eq(specialDates.donorCardId, id));
    for (const d of dates) {
      await db.insert(specialDates).values({
        donorCardId: id,
        ...d,
      });
    }
    await db
      .update(donations)
      .set({ donorName: finalName })
      .where(eq(donations.donorId, id));
    await db.insert(auditLog).values({
      action: "donor_updated",
      entityType: "donor",
      entityId: String(id),
      details: "{}",
    });
    return Response.json({
      donor: { ...(synchronized || donor), name: finalName },
    });
  } catch (e) {
    console.error("donor update failed", e);
    return Response.json(
      { error: safeHebrewError(e, "לא ניתן לעדכן את כרטיס התורם כרגע. נסה שוב.") },
      { status: e instanceof SpecialDateValidationError ? 400 : 500 },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "מזהה חסר" }, { status: 400 });
    const db = getDb();
    const [donor] = await db.update(donorCards).set({ status: "archived" }).where(eq(donorCards.id, id)).returning();
    if (!donor) return Response.json({ error: "כרטיס התורם לא נמצא" }, { status: 404 });
    await db.insert(auditLog).values({
      action: "donor_archived",
      entityType: "donor",
      entityId: String(id),
      details: JSON.stringify({ reason: "user_delete", recoverable: true }),
    });
    return Response.json({ ok: true, archived: true });
  } catch (e) {
    console.error("donor archive failed", e);
    return Response.json(
      { error: "לא ניתן למחוק את כרטיס התורם כרגע. נסה שוב." },
      { status: 500 },
    );
  }
}
