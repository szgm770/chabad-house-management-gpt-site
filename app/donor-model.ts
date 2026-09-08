import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, donations, donorCards, people } from "@/db/schema";

type Db = ReturnType<typeof getDb>;
type NamedPerson = { id: number; fullName: string };

function parts(name: string) {
  return name.trim().split(/\s+/).filter(Boolean);
}

export function automaticCardName(persons: NamedPerson[]) {
  if (!persons.length) return "כרטיס תורם";
  if (persons.length === 1) return persons[0].fullName;
  if (persons.length === 2) {
    const [first, second] = persons.map((person) => parts(person.fullName));
    const firstSurname = first.at(-1) || "";
    const secondSurname = second.at(-1) || "";
    if (
      firstSurname &&
      firstSurname === secondSurname &&
      first.length > 1 &&
      second.length > 1
    )
      return `${first.slice(0, -1).join(" ")} ו${second.slice(0, -1).join(" ")} ${firstSurname}`;
    return `${persons[0].fullName} ו${persons[1].fullName}`;
  }
  const surnames = persons
    .map((person) => parts(person.fullName).at(-1))
    .filter(Boolean);
  if (
    surnames.length === persons.length &&
    surnames.every((name) => name === surnames[0])
  )
    return `משפחת ${surnames[0]}`;
  return persons.map((person) => person.fullName).join(", ");
}

export async function syncDonorCardPeople(db: Db, donorCardId: number) {
  let linked = await db
    .select({
      id: people.id,
      fullName: people.fullName,
      phone: people.phone,
      email: people.email,
      idNumber: people.idNumber,
    })
    .from(people)
    .where(eq(people.donorCardId, donorCardId))
    .orderBy(people.id);
  const [card] = await db
    .select()
    .from(donorCards)
    .where(eq(donorCards.id, donorCardId))
    .limit(1);
  if (!card) return null;
  linked = [...linked].sort((a, b) => {
    const score = (person: NamedPerson & Record<string, unknown>) => {
      const full = person as NamedPerson & {
        phone?: string;
        email?: string;
        idNumber?: string;
      };
      return (
        Number(!!card.idNumber && full.idNumber === card.idNumber) * 4 +
        Number(!!card.phone && full.phone === card.phone) * 2 +
        Number(
          !!card.email &&
            full.email?.toLowerCase() === card.email.toLowerCase(),
        )
      );
    };
    return (
      score(b as NamedPerson & Record<string, unknown>) -
        score(a as NamedPerson & Record<string, unknown>) || a.id - b.id
    );
  });
  const patch: { linkedPeopleIds: string; cardName?: string; type?: string } = {
    linkedPeopleIds: JSON.stringify(linked.map((person) => person.id)),
    type: linked.length > 1 && card.type === "יחיד" ? "משפחה" : card.type,
  };
  if (card.cardNameMode !== "MANUAL" && linked.length)
    patch.cardName = automaticCardName(linked);
  const [updated] = await db
    .update(donorCards)
    .set(patch)
    .where(eq(donorCards.id, donorCardId))
    .returning();
  if (updated.cardName !== card.cardName)
    await db
      .update(donations)
      .set({ donorName: updated.cardName })
      .where(eq(donations.donorId, donorCardId));
  return { ...updated, linkedPeopleIds: linked.map((person) => person.id) };
}

export async function ensureCardHasPerson(db: Db, donorCardId: number) {
  const existing = await db
    .select()
    .from(people)
    .where(eq(people.donorCardId, donorCardId))
    .limit(1);
  if (existing.length) {
    await syncDonorCardPeople(db, donorCardId);
    return existing[0];
  }
  const [card] = await db
    .select()
    .from(donorCards)
    .where(eq(donorCards.id, donorCardId))
    .limit(1);
  if (!card) throw new Error("כרטיס התורם לא נמצא");
  const [person] = await db
    .insert(people)
    .values({
      donorCardId,
      fullName: card.cardName,
      greetingName: card.alias,
      alternativeNames: card.alias,
      phone: card.phone,
      secondaryPhone: card.secondaryPhone,
      email: card.email,
      postalAddress: card.address,
      idNumber: card.idNumber,
      preferredMethod: card.preferredMethod,
      notes: card.notes,
    })
    .returning();
  await syncDonorCardPeople(db, donorCardId);
  return person;
}

export async function repairDonorModel(db: Db) {
  const orphaned = await db
    .select()
    .from(people)
    .where(isNull(people.donorCardId));
  for (const person of orphaned) {
    const [card] = await db
      .insert(donorCards)
      .values({
        cardName: person.fullName,
        cardNameMode: "AUTO",
        linkedPeopleIds: "[]",
        phone: person.phone,
        secondaryPhone: person.secondaryPhone,
        email: person.email,
        alias: person.greetingName,
        idNumber: person.idNumber,
        address: person.postalAddress,
        preferredMethod: person.preferredMethod,
        notes: person.notes,
      })
      .returning();
    await db
      .update(people)
      .set({ donorCardId: card.id })
      .where(eq(people.id, person.id));
    await syncDonorCardPeople(db, card.id);
    await db.insert(auditLog).values({
      action: "orphan_person_repaired",
      entityType: "person",
      entityId: String(person.id),
      details: JSON.stringify({ donorCardId: card.id }),
    });
  }
  const cards = await db.select().from(donorCards).where(ne(donorCards.status, "merged"));
  for (const card of cards) {
    const linked = await db
      .select()
      .from(people)
      .where(eq(people.donorCardId, card.id));
    const legacyPersonExists = linked.some(
      (person) =>
        person.fullName.trim() === card.cardName.trim() ||
        (!!card.idNumber && person.idNumber === card.idNumber) ||
        (!!card.phone && person.phone === card.phone) ||
        (!!card.email &&
          person.email.toLowerCase() === card.email.toLowerCase()),
    );
    if (
      linked.length &&
      !legacyPersonExists &&
      (card.idNumber || card.phone || card.email)
    ) {
      await db.insert(people).values({
        donorCardId: card.id,
        fullName: card.cardName,
        greetingName: card.alias,
        alternativeNames: card.alias,
        phone: card.phone,
        secondaryPhone: card.secondaryPhone,
        email: card.email,
        postalAddress: card.address,
        idNumber: card.idNumber,
        preferredMethod: card.preferredMethod,
        notes: card.notes,
      });
      await db.insert(auditLog).values({
        action: "legacy_primary_person_restored",
        entityType: "donor_card",
        entityId: String(card.id),
        details: JSON.stringify({ cardName: card.cardName }),
      });
    }
    await ensureCardHasPerson(db, card.id);
  }
  const [allCards, allPeople, unassigned] = await Promise.all([
    db
      .select({ id: donorCards.id, cardName: donorCards.cardName })
      .from(donorCards),
    db
      .select({
        id: people.id,
        donorCardId: people.donorCardId,
        fullName: people.fullName,
      })
      .from(people),
    db.select().from(donations).where(isNull(donations.donorId)),
  ]);
  let repairedDonations = 0;
  for (const donation of unassigned) {
    const matchingPeople = allPeople.filter(
      (person) => person.fullName.trim() === donation.donorName.trim(),
    );
    const matchingCards = allCards.filter(
      (card) => card.cardName.trim() === donation.donorName.trim(),
    );
    const person = matchingPeople.length === 1 ? matchingPeople[0] : null;
    const cardId =
      person?.donorCardId ||
      (matchingCards.length === 1 ? matchingCards[0].id : null);
    if (!cardId) continue;
    const cardPeople = allPeople.filter(
      (candidate) => candidate.donorCardId === cardId,
    );
    await db
      .update(donations)
      .set({
        donorId: cardId,
        personId:
          person?.id || (cardPeople.length === 1 ? cardPeople[0].id : null),
        donorName:
          allCards.find((card) => card.id === cardId)?.cardName ||
          donation.donorName,
        matchStatus: "matched",
        matchReason: "תיקון אוטומטי בטוח לפי שם אדם או שם כרטיס ייחודי",
      })
      .where(eq(donations.id, donation.id));
    repairedDonations++;
  }
  const personLinkedDonations = await db
    .select({ donationId: donations.id, donationCardId: donations.donorId, personId: donations.personId, personCardId: people.donorCardId })
    .from(donations)
    .innerJoin(people, eq(donations.personId, people.id))
    .where(and(isNotNull(donations.personId), isNotNull(donations.donorId)));
  let repairedPersonLinks = 0;
  for (const row of personLinkedDonations) {
    if (row.donationCardId === row.personCardId) continue;
    await db.update(donations).set({ personId: null, matchReason: "שיוך האדם הוסר בתיקון תקינות: האדם שייך לכרטיס אחר" }).where(eq(donations.id, row.donationId));
    repairedPersonLinks++;
  }
  return {
    repairedOrphans: orphaned.length,
    synchronizedCards: cards.length,
    repairedDonations,
    repairedPersonLinks,
  };
}
