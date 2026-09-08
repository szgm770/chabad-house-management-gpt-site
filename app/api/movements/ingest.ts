import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appSettings,
  auditLog,
  donations,
  donorCards,
  people,
} from "@/db/schema";
import { netAmount } from "@/app/finance";
import { ensureCardHasPerson } from "@/app/donor-model";

export type MovementInput = {
  donorId?: number;
  personId?: number;
  donorName?: string;
  name?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  amount?: string | number;
  date?: string;
  paymentMethod?: string;
  purpose?: string;
  reason?: string;
  source?: string;
  externalId?: string;
  currency?: string;
  movementType?: "donation" | "expense";
  department?: string;
  subcategory?: string;
  isRecurring?: boolean;
  rawPayload?: unknown;
};

const safePayload = (value: unknown) => {
  if (!value || typeof value !== "object") return {};
  const blocked = new Set(["tokef", "cardnumber", "card_number", "cvv", "cvc", "password", "token"]);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !blocked.has(key.toLowerCase())));
};

const cleanPhone = (v = "") => v.replace(/\D/g, "").replace(/^9720?/, "0");
const cleanId = (v = "") => v.replace(/\D/g, "");
const cleanEmail = (v = "") => v.trim().toLowerCase();
const cleanName = (v = "") => v.trim().replace(/\s+/g, " ");

export async function ingestMovement(p: MovementInput) {
  const db = getDb();
  const name = cleanName(p.donorName || p.name);
  const amount = Number(p.amount);
  const movementType = p.movementType || "donation";
  if (!name || !amount || !p.date) throw new Error("חסרים פרטי חובה");
  if (p.externalId) {
    const existing = await db
      .select()
      .from(donations)
      .where(
        and(
          eq(donations.externalId, p.externalId),
          eq(donations.source, p.source || "manual"),
        ),
      )
      .limit(1);
    if (existing.length)
      return {
        movement: existing[0],
        duplicate: true,
        donorAction: "existing",
      };
  }
  const settings = Object.fromEntries(
    (await db.select().from(appSettings)).map((row) => [row.key, row.value]),
  );
  const calculated =
    movementType === "donation"
      ? netAmount(amount, p.paymentMethod || "", settings)
      : { rate: 0, fee: 0, net: amount };
  const idNumber = cleanId(p.idNumber),
    phone = cleanPhone(p.phone),
    email = cleanEmail(p.email);
  if (movementType === "expense") {
    const [movement] = await db
      .insert(donations)
      .values({
        donorName: name,
        amount,
        date: p.date!,
        paymentMethod: p.paymentMethod || "לא צוין",
        purpose: p.purpose || "",
        reason: p.reason || "",
        source: p.source || "manual",
        externalId: p.externalId || null,
        currency: p.currency || "ILS",
        feePercentage: 0,
        feeAmount: 0,
        netAmount: amount,
        movementType,
        department: p.department || "",
        subcategory: p.subcategory || "",
        isRecurring: !!p.isRecurring,
        rawPayload: JSON.stringify(safePayload(p.rawPayload)),
      })
      .returning();
    await db.insert(auditLog).values({
      action: "movement_ingested",
      entityType: "movement",
      entityId: String(movement.id),
      details: JSON.stringify({ source: p.source || "manual", movementType }),
    });
    return {
      movement,
      donorAction: "not_applicable",
      matchReason: "הוצאה אינה משויכת לתורם",
    };
  }
  const explicit = p.donorId
    ? await db
        .select()
        .from(donorCards)
        .where(eq(donorCards.id, Number(p.donorId)))
        .limit(1)
    : [];
  const allDonors = explicit.length || (!idNumber && !phone && !email) ? [] : await db.select().from(donorCards).where(or(
    idNumber ? eq(donorCards.idNumber, idNumber) : eq(donorCards.id, -1),
    phone ? eq(donorCards.phone, phone) : eq(donorCards.id, -1),
    email ? eq(donorCards.email, email) : eq(donorCards.id, -1),
  )).limit(10);
  const candidates = explicit.length
    ? explicit
    : allDonors.filter(
        (d) =>
          (idNumber && cleanId(d.idNumber) === idNumber) ||
          (phone && cleanPhone(d.phone) === phone) ||
          (email && cleanEmail(d.email) === email),
      );
  let donor = candidates.length === 1 ? candidates[0] : undefined;
  let donorAction = "matched";
  let matchReason = explicit.length ? "שיוך ישיר לכרטיס שנבחר" : "";
  if (donor && !explicit.length) {
    matchReason =
      idNumber && donor.idNumber === idNumber
        ? "התאמה ודאית לפי ת״ז"
        : phone && donor.phone === phone
          ? "התאמה ודאית לפי טלפון"
          : "התאמה ודאית לפי דוא״ל";
  } else if (candidates.length > 1) {
    donorAction = "review";
    matchReason = "נמצאו כמה כרטיסים עם פרטים מזהים תואמים";
  } else {
    const exactName = await db
      .select()
      .from(donorCards)
      .where(eq(donorCards.cardName, name))
      .limit(2);
    if (
      exactName.length === 1 &&
      p.source === "manual" &&
      !idNumber &&
      !phone &&
      !email
    ) {
      donor = exactName[0];
      donorAction = "matched";
      matchReason = "בחירה ידנית של כרטיס תורם קיים";
    } else if (exactName.length === 1 && (idNumber || phone || email)) {
      donor = exactName[0];
      donorAction = "review";
      matchReason = "שם זהה אך הפרטים המזהים אינם מספיקים להתאמה אוטומטית";
    } else {
      const created = await db
        .insert(donorCards)
        .values({
          cardName: name,
          cardNameMode: "AUTO",
          linkedPeopleIds: "[]",
          phone,
          email,
          idNumber,
          address: p.address || "",
        })
        .returning();
      donor = created[0];
      donorAction = "created";
      matchReason = "נוצר כרטיס תורם אוטומטית";
    }
  }
  let resolvedPersonId: number | null = null;
  if (donor && donorAction !== "review") {
    const primary = await ensureCardHasPerson(db, donor.id);
    const linkedPeople = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.donorCardId, donor.id));
    const requested = p.personId ? Number(p.personId) : null;
    resolvedPersonId =
      requested && linkedPeople.some((person) => person.id === requested)
        ? requested
        : linkedPeople.length === 1
          ? primary.id
          : null;
  }
  const [movement] = await db
    .insert(donations)
    .values({
      donorId: donorAction === "review" ? null : donor?.id,
      personId: resolvedPersonId,
      donorName: donorAction === "review" ? name : donor?.cardName || name,
      amount,
      date: p.date!,
      paymentMethod: p.paymentMethod || "לא צוין",
      purpose: p.purpose || "",
      reason: p.reason || "",
      source: p.source || "manual",
      externalId: p.externalId || null,
      currency: p.currency || "ILS",
      feePercentage: calculated.rate,
      feeAmount: calculated.fee,
      netAmount: calculated.net,
      movementType,
      matchStatus: donorAction === "review" ? "review" : "matched",
      matchReason,
      department: p.department || "",
      subcategory: p.subcategory || "",
      isRecurring: !!p.isRecurring,
      rawPayload: JSON.stringify(safePayload(p.rawPayload)),
    })
    .returning();
  await db.insert(auditLog).values({
    action: "movement_ingested",
    entityType: "movement",
    entityId: String(movement.id),
    details: JSON.stringify({
      donorAction,
      matchReason,
      source: p.source || "manual",
    }),
  });
  return { movement, donor, donorAction, matchReason };
}
