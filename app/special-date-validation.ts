export type NormalizedSpecialDate = {
  kind: string;
  customName: string;
  hebrewDay: number;
  hebrewMonth: string;
  hebrewYear: number | null;
  notes: string;
};

const hebrewValues: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50,
  ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200,
  ש: 300, ת: 400,
};

const months = new Set([
  "תשרי", "חשוון", "מרחשוון", "כסלו", "טבת", "שבט", "אדר",
  "אדר א׳", "אדר א'", "אדר ראשון", "אדר ב׳", "אדר ב'", "אדר שני",
  "ניסן", "אייר", "סיוון", "סיון", "תמוז", "אב", "אלול",
]);

export class SpecialDateValidationError extends Error {}

function parseHebrewNumber(value: unknown, year = false) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const letters = text.replace(/[\s'׳"״-]/g, "");
  if (!letters || [...letters].some((letter) => !hebrewValues[letter])) return null;
  const total = [...letters].reduce((sum, letter) => sum + hebrewValues[letter], 0);
  return year && total < 1000 ? total + 5000 : total;
}

export function normalizeSpecialDates(value: unknown): NormalizedSpecialDate[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const date = (raw || {}) as Record<string, unknown>;
    const label = String(date.customName || date.kind || `מספר ${index + 1}`).trim();
    const day = parseHebrewNumber(date.hebrewDay);
    const month = String(date.hebrewMonth || "").trim();
    const yearInput = String(date.hebrewYear ?? "").trim();
    const year = parseHebrewNumber(date.hebrewYear, true);
    if (!day || !Number.isInteger(day) || day < 1 || day > 30)
      throw new SpecialDateValidationError(`בתאריך המיוחד „${label}” יש לבחור יום עברי תקין.`);
    if (!months.has(month))
      throw new SpecialDateValidationError(`בתאריך המיוחד „${label}” יש לבחור חודש עברי.`);
    if (yearInput && (!year || !Number.isInteger(year) || year < 5000 || year > 6999))
      throw new SpecialDateValidationError(`בתאריך המיוחד „${label}” יש להזין שנה עברית תקינה, למשל תשפ״ו.`);
    if (String(date.kind || "אחר") === "אחר" && !String(date.customName || "").trim())
      throw new SpecialDateValidationError("בתאריך מיוחד מסוג „אחר” יש להזין שם לתאריך.");
    return {
      kind: String(date.kind || "אחר"),
      customName: String(date.customName || "").trim(),
      hebrewDay: day,
      hebrewMonth: month,
      hebrewYear: year,
      notes: String(date.notes || "").trim(),
    };
  });
}

export function safeHebrewError(error: unknown, fallback: string) {
  if (error instanceof SpecialDateValidationError) return error.message;
  return fallback;
}
