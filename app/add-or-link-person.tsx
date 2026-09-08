"use client";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Search,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
type Result = {
  id: number | string;
  fullName: string;
  phone: string;
  email: string;
  idNumber: string;
  donorCardId: number | null;
  donorCardName: string | null;
};
type Conflict = {
  currentCard: { id: number; name: string };
  linkedDonationCount: number;
  person: Result;
};
const initial = {
  fullName: "",
  greetingName: "",
  phone: "",
  secondaryPhone: "",
  email: "",
  idNumber: "",
  postalAddress: "",
  preferredMethod: "WhatsApp",
  alternativeNames: "",
  notes: "",
};
export default function AddOrLinkPerson({
  open,
  onOpenChange,
  donorCardId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  donorCardId: number;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Result[]>([]),
    [creating, setCreating] = useState(false),
    [form, setForm] = useState(initial),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState<Conflict | null>(null),
    [pending, setPending] = useState<Result | null>(null),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setCreating(false);
      setConflict(null);
      setError("");
      return;
    }
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const r = await fetch(`/api/people?q=${encodeURIComponent(query)}`),
        j = await r.json();
      setResults(r.ok ? j.people || [] : []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);
  async function link(person: Result, transfer = false) {
    setError("");
    const r = await fetch("/api/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "link",
          personId: person.id,
          targetDonorCardId: donorCardId,
          transfer,
        }),
      }),
      j = await r.json();
    if (r.status === 409 && j.conflict) {
      setPending(person);
      setConflict(j.conflict);
      return;
    }
    if (!r.ok) {
      setError(j.error || "לא ניתן לקשר את האדם");
      return;
    }
    onOpenChange(false);
    onSaved();
  }
  async function create(confirmDuplicate = false) {
    const r = await fetch("/api/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          targetDonorCardId: donorCardId,
          ...form,
          confirmDuplicate,
        }),
      }),
      j = await r.json();
    if (r.status === 409 && j.matches) {
      setError(
        `נמצאו ${j.matches.length} התאמות אפשריות. חפש וקשר אדם קיים, או אשר יצירה למרות ההתאמה.`,
      );
      return;
    }
    if (!r.ok) {
      setError(j.error || "לא ניתן ליצור את האדם");
      return;
    }
    setForm(initial);
    onOpenChange(false);
    onSaved();
  }
  const set = (key: string, value: string) =>
    setForm((v) => ({ ...v, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="link-person-dialog sm:max-w-2xl">
        <DialogHeader className="text-right">
          <DialogTitle>הוספת / קישור אדם לכרטיס</DialogTitle>
        </DialogHeader>
        {conflict && pending ? (
          <div className="person-conflict">
            <AlertTriangle />
            <h3>
              {pending.fullName} כבר משויך לכרטיס „{conflict.currentCard.name}”
            </h3>
            <p>
              העברה לא תעביר תרומות מהכרטיס הקיים.{" "}
              {conflict.linkedDonationCount
                ? `${conflict.linkedDonationCount} תרומות המשויכות לאדם יישארו בכרטיס המקורי ויהפכו לתרומות של הכרטיס המשותף.`
                : "אין תרומות אישיות שיושפעו."}
            </p>
            <div>
              <Button variant="outline" asChild>
                <a href={`/donors/${conflict.currentCard.id}`}>
                  פתיחת הכרטיס הקיים
                </a>
              </Button>
              <Button
                className="danger-button"
                onClick={() => void link(pending, true)}
              >
                <ArrowLeftRight />
                העברה לכרטיס הנוכחי
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setConflict(null);
                  setPending(null);
                }}
              >
                ביטול
              </Button>
            </div>
          </div>
        ) : creating ? (
          <>
            <div className="person-create-head">
              <button
                onClick={() => {
                  setCreating(false);
                  setError("");
                }}
              >
                חזרה לחיפוש
              </button>
              <p>
                נוצר Person חדש ומקושר לכרטיס הנוכחי — ללא יצירת DonorCard נוסף.
              </p>
            </div>
            <div className="detail-form-grid">
              {[
                ["שם מלא *", "fullName"],
                ["שם לפנייה", "greetingName"],
                ["טלפון ראשי", "phone"],
                ["טלפון נוסף", "secondaryPhone"],
                ["דוא״ל", "email"],
                ["ת״ז / ח״פ", "idNumber"],
                ["כתובת", "postalAddress"],
                ["שמות חלופיים", "alternativeNames"],
              ].map(([label, key]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ))}
              <label>
                <span>דרך משלוח</span>
                <select
                  value={form.preferredMethod}
                  onChange={(e) => set("preferredMethod", e.target.value)}
                >
                  <option>WhatsApp</option>
                  <option value="email">מייל</option>
                  <option value="mail">דואר</option>
                  <option value="none">לא לשלוח</option>
                </select>
              </label>
              <label className="wide">
                <span>הערות</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                />
              </label>
            </div>
            {error && (
              <div className="person-duplicate-warning">
                <AlertTriangle />
                <span>{error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void create(true)}
                >
                  יצירה בכל זאת
                </Button>
              </div>
            )}
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setCreating(false)}>
                ביטול
              </Button>
              <Button onClick={() => void create()}>יצירת האדם וקישורו</Button>
            </div>
          </>
        ) : (
          <>
            <label className="person-search">
              <Search />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש אדם קיים לפי שם, טלפון, דוא״ל או ת״ז…"
              />
            </label>
            <div className="person-search-results">
              {loading ? (
                <p>מחפש…</p>
              ) : (
                results.map((person) => (
                  <button key={person.id} onClick={() => void link(person)}>
                    <span className="person-result-avatar">
                      {person.fullName.slice(0, 1)}
                    </span>
                    <span>
                      <b>{person.fullName}</b>
                      <small>
                        {[person.phone, person.email]
                          .filter(Boolean)
                          .join(" · ") || "אין פרטי קשר"}
                      </small>
                      {person.donorCardName && (
                        <em>משויך כעת: {person.donorCardName}</em>
                      )}
                    </span>
                    <UserPlus />
                  </button>
                ))
              )}
              {query.length >= 2 && !loading && !results.length && (
                <div className="person-no-results">
                  <UsersRound />
                  <p>לא נמצא אדם מתאים</p>
                </div>
              )}
            </div>
            {error && <p className="form-error">{error}</p>}
            <button
              className="create-person-secondary"
              onClick={() => {
                setCreating(true);
                setForm((v) => ({ ...v, fullName: query }));
              }}
            >
              <UserPlus />
              יצירת אדם חדש
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
