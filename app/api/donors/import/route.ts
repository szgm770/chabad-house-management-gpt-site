import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { donorCards, importRuns, people, specialDates } from "@/db/schema";
import { ensureCardHasPerson, syncDonorCardPeople } from "@/app/donor-model";
import { normalizeSpecialDates, safeHebrewError, SpecialDateValidationError } from "@/app/special-date-validation";

type ImportedDate = {
  kind: string;
  customName: string;
  hebrewDay: number;
  hebrewMonth: string;
  hebrewYear: number | null;
};
type Row = {
  name?: string;
  alias?: string;
  idNumber?: string;
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  preferredMethod?: string;
  address?: string;
  notes?: string;
  specialDates?: ImportedDate[];
};
const clean = (value: unknown) => String(value ?? "").trim();
const normalizePhone = (value: string) =>
  value.replace(/[^\d]/g, "").replace(/^972/, "0");
const validMethods = new Set(["WhatsApp", "email", "mail", "none"]);

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { rows?: Row[]; filename?: string; fingerprint?: string };
    if (!Array.isArray(payload.rows))
      return Response.json({ error: "קובץ ייבוא לא תקין" }, { status: 400 });
    if (payload.rows.length > 5000)
      return Response.json(
        { error: "ניתן לייבא עד 5,000 תורמים בכל פעם" },
        { status: 400 },
      );
    const db = getDb();
    if (payload.fingerprint) {
      const previous = await db.select({ id: importRuns.id }).from(importRuns).where(eq(importRuns.fingerprint, payload.fingerprint)).limit(1);
      if (previous.length) return Response.json({ error: "הקובץ הזה כבר יובא בעבר", duplicate: true }, { status: 409 });
    }
    const existing = await db.select().from(donorCards);
    let added = 0,
      updated = 0,
      skipped = 0;
    for (const raw of payload.rows) {
      const name = clean(raw.name);
      if (!name) {
        skipped++;
        continue;
      }
      const normalizedDates = normalizeSpecialDates(raw.specialDates);
      const idNumber = clean(raw.idNumber);
      const phone = clean(raw.phone);
      const email = clean(raw.email).toLowerCase();
      const match = existing.find(
        (d) =>
          (idNumber && d.idNumber === idNumber) ||
          (phone && normalizePhone(d.phone) === normalizePhone(phone)) ||
          (email && d.email.toLowerCase() === email) ||
          (!idNumber && !phone && !email && d.cardName === name),
      );
      const values = {
        alias: clean(raw.alias),
        idNumber,
        phone,
        secondaryPhone: clean(raw.secondaryPhone),
        email,
        preferredMethod: validMethods.has(clean(raw.preferredMethod))
          ? clean(raw.preferredMethod)
          : "WhatsApp",
        address: clean(raw.address),
        notes: clean(raw.notes),
      };
      let donorId: number;
      if (match) {
        await db
          .update(donorCards)
          .set(values)
          .where(eq(donorCards.id, match.id));
        donorId = match.id;
        const primary = await ensureCardHasPerson(db, donorId);
        await db
          .update(people)
          .set({
            fullName: name,
            greetingName: clean(raw.alias),
            alternativeNames: clean(raw.alias),
            idNumber,
            phone,
            secondaryPhone: clean(raw.secondaryPhone),
            email,
            preferredMethod: values.preferredMethod,
            postalAddress: clean(raw.address),
            notes: clean(raw.notes),
          })
          .where(eq(people.id, primary.id));
        await syncDonorCardPeople(db, donorId);
        updated++;
      } else {
        const [created] = await db
          .insert(donorCards)
          .values({
            ...values,
            cardName: name,
            cardNameMode: "AUTO",
            linkedPeopleIds: "[]",
          })
          .returning();
        donorId = created.id;
        await ensureCardHasPerson(db, donorId);
        existing.push(created);
        added++;
      }
      if (normalizedDates.length) {
        await db
          .delete(specialDates)
          .where(eq(specialDates.donorCardId, donorId));
        for (const date of normalizedDates) {
          await db.insert(specialDates).values({
            donorCardId: donorId,
            ...date,
          });
        }
      }
    }
    if (payload.fingerprint) await db.insert(importRuns).values({ source: "donors-file", filename: payload.filename || "donors.csv", fingerprint: payload.fingerprint, rowsTotal: payload.rows.length, rowsImported: added + updated, rowsSkipped: skipped });
    return Response.json({ added, updated, skipped });
  } catch (e) {
    console.error("donor import failed", e);
    return Response.json(
      { error: safeHebrewError(e, "לא ניתן להשלים את ייבוא התורמים. בדוק את הקובץ ונסה שוב.") },
      { status: e instanceof SpecialDateValidationError ? 400 : 500 },
    );
  }
}
