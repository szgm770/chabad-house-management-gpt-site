"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DonorFormDialog from "./donor-form-dialog";
import { prefetchDonorSummary } from "./donor-detail-cache";

type DateRow = {
  kind: string;
  customName: string;
  hebrewDay: string;
  hebrewMonth: string;
  hebrewYear: string;
};
type Donor = {
  id: number;
  name: string;
  cardNameMode?: "AUTO" | "MANUAL";
  peopleNames?: string;
  alias: string;
  idNumber: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  address: string;
  notes: string;
  preferredMethod: string;
  specialDates?: DateRow[];
  specialDateCount?: number;
};
const templateHeaders = [
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
const templateExample = [
  "ישראל ישראלי",
  "ר׳ ישראל",
  "123456789",
  "0501234567",
  "",
  "israel@example.com",
  "WhatsApp",
  "רחוב הדוגמה 1, ירושלים",
  "תורם ותיק",
  "יום הולדת||י״ב|ניסן|תשמ״ד; יארצייט|ר׳ מאיר|ג׳|אלול|",
];

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
const download = (filename: string, contents: string) => {
  const blob = new Blob(["\ufeff" + contents], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i],
      next = text[i + 1];
    if (c === '"' && quoted && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (c === '"') {
      quoted = !quoted;
      continue;
    }
    if (c === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};
const parseDates = (value: string): DateRow[] =>
  value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [
        kind = "אחר",
        customName = "",
        hebrewDay = "",
        hebrewMonth = "",
        hebrewYear = "",
      ] = part.split("|").map((x) => x.trim());
      return { kind, customName, hebrewDay, hebrewMonth, hebrewYear };
    })
    .filter((d) => d.hebrewDay && d.hebrewMonth);

export default function DonorCenter() {
  const [records, setRecords] = useState<Donor[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Donor | null>(null);
  const [notice, setNotice] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function load(offset = 0, search = query, order = sort) {
    if (!offset) setLoading(true);
    const r = await fetch(`/api/donors?view=list&limit=50&offset=${offset}&q=${encodeURIComponent(search)}&sort=${encodeURIComponent(order)}`);
    if (r.ok) {
      const j = await r.json();
      setRecords((current) =>
        offset ? [...current, ...(j.donors || [])] : j.donors || [],
      );
      setHasMore(!!j.hasMore);
      setTotal(Number(j.total || 0));
    }
    setLoading(false);
  }
  async function remove(donor: Donor) {
    if (
      !confirm(
        `להסיר את כרטיס התורם „${donor.name}” מהמערכת הפעילה? הכרטיס וההיסטוריה יישמרו בארכיון לצורך שחזור ובקרה.`,
      )
    )
      return;
    const r = await fetch(`/api/donors?id=${donor.id}`, { method: "DELETE" });
    const result = await r.json().catch(() => ({}));
    if (!r.ok) {
      setNotice(result.error || "לא ניתן להסיר את התורם");
      return;
    }
    setRecords(current => current.filter(item => item.id !== donor.id));
    setTotal(current => Math.max(0, current - 1));
    setNotice("כרטיס התורם הוסר והועבר לארכיון");
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
    setSort(params.get("sort") || "newest");
    const scroll = Number(sessionStorage.getItem("donors-scroll") || 0);
    if (scroll) requestAnimationFrame(() => window.scrollTo({ top: scroll }));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(0, query, sort), 220);
    return () => window.clearTimeout(timer);
  }, [query, sort]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "donors");
    query ? url.searchParams.set("q", query) : url.searchParams.delete("q");
    url.searchParams.set("sort", sort);
    window.history.replaceState({}, "", url);
  }, [query, sort]);
  const shown = records;
  function getTemplate() {
    download(
      "תבנית-ייבוא-תורמים.csv",
      [templateHeaders, templateExample]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n"),
    );
  }
  async function exportDonors() {
    const r = await fetch("/api/donors/export");
    if (!r.ok) {
      setNotice("לא ניתן לייצא כרגע");
      return;
    }
    download("רשימת-תורמים.csv", (await r.text()).replace(/^\ufeff/, ""));
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage("");
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportMessage("יש להעלות קובץ CSV שנשמר מתוך Excel.");
      return;
    }
    const [headers, ...data] = parseCsv(
      (await file.text()).replace(/^\ufeff/, ""),
    );
    if (!headers?.length) {
      setImportMessage("הקובץ ריק או לא תקין.");
      return;
    }
    const field = (name: string) => headers.findIndex((h) => h.trim() === name),
      nameIndex = field("שם מלא");
    if (nameIndex < 0) {
      setImportMessage("חסרה העמודה 'שם מלא'. הורד את התבנית והשתמש בה.");
      return;
    }
    const from = (row: string[], header: string) => {
      const index = field(header);
      return index < 0 ? "" : row[index] || "";
    };
    const rows = data
      .map((row) => ({
        name: row[nameIndex],
        alias: from(row, "כינוי"),
        idNumber: from(row, "מספר ת.ז."),
        phone: from(row, "טלפון ראשי"),
        secondaryPhone: from(row, "טלפון נוסף"),
        email: from(row, "מייל"),
        preferredMethod: from(row, "דרך משלוח מועדפת לסקירות"),
        address: from(row, "כתובת למשלוח דואר"),
        notes: from(row, "הערות אישיות"),
        specialDates: parseDates(from(row, "תאריכים מיוחדים")),
      }))
      .filter((row) => row.name.trim());
    if (!rows.length) {
      setImportMessage("לא נמצאו תורמים לייבוא.");
      return;
    }
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(await file.text())))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const r = await fetch("/api/donors/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows, filename: file.name, fingerprint }),
    });
    const j = await r.json();
    if (!r.ok) {
      setImportMessage(j.error || "הייבוא נכשל");
      return;
    }
    setImportMessage(`הייבוא הושלם: ${j.added} נוספו, ${j.updated} עודכנו.`);
    setNotice("רשימת התורמים עודכנה בהצלחה");
    await load();
    event.target.value = "";
  }
  return (
    <>
      {notice && (
        <div className="save-notice">
          <Check />
          {notice}
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>מאגר תורמים</h2>
            <p>
              {records.length
                ? `${total} כרטיסי תורם שמורים`
                : "המאגר מוכן לקליטת התורמים הראשונים"}
            </p>
          </div>
          <div className="donor-head-actions">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet />
              ייבוא / ייצוא
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus />
              תורם חדש
            </Button>
          </div>
        </div>
        <div className="work-toolbar">
          <label>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם, כינוי, טלפון, ת״ז או דוא״ל"
            />
          </label>
          <select className="donor-sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="מיון כרטיסי תורם">
            <option value="newest">החדשים תחילה</option>
            <option value="name-asc">שם א׳–ת׳</option>
            <option value="name-desc">שם ת׳–א׳</option>
          </select>
        </div>
        {loading ? (
          <div className="donor-list-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} />
            ))}
          </div>
        ) : shown.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>שם מלא</th>
                  <th>כינוי</th>
                  <th>טלפון</th>
                  <th>דרך סקירות</th>
                  <th>תאריכים מיוחדים</th>
                  <th aria-label="פעולות" />
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        prefetch
                        className="donor-name-link"
                        href={`/donors/${d.id}?origin=donors&return=${encodeURIComponent(typeof window === "undefined" ? "/?view=donors" : `${window.location.pathname}${window.location.search}`)}`}
                        onClick={() =>
                          sessionStorage.setItem(
                            "donors-scroll",
                            String(window.scrollY),
                          )
                        }
                        onMouseEnter={() => void prefetchDonorSummary(d.id)}
                        onFocus={() => void prefetchDonorSummary(d.id)}
                      >
                        {d.name}
                      </Link>
                      {d.peopleNames && d.peopleNames !== d.name && (
                        <small className="donor-linked-people">
                          {d.peopleNames}
                        </small>
                      )}
                    </td>
                    <td>{d.alias || "—"}</td>
                    <td>{d.phone || "—"}</td>
                    <td>
                      <span className="status">{d.preferredMethod}</span>
                    </td>
                    <td>{d.specialDateCount || 0}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          aria-label="עריכת תורם"
                          onClick={(event) => { event.stopPropagation(); setEditing(d); }}
                        >
                          <Pencil />
                        </button>
                        <button
                          className="danger"
                          aria-label="מחיקת תורם"
                          onClick={(event) => { event.stopPropagation(); void remove(d); }}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="database-empty">
            <UsersRound />
            <h3>לא נמצאו תורמים</h3>
            <p>נסה חיפוש אחר או הוסף כרטיס תורם חדש.</p>
          </div>
        )}
        {hasMore && !query && (
          <div className="donor-load-more">
            <Button variant="outline" onClick={() => void load(records.length, query, sort)}>
              טעינת תורמים נוספים
            </Button>
          </div>
        )}
      </section>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent dir="rtl" className="import-dialog">
          <DialogHeader className="text-right">
            <DialogTitle>ייבוא וייצוא תורמים</DialogTitle>
            <DialogDescription>
              הייבוא משתמש בקובץ CSV שנפתח ונערך ישירות ב־Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="import-steps">
            <article>
              <span>1</span>
              <div>
                <b>הורדת תבנית לדוגמה</b>
                <p>התבנית כוללת את כל השדות ואת מבנה התאריכים המיוחדים.</p>
              </div>
              <Button variant="outline" onClick={getTemplate}>
                <Download />
                הורדת התבנית
              </Button>
            </article>
            <article>
              <span>2</span>
              <div>
                <b>העלאת הרשימה המוכנה</b>
                <p>שמור את הקובץ מ־Excel כ־CSV (UTF-8), ואז בחר אותו כאן.</p>
              </div>
              <Button onClick={() => fileRef.current?.click()}>
                <Upload />
                בחירת קובץ
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void importFile(e)}
              />
            </article>
            <article>
              <span>3</span>
              <div>
                <b>ייצוא רשימת התורמים</b>
                <p>הורד את כל הכרטיסים והפרטים הקיימים לקובץ Excel־תואם.</p>
              </div>
              <Button variant="outline" onClick={() => void exportDonors()}>
                <Download />
                ייצוא רשימה
              </Button>
            </article>
          </div>
          {importMessage && <p className="import-message">{importMessage}</p>}
          <div className="import-tip">
            <b>תאריכים מיוחדים:</b> כל תאריך נכתב כך:{" "}
            <code>סוג|שם מותאם|יום|חודש|שנה</code>. ניתן להוסיף כמה תאריכים
            באמצעות נקודה־פסיק.
          </div>
        </DialogContent>
      </Dialog>
      <DonorFormDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={async () => {
          setNotice("כרטיס התורם נשמר בהצלחה");
          await load();
        }}
      />
      <DonorFormDialog
        open={!!editing}
        onOpenChange={(value) => !value && setEditing(null)}
        donor={editing}
        onSaved={async () => {
          setEditing(null);
          setNotice("כרטיס התורם עודכן");
          await load();
        }}
      />
    </>
  );
}
