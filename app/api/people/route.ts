import { and, eq, isNull, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, donations, donorCards, people } from "@/db/schema";
import { ensureCardHasPerson, syncDonorCardPeople } from "@/app/donor-model";

export async function GET(request: Request) {
  try {
    const db = getDb(),
      q = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (q.length < 2) return Response.json({ people: [] });
    const pattern = `%${q}%`;
    const existing = await db
      .select({
        id: people.id,
        fullName: people.fullName,
        phone: people.phone,
        email: people.email,
        idNumber: people.idNumber,
        donorCardId: people.donorCardId,
        donorCardName: donorCards.cardName,
      })
      .from(people)
      .leftJoin(donorCards, eq(people.donorCardId, donorCards.id))
      .where(
        or(
          like(people.fullName, pattern),
          like(people.phone, pattern),
          like(people.email, pattern),
          like(people.idNumber, pattern),
        ),
      )
      .limit(20);
    const legacy = await db
      .select({
        cardId: donorCards.id,
        fullName: donorCards.cardName,
        phone: donorCards.phone,
        email: donorCards.email,
        idNumber: donorCards.idNumber,
      })
      .from(donorCards)
      .leftJoin(people, eq(people.donorCardId, donorCards.id))
      .where(
        and(
          isNull(people.id),
          or(
            like(donorCards.cardName, pattern),
            like(donorCards.phone, pattern),
            like(donorCards.email, pattern),
            like(donorCards.idNumber, pattern),
          ),
        ),
      )
      .limit(10);
    return Response.json({
      people: [
        ...existing,
        ...legacy.map((card) => ({
          id: `card:${card.cardId}`,
          fullName: card.fullName,
          phone: card.phone,
          email: card.email,
          idNumber: card.idNumber,
          donorCardId: card.cardId,
          donorCardName: card.fullName,
          legacy: true,
        })),
      ],
    });
  } catch (e) {
    console.error("people search failed", e);
    return Response.json(
      { error: "לא ניתן לחפש אנשים כרגע. נסה שוב." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const p = (await request.json()) as Record<string, unknown>,
      db = getDb(),
      targetDonorCardId = Number(p.targetDonorCardId);
    if (!targetDonorCardId)
      return Response.json({ error: "כרטיס יעד חסר" }, { status: 400 });
    await ensureCardHasPerson(db, targetDonorCardId);
    if (p.action === "create") {
      const fullName = String(p.fullName || "").trim(),
        phone = String(p.phone || "").trim(),
        email = String(p.email || "")
          .trim()
          .toLowerCase(),
        idNumber = String(p.idNumber || "").trim();
      if (!fullName)
        return Response.json({ error: "יש להזין שם מלא" }, { status: 400 });
      const possible = await db
        .select({
          id: people.id,
          fullName: people.fullName,
          phone: people.phone,
          email: people.email,
          idNumber: people.idNumber,
          donorCardId: people.donorCardId,
        })
        .from(people)
        .where(
          or(
            phone ? eq(people.phone, phone) : eq(people.id, -1),
            email ? eq(people.email, email) : eq(people.id, -1),
            idNumber ? eq(people.idNumber, idNumber) : eq(people.id, -1),
          ),
        )
        .limit(5);
      if (possible.length && !p.confirmDuplicate)
        return Response.json(
          { error: "נמצאו אנשים עם פרטים דומים", matches: possible },
          { status: 409 },
        );
      const [person] = await db
        .insert(people)
        .values({
          donorCardId: targetDonorCardId,
          fullName,
          greetingName: String(p.greetingName || ""),
          alternativeNames: String(p.alternativeNames || ""),
          phone,
          secondaryPhone: String(p.secondaryPhone || ""),
          email,
          postalAddress: String(p.postalAddress || ""),
          idNumber,
          preferredMethod: String(p.preferredMethod || "WhatsApp"),
          notes: String(p.notes || ""),
        })
        .returning();
      await db.insert(auditLog).values({
        action: "person_created_and_linked",
        entityType: "person",
        entityId: String(person.id),
        details: JSON.stringify({ targetDonorCardId }),
      });
      await syncDonorCardPeople(db, targetDonorCardId);
      return Response.json({ person }, { status: 201 });
    }
    let personId: number;
    if (String(p.personId).startsWith("card:"))
      personId = (
        await ensureCardHasPerson(db, Number(String(p.personId).split(":")[1]))
      ).id;
    else personId = Number(p.personId);
    const [person] = await db
      .select()
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);
    if (!person)
      return Response.json({ error: "האדם לא נמצא" }, { status: 404 });
    if (person.donorCardId === targetDonorCardId)
      return Response.json({ person, alreadyLinked: true });
    if (person.donorCardId && !p.transfer) {
      const [currentCard] = await db
          .select({ id: donorCards.id, name: donorCards.cardName })
          .from(donorCards)
          .where(eq(donorCards.id, person.donorCardId))
          .limit(1),
        linkedDonations = await db
          .select({ id: donations.id })
          .from(donations)
          .where(eq(donations.personId, personId));
      return Response.json(
        {
          error: "האדם כבר משויך לכרטיס אחר",
          conflict: {
            currentCard,
            linkedDonationCount: linkedDonations.length,
            person,
          },
        },
        { status: 409 },
      );
    }
    if (person.donorCardId) {
      await db
        .update(donations)
        .set({ personId: null })
        .where(
          and(
            eq(donations.personId, personId),
            eq(donations.donorId, person.donorCardId),
          ),
        );
    }
    const [linked] = await db
      .update(people)
      .set({ donorCardId: targetDonorCardId })
      .where(eq(people.id, personId))
      .returning();
    if (person.donorCardId) await syncDonorCardPeople(db, person.donorCardId);
    await syncDonorCardPeople(db, targetDonorCardId);
    await db.insert(auditLog).values({
      action: person.donorCardId ? "person_transferred" : "person_linked",
      entityType: "person",
      entityId: String(personId),
      details: JSON.stringify({
        from: person.donorCardId,
        to: targetDonorCardId,
      }),
    });
    return Response.json({ person: linked });
  } catch (e) {
    console.error("person link failed", e);
    return Response.json(
      { error: "לא ניתן להוסיף או לקשר את האדם כרגע. נסה שוב." },
      { status: 500 },
    );
  }
}
