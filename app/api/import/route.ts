import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { donations, donorCards, importRuns } from "@/db/schema";
import { ensureCardHasPerson } from "@/app/donor-model";

type Row = {
  name?: string;
  phone?: string;
  email?: string;
  amount?: string | number;
  date?: string;
  paymentMethod?: string;
  purpose?: string;
  reason?: string;
  externalId?: string;
};
const normalizePhone = (value: string) => {
  const raw = value.replace(/[^\d+]/g, "");
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("972")) return `+${raw}`;
  if (raw.startsWith("0") && raw.length >= 9) return `+972${raw.slice(1)}`;
  return raw;
};
export async function POST(request: Request) {
  try {
    const p = (await request.json()) as {
      source?: string;
      filename?: string;
      fingerprint?: string;
      rows?: Row[];
    };
    if (!p.fingerprint || !p.filename || !Array.isArray(p.rows))
      return Response.json({ error: "קובץ ייבוא לא תקין" }, { status: 400 });
    const db = getDb();
    const exists = await db
      .select()
      .from(importRuns)
      .where(eq(importRuns.fingerprint, p.fingerprint))
      .limit(1);
    if (exists.length)
      return Response.json(
        { error: "הקובץ הזה כבר יובא בעבר", duplicate: true },
        { status: 409 },
      );
    let imported = 0,
      skipped = 0;
    for (const row of p.rows.slice(0, 5000)) {
      const name = String(row.name || "").trim();
      const amount = Number(row.amount || 0);
      if (!name) {
        skipped++;
        continue;
      }
      let donor = await db
        .select()
        .from(donorCards)
        .where(eq(donorCards.cardName, name))
        .limit(1);
      if (!donor.length) {
        donor = await db
          .insert(donorCards)
          .values({
            cardName: name,
            cardNameMode: "AUTO",
            linkedPeopleIds: "[]",
            phone: normalizePhone(String(row.phone || "")),
            email: String(row.email || ""),
          })
          .returning();
      }
      const primaryPerson = await ensureCardHasPerson(db, donor[0].id);
      if (amount && row.date) {
        await db.insert(donations).values({
          donorId: donor[0].id,
          personId: primaryPerson.id,
          donorName: donor[0].cardName,
          amount,
          date: String(row.date),
          paymentMethod: String(row.paymentMethod || "ייבוא קובץ"),
          purpose: String(row.purpose || ""),
          reason: String(row.reason || ""),
          externalId: row.externalId ? String(row.externalId) : null,
          importFingerprint: p.fingerprint,
          source: p.source || "file",
          netAmount: amount,
        });
        imported++;
      } else skipped++;
    }
    await db.insert(importRuns).values({
      source: p.source || "file",
      filename: p.filename,
      fingerprint: p.fingerprint,
      rowsTotal: p.rows.length,
      rowsImported: imported,
      rowsSkipped: skipped,
    });
    return Response.json({ imported, skipped });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 500 },
    );
  }
}
