"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DonorFormDialog from "./donor-form-dialog";
import { formatHebrewDate } from "./hebrew-date";

export type MovementRecord = {
  expectedSettlementDate?: string | null;
  actualSettlementDate?: string | null;
  settlementReview?: boolean;
  id: number;
  donorId: number | null;
  personId: number | null;
  personName?: string | null;
  donorName: string;
  amount: number;
  currency: string;
  date: string;
  paymentMethod: string;
  purpose: string;
  reason?: string;
  movementType: string;
  department: string;
  subcategory: string;
  isRecurring: boolean;
  source: string;
  externalId: string | null;
  feeAmount?: number;
  netAmount?: number;
  matchStatus?: string;
  rawPayload?: string;
};
type DonorOption = { id: number; name: string };
type Categories = Record<string, string[]>;
const fallback: Categories = {
  "בית חב״ד": [
    "שותפות חודשית",
    "תרומה כללית",
    "חלוקת מצות",
    "פעילות חגים",
    "שיעורי תורה ותלמוד תורה",
    "קופת צדקה",
  ],
  "בית כנסת": [
    "כיסא של אליהו",
    "נדרים ונדבות",
    "מתנות לאביונים",
    "קמחא דפסחא",
    "עליות לתורה",
  ],
  חנות: [
    "מכירת ספרי קודש",
    "תשמישי קדושה",
    "מזוזות ותפילין",
    "ערכות חג וארבעת המינים",
  ],
};
const methods = [
  "אשראי",
  "ביט",
  "פייבוקס",
  "העברה בנקאית",
  "הוראת קבע",
  "מזומן",
  "צ׳ק",
];
const civilDate = (value: string) =>
  new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
let optionsCache: {
  donors: DonorOption[];
  categories: Categories;
  at: number;
} | null = null;

export default function MovementDialog({
  open,
  onOpenChange,
  movement,
  presetDonor,
  people = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  movement?: MovementRecord | null;
  presetDonor?: DonorOption | null;
  people?: Array<{ id: number; fullName: string }>;
  onSaved: () => void;
}) {
  const [donors, setDonors] = useState<DonorOption[]>([]),
    [categories, setCategories] = useState<Categories>(fallback),
    [kind, setKind] = useState<"donation" | "expense">("donation"),
    [donorOpen, setDonorOpen] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    date: "",
    method: "אשראי",
    department: "בית חב״ד",
    subcategory: "",
    donorId: "",
    personId: "",
    donorName: "",
    payee: "",
    purpose: "",
    notes: "",
    recurring: false,
  });
  const set = (patch: Partial<typeof form>) =>
    setForm((v) => ({ ...v, ...patch }));
  useEffect(() => {
    if (!open) return;
    const cached =
      optionsCache && Date.now() - optionsCache.at < 60000
        ? optionsCache
        : null;
    if (cached) {
      setDonors(cached.donors);
      setCategories(cached.categories);
    } else
      Promise.all([
        fetch("/api/donors?view=options", { cache: "force-cache" }),
        fetch("/api/settings", { cache: "force-cache" }),
      ]).then(async ([d, s]) => {
        const donorRows = d.ok ? (await d.json()).donors || [] : [];
        let cats = fallback;
        if (s.ok) {
          const settings = (await s.json()).settings || {};
          try {
            if (settings.movement_categories)
              cats = JSON.parse(settings.movement_categories);
          } catch {}
        }
        optionsCache = { donors: donorRows, categories: cats, at: Date.now() };
        setDonors(donorRows);
        setCategories(cats);
      });
    if (movement) {
      const expense = movement.movementType === "expense";
      setKind(expense ? "expense" : "donation");
      setForm({
        amount: String(movement.amount),
        date: movement.date,
        method: movement.paymentMethod,
        department: movement.department || "בית חב״ד",
        subcategory: movement.subcategory || "",
        donorId: movement.donorId ? String(movement.donorId) : "",
        personId: (movement as MovementRecord & { personId?: number }).personId
          ? String(
              (movement as MovementRecord & { personId?: number }).personId,
            )
          : "",
        donorName: expense ? "" : movement.donorName,
        payee: expense ? movement.donorName : "",
        purpose: movement.purpose || "",
        notes: movement.reason || "",
        recurring: !!movement.isRecurring,
      });
    } else {
      setKind("donation");
      setForm((v) => ({
        ...v,
        amount: "",
        date: "",
        method: "אשראי",
        donorId: presetDonor ? String(presetDonor.id) : "",
        personId: people.length === 1 ? String(people[0].id) : "",
        donorName: presetDonor?.name || "",
        payee: "",
        purpose: "",
        notes: "",
        recurring: false,
      }));
    }
  }, [open, movement, presetDonor?.id, presetDonor?.name, people.length]);
  useEffect(() => {
    const first = categories[form.department]?.[0] || "";
    if (!categories[form.department]?.includes(form.subcategory))
      set({ subcategory: first });
  }, [categories, form.department]);
  async function save() {
    const name = kind === "donation" ? form.donorName : form.payee;
    if (!name || !form.amount || !form.date) {
      setError("יש למלא שם, סכום ותאריך");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      id: movement?.id,
      donorId: form.donorId ? Number(form.donorId) : undefined,
      personId: form.personId ? Number(form.personId) : undefined,
      donorName: name,
      amount: form.amount,
      date: form.date,
      paymentMethod: form.method,
      purpose: kind === "donation" ? form.subcategory : form.purpose,
      reason: form.notes,
      department: form.department,
      subcategory: kind === "donation" ? form.subcategory : "",
      isRecurring: form.recurring,
      movementType: kind,
    };
    const r = await fetch("/api/donations", {
      method: movement ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "לא ניתן לשמור את התנועה");
      return;
    }
    onOpenChange(false);
    onSaved();
  }
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl" className="movement-dialog sm:max-w-3xl">
          <DialogHeader className="movement-dialog-title">
            <DialogTitle>
              {movement ? "עריכת תנועה" : "הוספת תנועה"}
            </DialogTitle>
          </DialogHeader>
          {!presetDonor && (
            <div className="movement-kind-switch">
              <button
                className={kind === "donation" ? "active" : ""}
                onClick={() => setKind("donation")}
              >
                הכנסה
              </button>
              <button
                className={kind === "expense" ? "active" : ""}
                onClick={() => setKind("expense")}
              >
                הוצאה
              </button>
            </div>
          )}
          <div className="movement-form">
            <section className="movement-section">
              <h3>פרטי התנועה</h3>
              <div className="movement-grid">
                <label>
                  <span>סכום *</span>
                  <input
                    value={form.amount}
                    onChange={(e) => set({ amount: e.target.value })}
                    inputMode="decimal"
                    placeholder="₪ 0"
                    autoFocus
                  />
                </label>
                <label>
                  <span>אמצעי תשלום</span>
                  <select
                    value={form.method}
                    onChange={(e) => set({ method: e.target.value })}
                  >
                    {methods.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="movement-date">
                  <span>תאריך *</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => set({ date: e.target.value })}
                  />
                  {form.date && (
                    <div className="hebrew-date-preview">
                      <b>{formatHebrewDate(form.date)}</b>
                      <small>{civilDate(form.date)}</small>
                    </div>
                  )}
                </label>
              </div>
            </section>
            <section className="movement-section">
              <h3>{kind === "donation" ? "שיוך וייעוד" : "פרטי ההוצאה"}</h3>
              <div className="movement-grid">
                {kind === "donation" ? (
                  <>
                    {presetDonor ? (
                      <>
                        <div className="selected-donor">
                          <span>כרטיס התורם</span>
                          <b>{presetDonor.name}</b>
                        </div>
                        {people.length > 1 ? (
                          <label>
                            <span>נתרם על ידי</span>
                            <select
                              value={form.personId}
                              onChange={(e) =>
                                set({ personId: e.target.value })
                              }
                            >
                              <option value="">הכרטיס המשותף</option>
                              {people.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.fullName}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : people.length === 1 ? (
                          <div className="selected-donor person">
                            <span>נתרם על ידי</span>
                            <b>{people[0].fullName}</b>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <label>
                          <span>שם התורם *</span>
                          <select
                            value={form.donorId}
                            onChange={(e) => {
                              const donor = donors.find(
                                (d) => d.id === Number(e.target.value),
                              );
                              set({
                                donorId: e.target.value,
                                donorName: donor?.name || "",
                              });
                            }}
                          >
                            <option value="">בחירת תורם</option>
                            {donors.map((d) => (
                              <option value={d.id} key={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="create-donor-box">
                          <span>לא מצאת את התורם?</span>
                          <button
                            type="button"
                            onClick={() => setDonorOpen(true)}
                          >
                            יצירת כרטיס תורם חדש
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <label>
                    <span>עבור מה ההוצאה *</span>
                    <input
                      value={form.payee}
                      onChange={(e) => set({ payee: e.target.value })}
                      placeholder="שם ספק או פירוט ההוצאה"
                    />
                  </label>
                )}
                <label>
                  <span>מחלקה ראשית</span>
                  <select
                    value={form.department}
                    onChange={(e) => set({ department: e.target.value })}
                  >
                    {Object.keys(categories).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                {kind === "donation" && (
                  <label>
                    <span>קטגוריית משנה</span>
                    <select
                      value={form.subcategory}
                      onChange={(e) => set({ subcategory: e.target.value })}
                    >
                      {(categories[form.department] || []).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </section>
            <section className="movement-section movement-notes">
              <div className="recurring-row">
                <div>
                  <b>{kind === "donation" ? "תנועה קבועה" : "הוצאה קבועה"}</b>
                  <small>
                    {kind === "donation"
                      ? "למשל הוראת קבע חודשית"
                      : "למשל תשלום חודשי לספק"}
                  </small>
                </div>
                <label className="toggle-control">
                  <input
                    checked={form.recurring}
                    onChange={(e) => set({ recurring: e.target.checked })}
                    type="checkbox"
                  />
                  <i />
                </label>
              </div>
              <label>
                <span>הערות</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  rows={3}
                  placeholder="פרטים נוספים, אם ישנם"
                />
              </label>
            </section>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "שומר…" : movement ? "שמירת שינויים" : "שמירת תנועה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <DonorFormDialog
        open={donorOpen}
        onOpenChange={setDonorOpen}
        onCreated={(donor) => {
          optionsCache = null;
          setDonors((v) => [...v, donor]);
          set({ donorId: String(donor.id), donorName: donor.name });
        }}
      />
    </>
  );
}
