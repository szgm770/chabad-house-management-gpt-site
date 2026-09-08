import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { donorCards, specialDates } from "@/db/schema";

const headers = [
  "שם מלא",
  "כינוי",
  "מספר ת.ז.",
  "טלפון ראשי",
  "טלפון נוסף",
  "מייל",
  "דרך משלוח מועדפת לסקירות",
  "כתובת למשלוח דואר",
  "הערות אישיות",
  "תאריכים מיוחדים",
];
const csv = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET() {
  try {
    const db = getDb();
    const [donors, dates] = await Promise.all([
      db.select().from(donorCards).orderBy(asc(donorCards.cardName)),
      db.select().from(specialDates),
    ]);
    const rows = donors.map((d) => {
      const special = dates
        .filter((x) => x.donorCardId === d.id)
        .map((x) =>
          [
            x.kind,
            x.customName,
            x.hebrewDay,
            x.hebrewMonth,
            x.hebrewYear ?? "",
          ].join("|"),
        )
        .join("; ");
      return [
        d.cardName,
        d.alias,
        d.idNumber,
        d.phone,
        d.secondaryPhone,
        d.email,
        d.preferredMethod,
        d.address,
        d.notes,
        special,
      ];
    });
    const output =
      "\ufeff" +
      [headers, ...rows].map((row) => row.map(csv).join(",")).join("\r\n");
    return new Response(output, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=donors-export.csv",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 500 },
    );
  }
}
