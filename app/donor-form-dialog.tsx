"use client";

import { useEffect, useState } from "react";
import { CalendarHeart, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hebrewNumeral } from "@/app/hebrew-date";
import { normalizeSpecialDates, SpecialDateValidationError } from "@/app/special-date-validation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DateRow = {
  kind: string;
  customName: string;
  hebrewDay: string;
  hebrewMonth: string;
  hebrewYear: string;
};
export type CreatedDonor = { id: number; name: string };
export type EditableDonor = {
  id: number;
  name: string;
  cardNameMode?: "AUTO" | "MANUAL";
  type?: string;
  alias: string;
  idNumber: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  preferredMethod: string;
  address: string;
  notes: string;
  specialDates?: Array<{
    kind: string;
    customName: string;
    hebrewDay: string | number;
    hebrewMonth: string;
    hebrewYear: string | number | null;
  }>;
};
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (donor: CreatedDonor) => void;
  donor?: EditableDonor | null;
  onSaved?: () => void;
};
const months = [
  "תשרי",
  "חשוון",
  "כסלו",
  "טבת",
  "שבט",
  "אדר",
  "ניסן",
  "אייר",
  "סיוון",
  "תמוז",
  "אב",
  "אלול",
];
const initialForm = {
  name: "",
  type: "יחיד",
  alias: "",
  idNumber: "",
  phone: "",
  secondaryPhone: "",
  email: "",
  preferredMethod: "WhatsApp",
  address: "",
  notes: "",
};

export default function DonorFormDialog({
  open,
  onOpenChange,
  onCreated,
  donor,
  onSaved,
}: Props) {
  const [form, setForm] = useState(initialForm);
  const [dates, setDates] = useState<DateRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerateCardName, setRegenerateCardName] = useState(false);
  const set = (patch: Partial<typeof form>) =>
    setForm((value) => ({ ...value, ...patch }));
  useEffect(() => {
    if (!open) return;
    setRegenerateCardName(false);
    if (donor) {
      setForm({
        name: donor.name || "",
        type: donor.type || "יחיד",
        alias: donor.alias || "",
        idNumber: donor.idNumber || "",
        phone: donor.phone || "",
        secondaryPhone: donor.secondaryPhone || "",
        email: donor.email || "",
        preferredMethod: donor.preferredMethod || "WhatsApp",
        address: donor.address || "",
        notes: donor.notes || "",
      });
      setDates(
        (donor.specialDates || []).map((item) => ({
          kind: item.kind,
          customName: item.customName || "",
          hebrewDay: String(item.hebrewDay || ""),
          hebrewMonth: item.hebrewMonth || "",
          hebrewYear: String(item.hebrewYear || ""),
        })),
      );
    } else reset();
  }, [open, donor]);
  const addDate = () =>
    setDates((items) => [
      ...items,
      {
        kind: "יום הולדת",
        customName: "",
        hebrewDay: "",
        hebrewMonth: "",
        hebrewYear: "",
      },
    ]);
  const changeDate = (index: number, patch: Partial<DateRow>) =>
    setDates((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  function reset() {
    setForm(initialForm);
    setDates([]);
    setError("");
    setRegenerateCardName(false);
  }
  async function save() {
    if (!form.name.trim()) {
      setError("יש להזין שם כרטיס");
      return;
    }
    try {
      normalizeSpecialDates(dates);
    } catch (validationError) {
      setError(validationError instanceof SpecialDateValidationError ? validationError.message : "יש לבדוק את התאריכים המיוחדים שהוזנו.");
      return;
    }
    setSaving(true);
    setError("");
    let result: Record<string, any>;
    try {
      const response = await fetch("/api/donors", {
        method: donor ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, fullName: form.name, id: donor?.id, specialDates: dates, regenerateCardName }),
      });
      result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(result.error || "לא ניתן לשמור את כרטיס התורם. בדוק את הפרטים ונסה שוב."));
        return;
      }
    } catch {
      setError("לא ניתן להתחבר למערכת כרגע. הפרטים נשמרו בטופס ואפשר לנסות שוב.");
      return;
    } finally {
      setSaving(false);
    }
    const savedDonor = {
      id: Number(result.donor?.id || result.id || 0),
      name: form.name.trim(),
    };
    reset();
    onOpenChange(false);
    if (donor) onSaved?.();
    else onCreated?.(savedDonor);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setError("");
      }}
    >
      <DialogContent dir="rtl" className="donor-form-dialog sm:max-w-3xl">
        <DialogHeader className="text-right">
          <DialogTitle>
            {donor ? "עריכת כרטיס תורם" : "כרטיס תורם חדש"}
          </DialogTitle>
          <DialogDescription>
            כל הפרטים נשמרים בכרטיס התורם ובסקירות הפעילות.
          </DialogDescription>
        </DialogHeader>
        <div className="donor-form-sections">
          <section>
            <h3>פרטים אישיים</h3>
            <div className="form-grid">
              <label className="card-name-field">
                <span>שם כרטיס התורם *</span>
                <input
                  value={form.name}
                  onChange={(e) => {
                    set({ name: e.target.value });
                    setRegenerateCardName(false);
                  }}
                  autoFocus
                />
                {donor && (
                  <small>
                    {regenerateCardName
                      ? "השם יחושב מחדש לפי האנשים בכרטיס"
                      : donor.cardNameMode === "MANUAL"
                        ? "שם ידני — לא ישתנה בעת הוספת אנשים"
                        : "שם אוטומטי לפי האנשים בכרטיס"}
                  </small>
                )}
                {donor && (
                  <button
                    type="button"
                    className="regenerate-card-name"
                    onClick={() => setRegenerateCardName(true)}
                  >
                    <RotateCcw />
                    יצירת שם אוטומטי מחדש
                  </button>
                )}
              </label>
              <label>
                <span>סוג כרטיס</span>
                <select
                  value={form.type}
                  onChange={(e) => set({ type: e.target.value })}
                >
                  <option>יחיד</option>
                  <option>זוג</option>
                  <option>משפחה</option>
                  <option>שותפים</option>
                  <option>עסק</option>
                </select>
              </label>
              <label>
                <span>כינוי</span>
                <input
                  value={form.alias}
                  onChange={(e) => set({ alias: e.target.value })}
                  placeholder="לדוגמה: ר׳ דוד"
                />
              </label>
              <label>
                <span>מספר ת.ז.</span>
                <input
                  value={form.idNumber}
                  onChange={(e) => set({ idNumber: e.target.value })}
                  inputMode="numeric"
                />
              </label>
              <label>
                <span>טלפון ראשי</span>
                <input
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  inputMode="tel"
                />
              </label>
              <label>
                <span>טלפון נוסף</span>
                <input
                  value={form.secondaryPhone}
                  onChange={(e) => set({ secondaryPhone: e.target.value })}
                  inputMode="tel"
                />
              </label>
              <label>
                <span>מייל</span>
                <input
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  type="email"
                />
              </label>
              <label>
                <span>דרך משלוח מועדפת לסקירות</span>
                <select
                  value={form.preferredMethod}
                  onChange={(e) => set({ preferredMethod: e.target.value })}
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="email">מייל</option>
                  <option value="mail">דואר</option>
                  <option value="none">לא לשלוח</option>
                </select>
              </label>
              <label>
                <span>כתובת למשלוח דואר</span>
                <input
                  value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                />
              </label>
            </div>
            <label className="wide-field">
              <span>הערות אישיות</span>
              <textarea
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                rows={3}
              />
            </label>
          </section>
          <section className="special-dates">
            <div className="section-line">
              <div>
                <h3>תאריכים מיוחדים</h3>
                <p>נשמרים בלוח העברי</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addDate}
              >
                <CalendarHeart />
                הוספת תאריך
              </Button>
            </div>
            {dates.map((date, index) => (
              <div className="date-row" key={index}>
                <select
                  value={date.kind}
                  onChange={(e) => changeDate(index, { kind: e.target.value })}
                >
                  <option>יום הולדת</option>
                  <option>יארצייט</option>
                  <option>יום נישואין</option>
                  <option>אחר</option>
                </select>
                {date.kind === "אחר" && (
                  <input
                    placeholder="שם מותאם אישית"
                    value={date.customName}
                    onChange={(e) =>
                      changeDate(index, { customName: e.target.value })
                    }
                  />
                )}
                <select
                  aria-label="יום בחודש העברי"
                  value={date.hebrewDay}
                  onChange={(e) =>
                    changeDate(index, { hebrewDay: e.target.value })
                  }
                >
                  <option value="">יום</option>
                  {Array.from({ length: 30 }, (_, day) => day + 1).map((day) => (
                    <option key={day} value={day}>{hebrewNumeral(day)}</option>
                  ))}
                </select>
                <select
                  value={date.hebrewMonth}
                  onChange={(e) =>
                    changeDate(index, { hebrewMonth: e.target.value })
                  }
                >
                  <option value="">חודש עברי</option>
                  {months.map((month) => (
                    <option key={month}>{month}</option>
                  ))}
                </select>
                <input
                  placeholder="שנה (רשות), למשל תשפ״ו"
                  value={date.hebrewYear}
                  onChange={(e) =>
                    changeDate(index, { hebrewYear: e.target.value })
                  }
                />
                <button
                  type="button"
                  aria-label="הסרת תאריך"
                  onClick={() =>
                    setDates((items) => items.filter((_, i) => i !== index))
                  }
                >
                  <X />
                </button>
              </div>
            ))}
            {!dates.length && (
              <p className="no-dates">
                אפשר להוסיף יום הולדת, יארצייט, יום נישואין או תאריך אישי.
              </p>
            )}
          </section>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "שומר…" : donor ? "שמירת שינויים" : "שמירת כרטיס תורם"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
