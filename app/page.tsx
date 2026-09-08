"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  ContactRound,
  CopyCheck,
  CreditCard,
  Database,
  Download,
  FileText,
  HandCoins,
  HardDriveDownload,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  Link2,
  Mail,
  Menu,
  Merge,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Upload,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import AttentionCenter from "./attention-center";
import SettingsHub from "./settings-hub";
import FeedbackLauncher from "./feedback-launcher";
import DonorCenter from "./donor-center";
import MovementCenter from "./movement-center";
import ReviewCenter from "./review-center";
import QuickActions from "./quick-actions";
import DashboardCenter from "./dashboard-center";
import { DuplicateCenter, RetentionCenter } from "./donor-workflows";
import { formatHebrewDate } from "./hebrew-date";
import UserProfile from "./user-profile";

type View =
  | "dashboard"
  | "donors"
  | "retention"
  | "duplicates"
  | "movements"
  | "donations"
  | "expenses"
  | "reviews"
  | "attention"
  | "settings"
  | "advanced";
const titles: Record<View, [string, string]> = {
  dashboard: ["לוח בקרה", "תמונת מצב ועדיפויות להיום"],
  donors: ["מאגר תורמים", "ניהול אנשים וכרטיסי תורם"],
  retention: ["שימור קשר", "מעקב אחר קשר רציף ומשמעותי"],
  duplicates: ["כפילויות לבדיקה", "זיהוי ואיחוד רשומות דומות"],
  movements: ["תנועות", "כל ההכנסות וההוצאות במקום אחד"],
  donations: ["תרומות", "תנועות הכנסה ושיוך לכרטיסי תורמים"],
  expenses: ["הוצאות", "תנועות הוצאה ותזרים"],
  reviews: ["סקירות פעילות", "הכנת סקירה ומעקב משלוחים"],
  attention: ["דורש טיפול", "כל המשימות החשובות במקום אחד"],
  settings: ["הגדרות", "ניהול המערכת, העדפות וחיבורים"],
  advanced: ["הגדרות", "ניהול המערכת, העדפות וחיבורים"],
};
const nav = [
  { id: "dashboard" as View, label: "לוח בקרה", icon: LayoutDashboard },
  {
    id: "donors" as View,
    label: "תורמים",
    icon: UsersRound,
    children: [
      { id: "donors" as View, label: "מאגר תורמים" },
      { id: "retention" as View, label: "שימור קשר" },
      { id: "duplicates" as View, label: "כפילויות לבדיקה" },
    ],
  },
  { id: "movements" as View, label: "תנועות", icon: HandCoins },
  { id: "reviews" as View, label: "סקירות פעילות", icon: FileText },
  { id: "attention" as View, label: "דורש טיפול", icon: AlertCircle },
  { id: "settings" as View, label: "הגדרות", icon: Settings },
];
const donors = [
  ["משפחת לוי", "משפחה", "₪12,450", "12 באוג׳ 2026", "פעיל"],
  ["דוד כהן", "יחיד", "₪8,200", "3 באוג׳ 2026", "לטיפוח"],
  ["רחל ומנחם פרידמן", "זוג", "₪6,750", "28 ביולי 2026", "פעיל"],
  ["מאפיית השכונה בע״מ", "עסק", "₪4,300", "10 ביולי 2026", "רדום"],
];
const field = (id: string) =>
  (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)
    ?.value || "";
async function saveRecord(endpoint: string, payload: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "לא ניתן לשמור את הנתונים");
  }
  return response.json();
}
const hebrewDate = formatHebrewDate;
const civilDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};
function DualDateField({
  id,
  label = "תאריך",
}: {
  id: string;
  label?: string;
}) {
  const [value, setValue] = useState("");
  return (
    <label className="dual-date-field">
      <span>{label}</span>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {value && (
        <small>
          <CalendarDays />
          {hebrewDate(value)} · {civilDate(value)}
        </small>
      )}
    </label>
  );
}

function AppNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [mark, setMark] = useState("לב");
  const [color, setColor] = useState("gold");
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.settings?.brand_mark) setMark(j.settings.brand_mark);
        if (j.settings?.brand_color) setColor(j.settings.brand_color);
      })
      .catch(() => {});
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ mark: string; color: string }>)
        .detail;
      setMark(detail.mark);
      setColor(detail.color);
    };
    window.addEventListener("brand-settings-updated", sync);
    return () => window.removeEventListener("brand-settings-updated", sync);
  }, []);
  const go = (v: View) => {
    setView(v);
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar side="right" collapsible="icon" className="app-sidebar">
      <SidebarHeader className="brand">
        <div className={`brand-mark ${color}`}>{mark.slice(0, 2)}</div>
        <div className="brand-copy">
          <b>בית חב״ד לב העיר</b>
          <small>מערכת ניהול</small>
        </div>
        <SidebarTrigger
          className="sidebar-toggle"
          aria-label="הרחבת או צמצום הניווט"
        />
      </SidebarHeader>
      <SidebarContent className="nav-content">
        <SidebarGroup>
          <SidebarGroupLabel className="nav-label">
            ניווט ראשי
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  view === item.id || item.children?.some((c) => c.id === view);
                return (
                  <SidebarMenuItem key={item.id}>
                    <div className="nav-row">
                      <SidebarMenuButton
                        tooltip={item.label}
                        isActive={active}
                        onClick={() => go(item.id)}
                        className="nav-button"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                        {item.count && <em>{item.count}</em>}
                      </SidebarMenuButton>
                    </div>
                    {item.children && (
                      <SidebarMenuSub className="nav-sub">
                        {item.children.map((c) => (
                          <SidebarMenuSubItem key={c.id}>
                            <SidebarMenuSubButton
                              href="#"
                              isActive={view === c.id}
                              onClick={(e) => {
                                e.preventDefault();
                                go(c.id);
                              }}
                              className="sub-button"
                            >
                              {c.label}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <FeedbackLauncher />
      <SidebarFooter className="profile">
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
function DonorTable({
  compact = false,
  onOpen,
}: {
  compact?: boolean;
  onOpen?: (r: string[]) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>כרטיס תורם</th>
            <th>סוג</th>
            <th>סך תרומות</th>
            <th>פעילות אחרונה</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {donors.slice(0, compact ? 3 : 4).map((r) => (
            <tr
              key={r[0]}
              className={onOpen ? "clickable-row" : ""}
              onClick={() => onOpen?.(r)}
            >
              <td>
                <span className="avatar">{r[0].slice(0, 2)}</span>
                <b>{r[0]}</b>
              </td>
              <td>{r[1]}</td>
              <td>
                <b>{r[2]}</b>
              </td>
              <td>{r[3]}</td>
              <td>
                <span
                  className={`status ${r[4] === "רדום" ? "muted" : r[4] === "לטיפוח" ? "warm" : ""}`}
                >
                  {r[4]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Dashboard({ setView }: { setView: (v: View) => void }) {
  const metrics = [
    { t: "תרומות החודש", v: "₪18,640", s: "12 תרומות", i: CircleDollarSign },
    { t: "תורמים פעילים", v: "148", s: "6 חדשים החודש", i: ContactRound },
    { t: "סקירה חודשית", v: "72%", s: "108 מתוך 150 נשלחו", i: BarChart3 },
    { t: "דורש טיפול", v: "7", s: "3 בעדיפות גבוהה", i: AlertCircle },
  ];
  return (
    <div className="stack">
      <section className="metrics">
        {metrics.map((m) => (
          <article className="metric" key={m.t}>
            <span className="metric-icon">
              <m.i />
            </span>
            <div>
              <small>{m.t}</small>
              <strong>{m.v}</strong>
              <p>{m.s}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="main-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>פעילות תרומות</h2>
              <p>ששת החודשים האחרונים · נתוני דוגמה</p>
            </div>
            <button className="select">
              6 חודשים <ChevronLeft />
            </button>
          </div>
          <div className="chart">
            <div className="grid-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="bars">
              {[38, 55, 43, 72, 61, 84].map((h, i) => (
                <div className="bar-wrap" key={i}>
                  <div className="bar" style={{ height: `${h}%` }} />
                  <small>
                    {["מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳"][i]}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>דורש תשומת לב</h2>
              <p>לפי דחיפות והשפעה</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("attention")}
            >
              הצג הכול
            </Button>
          </div>
          <div className="tasks">
            {[
              {
                t: "3 תורמים ללא מענה",
                d: "ממתינים למעקב מעל שבוע",
                i: Clock3,
                c: "amber",
              },
              {
                t: "2 כפילויות בסבירות גבוהה",
                d: "כדאי לבדוק לפני הייבוא הבא",
                i: CopyCheck,
                c: "blue",
              },
              {
                t: "סקירת אב טרם הושלמה",
                d: "42 נמענים עדיין לא קיבלו",
                i: FileText,
                c: "green",
              },
            ].map((x) => (
              <button className="task" key={x.t}>
                <span className={x.c}>
                  <x.i />
                </span>
                <div>
                  <b>{x.t}</b>
                  <small>{x.d}</small>
                </div>
                <ChevronLeft />
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>תורמים אחרונים</h2>
            <p>פעילות אחרונה במאגר · נתוני דוגמה</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView("donors")}>
            למאגר המלא
          </Button>
        </div>
        <DonorTable compact />
      </section>
    </div>
  );
}
function Advanced() {
  return (
    <>
      <div className="notice">
        <SlidersHorizontal />
        <div>
          <b>תשתית להמשך הדרך</b>
          <p>
            האזורים הבאים מוכנים ברמת מבנה בלבד. חיבורים והגדרות יתווספו בשלבים
            הבאים.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        {[
          "אינטגרציות",
          "Webhooks / API",
          "עמלות ותשלומים",
          "הוראות קבע",
          "כללי התאמה וכפילויות",
          "אוטומציות",
          "משתמשים והרשאות",
          "גיבוי נתונים",
        ].map((x, i) => (
          <article className="setting" key={x}>
            <span>{i + 1}</span>
            <div>
              <h3>{x}</h3>
              <p>טרם הוגדר · יתווסף בהמשך</p>
            </div>
            <ChevronLeft />
          </article>
        ))}
      </div>
    </>
  );
}
function Toolbar({
  placeholder,
  action,
  onAction,
}: {
  placeholder: string;
  action: string;
  onAction?: () => void;
}) {
  return (
    <div className="work-toolbar">
      <label>
        <Search />
        <input placeholder={placeholder} />
      </label>
      <Button variant="outline">
        <SlidersHorizontal /> סינון
      </Button>
      <Button onClick={onAction}>
        <Plus /> {action}
      </Button>
    </div>
  );
}
function DonorsView() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [notice, setNotice] = useState("");
  async function saveDonor() {
    try {
      await saveRecord("/api/donors", {
        name: field("donor-name"),
        type: field("donor-type"),
        phone: field("donor-phone"),
        email: field("donor-email"),
      });
      setOpen(false);
      setNotice("כרטיס התורם נשמר בהצלחה");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "שגיאה בשמירה");
    }
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
            <h2>כרטיסי תורם</h2>
            <p>4 כרטיסי דוגמה · לחיצה על שורה פותחת כרטיס מלא</p>
          </div>
          <Button variant="outline">
            <Merge /> איחוד רשומות
          </Button>
        </div>
        <Toolbar
          placeholder="חיפוש לפי שם, טלפון או דוא״ל"
          action="תורם חדש"
          onAction={() => setOpen(true)}
        />
        <DonorTable onOpen={setSelected} />
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader className="text-right">
            <DialogTitle>הוספת תורם חדש</DialogTitle>
            <DialogDescription>
              הכרטיס יישמר במסד הנתונים של המערכת.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              <span>שם הכרטיס</span>
              <input id="donor-name" placeholder="לדוגמה: משפחת ישראלי" />
            </label>
            <label>
              <span>סוג הכרטיס</span>
              <select id="donor-type">
                <option>אדם יחיד</option>
                <option>זוג / משפחה</option>
                <option>עסק או גוף</option>
              </select>
            </label>
            <label>
              <span>טלפון</span>
              <input id="donor-phone" placeholder="050-0000000" />
            </label>
            <label>
              <span>דוא״ל</span>
              <input id="donor-email" placeholder="name@example.com" />
            </label>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={saveDonor}>שמירת כרטיס</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent dir="rtl" className="donor-dialog sm:max-w-2xl">
          <DialogHeader className="text-right">
            <div className="donor-title">
              <span className="avatar xlarge">{selected?.[0].slice(0, 2)}</span>
              <div>
                <DialogTitle>{selected?.[0]}</DialogTitle>
                <DialogDescription>
                  {selected?.[1]} · כרטיס תורם לדוגמה
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="donor-kpis">
            <div>
              <small>סך כל התרומות</small>
              <b>{selected?.[2]}</b>
            </div>
            <div>
              <small>תרומה אחרונה</small>
              <b>{selected?.[3]}</b>
            </div>
            <div>
              <small>הוראת קבע</small>
              <b>₪500 בחודש</b>
            </div>
          </div>
          <div className="donor-columns">
            <section>
              <h3>אנשי קשר</h3>
              <div className="contact-line">
                <Phone />
                <div>
                  <b>050-1234567</b>
                  <small>טלפון ראשי</small>
                </div>
              </div>
              <div className="contact-line">
                <Mail />
                <div>
                  <b>donor@example.com</b>
                  <small>דוא״ל</small>
                </div>
              </div>
              <div className="contact-line">
                <MessageCircle />
                <div>
                  <b>WhatsApp</b>
                  <small>דרך משלוח מועדפת</small>
                </div>
              </div>
            </section>
            <section>
              <h3>פעילות אחרונה</h3>
              <div className="timeline-item">
                <i />
                <div>
                  <b>תרומה התקבלה · ₪1,800</b>
                  <small>12 באוגוסט 2026</small>
                </div>
              </div>
              <div className="timeline-item">
                <i />
                <div>
                  <b>סקירת תמוז סומנה כ״קיבל״</b>
                  <small>2 באוגוסט 2026</small>
                </div>
              </div>
              <div className="timeline-item">
                <i />
                <div>
                  <b>שיחת תודה</b>
                  <small>15 ביולי 2026</small>
                </div>
              </div>
            </section>
          </div>
          <div className="dialog-actions">
            <Button variant="outline">
              <MessageCircle /> שליחת הודעה
            </Button>
            <Button>
              <Plus /> רישום פעולה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function DonationsView() {
  const [open, setOpen] = useState(false);
  const rows = [
    ["משפחת לוי", "₪1,800", "12 באוג׳ 2026", "העברה בנקאית", "פעילות קיץ"],
    ["דוד כהן", "₪720", "3 באוג׳ 2026", "אשראי", "פעילות שוטפת"],
    ["רחל ומנחם פרידמן", "₪500", "28 ביולי 2026", "הוראת קבע", "בית תמחוי"],
    ["מאפיית השכונה בע״מ", "₪1,200", "10 ביולי 2026", "מזומן", "קמחא דפסחא"],
  ];
  return (
    <>
      <div className="summary-strip">
        <div>
          <small>סה״כ החודש</small>
          <b>₪18,640</b>
        </div>
        <div>
          <small>תרומות חד־פעמיות</small>
          <b>₪12,140</b>
        </div>
        <div>
          <small>הוראות קבע</small>
          <b>₪6,500</b>
        </div>
      </div>
      <section className="panel">
        <Toolbar
          placeholder="חיפוש תרומה או תורם"
          action="תרומה חדשה"
          onAction={() => setOpen(true)}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>תורם</th>
                <th>סכום</th>
                <th>תאריך</th>
                <th>אמצעי תשלום</th>
                <th>ייעוד</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={c}>{i === 1 ? <b>{c}</b> : c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>הזנת תרומה ידנית</DialogTitle>
            <DialogDescription>
              להזנת מזומן, Bit פרטי או מידע היסטורי.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              <span>כרטיס תורם</span>
              <select>
                {donors.map((d) => (
                  <option key={d[0]}>{d[0]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>סכום</span>
              <input inputMode="decimal" placeholder="₪ 0" />
            </label>
            <label>
              <span>תאריך</span>
              <input type="date" />
            </label>
            <label>
              <span>אמצעי תשלום</span>
              <select>
                <option>מזומן</option>
                <option>העברה בנקאית</option>
                <option>Bit פרטי</option>
                <option>אשראי</option>
              </select>
            </label>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={() => setOpen(false)}>שמירת תרומה</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function RetentionView() {
  const cards = [
    {
      n: "דוד כהן",
      s: "מומלץ להתקשר השבוע",
      d: "תרם לאחרונה לפני 27 ימים",
      p: "גבוהה",
    },
    {
      n: "משפחת אדרי",
      s: "יום נישואין בעוד 5 ימים",
      d: "מעדיפים פנייה ב־WhatsApp",
      p: "בינונית",
    },
    {
      n: "יוסף בן־דוד",
      s: "לא נוצר קשר 3 חודשים",
      d: "תורם קבוע בעבר",
      p: "בינונית",
    },
  ];
  return (
    <div className="work-grid">
      {cards.map((c) => (
        <article className="follow-card" key={c.n}>
          <div className="follow-top">
            <span className="avatar large">{c.n.slice(0, 2)}</span>
            <div>
              <h3>{c.n}</h3>
              <p>{c.d}</p>
            </div>
            <span className={`priority ${c.p === "גבוהה" ? "high" : ""}`}>
              {c.p}
            </span>
          </div>
          <div className="follow-note">
            <Clock3 />
            <b>{c.s}</b>
          </div>
          <div className="card-actions">
            <Button size="sm">
              <Phone /> רישום שיחה
            </Button>
            <Button size="sm" variant="outline">
              <MessageCircle /> WhatsApp
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
function DuplicatesView() {
  const [pending, setPending] = useState([true, true]);
  const pairs = [
    {
      a: "משה ישראלי",
      b: "ישראלי משה",
      score: "96%",
      why: "טלפון זהה ושם בסדר הפוך",
    },
    {
      a: "רחל פרידמן",
      b: "רחל ומנחם פרידמן",
      score: "82%",
      why: "כתובת זהה ודמיון בשם",
    },
  ];
  return (
    <div className="dup-list">
      {pairs.map((p, i) =>
        pending[i] ? (
          <article className="duplicate" key={p.a}>
            <div className="match-score">
              <b>{p.score}</b>
              <small>התאמה</small>
            </div>
            <div className="person-compare">
              <div>
                <small>רשומה ראשונה</small>
                <h3>{p.a}</h3>
                <p>050-1234567 · בית שמש</p>
              </div>
              <Merge />
              <div>
                <small>רשומה שנייה</small>
                <h3>{p.b}</h3>
                <p>050-1234567 · בית שמש</p>
              </div>
            </div>
            <p className="match-reason">{p.why}</p>
            <div className="card-actions">
              <Button
                onClick={() =>
                  setPending((x) => x.map((v, j) => (j === i ? false : v)))
                }
              >
                <Merge /> אותו אדם — איחוד
              </Button>
              <Button variant="outline">קישור לכרטיס משותף</Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setPending((x) => x.map((v, j) => (j === i ? false : v)))
                }
              >
                אנשים שונים
              </Button>
            </div>
          </article>
        ) : null,
      )}
      {pending.every((x) => !x) && (
        <div className="empty compact">
          <span>
            <Check />
          </span>
          <h2>אין כפילויות שממתינות לבדיקה</h2>
          <p>כל ההצעות טופלו.</p>
        </div>
      )}
    </div>
  );
}
function ReviewsView() {
  const [received, setReceived] = useState([true, true, false, false]);
  const [create, setCreate] = useState(false);
  const people = ["משפחת לוי", "דוד כהן", "רחל פרידמן", "משפחת אדרי"];
  return (
    <>
      <div className="review-actions">
        <Button onClick={() => setCreate(true)}>
          <Plus /> סקירה חדשה
        </Button>
        <Button variant="outline">
          <CalendarDays /> סקירות קודמות
        </Button>
      </div>
      <section className="review-hero">
        <div>
          <span>סקירה פעילה</span>
          <h2>סקירת פעילות אב תשפ״ו</h2>
          <p>נוצרה עבור תורמים מהחודשים האחרונים והוראות קבע פעילות</p>
        </div>
        <div className="progress-ring">
          <b>{received.filter(Boolean).length}/4</b>
          <small>קיבלו</small>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>רשימת נמענים</h2>
            <p>{received.filter((x) => !x).length} עדיין לא קיבלו</p>
          </div>
          <Button variant="outline">
            <Download /> ייצוא ל־WhatsApp
          </Button>
        </div>
        <div className="recipient-list">
          {people.map((p, i) => (
            <div className="recipient" key={p}>
              <span className="avatar">{p.slice(0, 2)}</span>
              <div>
                <b>{p}</b>
                <small>
                  <MessageCircle /> WhatsApp · 050-1234567
                </small>
              </div>
              <button
                className={received[i] ? "received" : ""}
                onClick={() =>
                  setReceived((x) => x.map((v, j) => (j === i ? !v : v)))
                }
              >
                {received[i] ? (
                  <>
                    <Check /> קיבל
                  </>
                ) : (
                  "לא קיבל"
                )}
              </button>
            </div>
          ))}
        </div>
      </section>
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>פתיחת סקירת פעילות חדשה</DialogTitle>
            <DialogDescription>
              המערכת תכין רשימת נמענים אוטומטית לפי הכללים.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              <span>שם הסקירה</span>
              <input placeholder="לדוגמה: סקירת אלול תשפ״ו" />
            </label>
            <label>
              <span>תקופת תרומות</span>
              <select>
                <option>3 חודשים אחרונים</option>
                <option>חודש אחרון</option>
                <option>חצי שנה</option>
                <option>שנה</option>
              </select>
            </label>
            <label>
              <span>תאריך הסקירה</span>
              <input type="date" />
            </label>
            <label>
              <span>הוראות קבע פעילות</span>
              <select>
                <option>לכלול תמיד</option>
              </select>
            </label>
          </div>
          <div className="preview-box">
            <UsersRound />
            <div>
              <b>כ־148 נמענים צפויים</b>
              <small>המספר יתעדכן לפי הנתונים בפועל</small>
            </div>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setCreate(false)}>
              ביטול
            </Button>
            <Button onClick={() => setCreate(false)}>יצירת סקירה</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function AttentionView() {
  const [tasks, setTasks] = useState([false, false, false, false]);
  const rows = [
    { t: "לחזור לדוד כהן", d: "מעקב טיפוח · ממתין 8 ימים", p: "גבוהה" },
    { t: "לבדוק כפילות: משה ישראלי", d: "התאמה של 96%", p: "גבוהה" },
    { t: "להשלים משלוח סקירת אב", d: "2 נמענים טרם קיבלו", p: "בינונית" },
    {
      t: "להוסיף טלפון למשפחת אדרי",
      d: "מוגדר WhatsApp ללא מספר",
      p: "בינונית",
    },
  ];
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>משימות פתוחות</h2>
          <p>{tasks.filter((x) => !x).length} פריטים נותרו</p>
        </div>
      </div>
      <div className="attention-list">
        {rows.map((r, i) => (
          <button
            className={`attention-row ${tasks[i] ? "done" : ""}`}
            key={r.t}
            onClick={() => setTasks((x) => x.map((v, j) => (j === i ? !v : v)))}
          >
            <span className="check-box">{tasks[i] && <Check />}</span>
            <div>
              <b>{r.t}</b>
              <small>{r.d}</small>
            </div>
            <span className={`priority ${r.p === "גבוהה" ? "high" : ""}`}>
              {r.p}
            </span>
            <ChevronLeft />
          </button>
        ))}
      </div>
    </section>
  );
}
function SettingsView() {
  return (
    <section className="panel settings-form">
      <div className="panel-head">
        <div>
          <h2>פרטי המוסד</h2>
          <p>הפרטים שיופיעו ברחבי המערכת</p>
        </div>
        <Button>שמירת שינויים</Button>
      </div>
      <div className="form-grid wide">
        <label>
          <span>שם המוסד</span>
          <input defaultValue="בית חב״ד לב העיר בית שמש" />
        </label>
        <label>
          <span>שם מנהל המערכת</span>
          <input defaultValue="שניאור זלמן" />
        </label>
        <label>
          <span>דרך משלוח ברירת מחדל</span>
          <select defaultValue="WhatsApp">
            <option>WhatsApp</option>
            <option>דוא״ל</option>
            <option>דואר</option>
          </select>
        </label>
        <label>
          <span>מטבע ברירת מחדל</span>
          <select>
            <option>שקל חדש (₪)</option>
            <option>דולר ($)</option>
            <option>אירו (€)</option>
          </select>
        </label>
      </div>
    </section>
  );
}
function PersistentDonationsView() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const rows = [
    [
      "משפחת לוי",
      "₪1,800",
      "כ״ט באב תשפ״ו · 12 באוגוסט 2026",
      "העברה בנקאית",
      "פעילות קיץ",
    ],
    [
      "דוד כהן",
      "₪720",
      "כ׳ באב תשפ״ו · 3 באוגוסט 2026",
      "אשראי",
      "פעילות שוטפת",
    ],
    [
      "רחל ומנחם פרידמן",
      "₪500",
      "י״ד באב תשפ״ו · 28 ביולי 2026",
      "הוראת קבע",
      "בית תמחוי",
    ],
  ];
  async function save() {
    try {
      await saveRecord("/api/donations", {
        donorName: field("p-donor"),
        amount: field("p-amount"),
        date: field("p-date"),
        paymentMethod: field("p-method"),
        purpose: field("p-purpose"),
      });
      setOpen(false);
      setNotice("התרומה נשמרה במסד הנתונים");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "שגיאה בשמירה");
    }
  }
  return (
    <>
      {notice && (
        <div className="save-notice">
          <Check />
          {notice}
        </div>
      )}
      <div className="summary-strip">
        <div>
          <small>סה״כ החודש</small>
          <b>₪18,640</b>
        </div>
        <div>
          <small>תרומות חד־פעמיות</small>
          <b>₪12,140</b>
        </div>
        <div>
          <small>הוראות קבע</small>
          <b>₪6,500</b>
        </div>
      </div>
      <section className="panel">
        <Toolbar
          placeholder="חיפוש תרומה או תורם"
          action="תרומה חדשה"
          onAction={() => setOpen(true)}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>תורם</th>
                <th>סכום</th>
                <th>תאריך עברי ולועזי</th>
                <th>אמצעי תשלום</th>
                <th>ייעוד</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={c}>{i === 1 ? <b>{c}</b> : c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>הזנת תרומה ידנית</DialogTitle>
            <DialogDescription>
              בחירת תאריך לועזי מציגה מיד את התאריך העברי המסונכרן.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              <span>כרטיס תורם</span>
              <select id="p-donor">
                {donors.map((d) => (
                  <option key={d[0]}>{d[0]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>סכום</span>
              <input id="p-amount" inputMode="decimal" placeholder="₪ 0" />
            </label>
            <DualDateField id="p-date" />
            <label>
              <span>אמצעי תשלום</span>
              <select id="p-method">
                <option>מזומן</option>
                <option>העברה בנקאית</option>
                <option>Bit פרטי</option>
                <option>אשראי</option>
              </select>
            </label>
            <label>
              <span>ייעוד</span>
              <input id="p-purpose" placeholder="פעילות שוטפת" />
            </label>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={save}>שמירת תרומה</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function PersistentReviewsView() {
  const [received, setReceived] = useState([true, true, false, false]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const people = ["משפחת לוי", "דוד כהן", "רחל פרידמן", "משפחת אדרי"];
  async function save() {
    try {
      await saveRecord("/api/reviews", {
        name: field("review-name"),
        period: field("review-period"),
        reviewDate: field("review-date"),
      });
      setOpen(false);
      setNotice("הסקירה נוצרה ונשמרה");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "שגיאה בשמירה");
    }
  }
  return (
    <>
      {notice && (
        <div className="save-notice">
          <Check />
          {notice}
        </div>
      )}
      <div className="review-actions">
        <Button onClick={() => setOpen(true)}>
          <Plus /> סקירה חדשה
        </Button>
        <Button variant="outline">
          <CalendarDays /> סקירות קודמות
        </Button>
      </div>
      <section className="review-hero">
        <div>
          <span>סקירה פעילה</span>
          <h2>סקירת פעילות אב תשפ״ו</h2>
          <p>תורמים מהחודשים האחרונים והוראות קבע פעילות</p>
        </div>
        <div className="progress-ring">
          <b>{received.filter(Boolean).length}/4</b>
          <small>קיבלו</small>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>רשימת נמענים</h2>
            <p>{received.filter((x) => !x).length} עדיין לא קיבלו</p>
          </div>
          <Button variant="outline">
            <Download /> ייצוא ל־WhatsApp
          </Button>
        </div>
        <div className="recipient-list">
          {people.map((p, i) => (
            <div className="recipient" key={p}>
              <span className="avatar">{p.slice(0, 2)}</span>
              <div>
                <b>{p}</b>
                <small>
                  <MessageCircle /> WhatsApp · 050-1234567
                </small>
              </div>
              <button
                className={received[i] ? "received" : ""}
                onClick={() =>
                  setReceived((x) => x.map((v, j) => (j === i ? !v : v)))
                }
              >
                {received[i] ? (
                  <>
                    <Check /> קיבל
                  </>
                ) : (
                  "לא קיבל"
                )}
              </button>
            </div>
          ))}
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>פתיחת סקירת פעילות חדשה</DialogTitle>
            <DialogDescription>
              רשימת הנמענים תיווצר לפי הכללים שנבחרו.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              <span>שם הסקירה</span>
              <input id="review-name" placeholder="סקירת אלול תשפ״ו" />
            </label>
            <label>
              <span>תקופת תרומות</span>
              <select id="review-period">
                <option>3 חודשים אחרונים</option>
                <option>חודש אחרון</option>
                <option>חצי שנה</option>
                <option>שנה</option>
              </select>
            </label>
            <label>
              <span>תאריך</span>
              <input id="review-date" type="date" />
            </label>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={save}>יצירת סקירה</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
type StoredDonor = {
  id: number;
  name: string;
  type: string;
  phone: string;
  email: string;
  preferredMethod: string;
  status: string;
};
function DatabaseDonorsView() {
  const [records, setRecords] = useState<StoredDonor[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    const r = await fetch("/api/donors");
    if (r.ok) {
      const j = await r.json();
      setRecords(j.donors || []);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    try {
      await saveRecord("/api/donors", {
        name: field("db-name"),
        type: field("db-type"),
        phone: field("db-phone"),
        email: field("db-email"),
      });
      await load();
      setOpen(false);
      setNotice("כרטיס התורם נשמר בהצלחה");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "שגיאה בשמירה");
    }
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
            <h2>כרטיסי תורם</h2>
            <p>
              {records.length
                ? `${records.length} כרטיסים שמורים`
                : "המאגר מוכן לקליטת התורמים הראשונים"}
            </p>
          </div>
          <Button variant="outline">
            <Merge /> איחוד רשומות
          </Button>
        </div>
        <Toolbar
          placeholder="חיפוש לפי שם, טלפון או דוא״ל"
          action="תורם חדש"
          onAction={() => setOpen(true)}
        />
        {records.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>כרטיס תורם</th>
                  <th>סוג</th>
                  <th>טלפון</th>
                  <th>דוא״ל</th>
                  <th>דרך משלוח</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="avatar">{r.name.slice(0, 2)}</span>
                      <b>{r.name}</b>
                    </td>
                    <td>{r.type}</td>
                    <td
                      className={
                        !r.phone && r.preferredMethod === "WhatsApp"
                          ? "missing"
                          : ""
                      }
                    >
                      {r.phone || "חסר מספר"}
                    </td>
                    <td>{r.email || "—"}</td>
                    <td>
                      <span className="status">{r.preferredMethod}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="database-empty">
            <UsersRound />
            <h3>עדיין אין תורמים שמורים</h3>
            <p>הוסף את התורם הראשון או המתן לייבוא הנתונים.</p>
          </div>
        )}
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>הוספת תורם חדש</DialogTitle>
            <DialogDescription>
              הכרטיס יישמר ויופיע במאגר מיד.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              <span>שם הכרטיס</span>
              <input id="db-name" placeholder="משפחת ישראלי" />
            </label>
            <label>
              <span>סוג</span>
              <select id="db-type">
                <option>אדם יחיד</option>
                <option>זוג / משפחה</option>
                <option>עסק או גוף</option>
              </select>
            </label>
            <label>
              <span>טלפון</span>
              <input id="db-phone" placeholder="050-0000000" />
            </label>
            <label>
              <span>דוא״ל</span>
              <input id="db-email" placeholder="name@example.com" />
            </label>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={save}>שמירת כרטיס</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function LaunchAdvanced() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveSettings() {
    setBusy(true);
    try {
      const payload = {
        credit_fee: field("fee-credit"),
        bit_fee: field("fee-bit"),
        bank_fee: field("fee-bank"),
        auto_dedupe_threshold: field("dedupe-threshold"),
        credit_settlement_day: field("credit-day"),
        bit_settlement_day: field("bit-day"),
        bank_recurring_day: field("bank-recurring-day"),
        system_timezone: "Asia/Jerusalem",
        dual_calendar: "true",
      };
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("לא ניתן לשמור");
      setNotice("ההגדרות נשמרו בהצלחה");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setBusy(false);
    }
  }
  async function importCsv(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter(Boolean);
      if (lines.length < 2) throw new Error("הקובץ ריק");
      const split = (line: string) =>
        line.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
      const headers = split(lines[0]).map((x) => x.toLowerCase());
      const pick = (row: string[], names: string[]) => {
        const i = headers.findIndex((h) => names.includes(h));
        return i >= 0 ? row[i] : "";
      };
      const rows = lines.slice(1).map((line) => {
        const r = split(line);
        return {
          name: pick(r, ["שם", "שם תורם", "name", "donor name"]),
          phone: pick(r, ["טלפון", "phone"]),
          email: pick(r, ["דוא״ל", "אימייל", "email"]),
          amount: pick(r, ["סכום", "amount"]),
          date: pick(r, ["תאריך", "date"]),
          paymentMethod: pick(r, ["אמצעי תשלום", "payment method", "method"]),
          purpose: pick(r, ["ייעוד", "מטרה", "purpose"]),
          externalId: pick(r, [
            "מזהה",
            "מזהה חיצוני",
            "external id",
            "transaction id",
          ]),
        };
      });
      const bytes = new TextEncoder().encode(text);
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "CSV",
          filename: file.name,
          fingerprint: hash,
          rows,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "הייבוא נכשל");
      setNotice(
        `הייבוא הושלם: ${result.imported} תרומות נקלטו, ${result.skipped} שורות דולגו`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "שגיאה בייבוא");
    } finally {
      setBusy(false);
    }
  }
  const groups = [
    {
      icon: Link2,
      title: "אינטגרציות",
      desc: "נדרים פלוס, SUMIT, Google ו־WhatsApp",
      state: "ממתין לפרטי גישה",
    },
    {
      icon: KeyRound,
      title: "Webhooks / API",
      desc: "נקודות קצה מאובטחות וסודות חיבור",
      state: "תשתית מוכנה",
    },
    {
      icon: CreditCard,
      title: "עמלות ותשלומים",
      desc: "חישוב סכום נטו ומועדי זיכוי",
      state: "ניתן להגדרה",
    },
    {
      icon: RefreshCw,
      title: "הוראות קבע",
      desc: "מעקב פעיל, נכשל ומסתיים",
      state: "מודל נתונים מוכן",
    },
    {
      icon: CopyCheck,
      title: "כללי התאמה וכפילויות",
      desc: "טלפון, ת״ז, דוא״ל ודמיון בשם",
      state: "בדיקה ידנית בטוחה",
    },
    {
      icon: Zap,
      title: "אוטומציות",
      desc: "תזכורות, משימות וטיפול אוטומטי",
      state: "ממתין לחיבורים",
    },
    {
      icon: Shield,
      title: "משתמשים והרשאות",
      desc: "מנהל יחיד כעת, מוכן להרחבה",
      state: "גישה מוגנת",
    },
    {
      icon: Database,
      title: "גיבוי נתונים",
      desc: "ייצוא מלא של כל מאגר המערכת",
      state: "פעיל",
    },
  ];
  return (
    <div className="launch-settings">
      {notice && (
        <div className="save-notice">
          <Check />
          {notice}
        </div>
      )}
      <div className="launch-banner">
        <div>
          <span>מרכז מוכנות להשקה</span>
          <h2>הגדרות מתקדמות ותשתיות</h2>
          <p>
            המערכת עצמאית ופעילה. שירותים חיצוניים יחוברו לאחר קבלת פרטי הגישה.
          </p>
        </div>
        <div className="launch-score">
          <b>82%</b>
          <small>מוכנות תפעולית</small>
        </div>
      </div>
      <section className="config-panel">
        <div className="panel-head">
          <div>
            <h2>עמלות ומועדי תזרים</h2>
            <p>אחוזים וימי זיכוי ברירת מחדל · ניתן לשינוי בכל עת</p>
          </div>
          <Button onClick={saveSettings} disabled={busy}>
            {busy ? "שומר..." : "שמירת הגדרות"}
          </Button>
        </div>
        <div className="config-grid">
          <label>
            <span>עמלת אשראי (%)</span>
            <input
              id="fee-credit"
              type="number"
              step="0.01"
              defaultValue="1.2"
            />
          </label>
          <label>
            <span>עמלת Bit (%)</span>
            <input id="fee-bit" type="number" step="0.01" defaultValue="0" />
          </label>
          <label>
            <span>עמלת העברה בנקאית (%)</span>
            <input id="fee-bank" type="number" step="0.01" defaultValue="0" />
          </label>
          <label>
            <span>יום זיכוי אשראי</span>
            <input
              id="credit-day"
              type="number"
              min="1"
              max="31"
              defaultValue="2"
            />
          </label>
          <label>
            <span>יום זיכוי Bit</span>
            <input
              id="bit-day"
              type="number"
              min="1"
              max="31"
              defaultValue="9"
            />
          </label>
          <label>
            <span>יום זיכוי הו״ק בנקאית</span>
            <input
              id="bank-recurring-day"
              type="number"
              min="1"
              max="31"
              defaultValue="5"
            />
          </label>
          <label>
            <span>רגישות זיהוי כפילויות</span>
            <select id="dedupe-threshold">
              <option value="high">גבוהה</option>
              <option value="medium">בינונית</option>
              <option value="low">נמוכה</option>
            </select>
          </label>
        </div>
      </section>
      <section className="tools-grid">
        <article className="tool-card">
          <Upload />
          <div>
            <h3>ייבוא CSV</h3>
            <p>ייבוא תורמים ותרומות עם מניעת ייבוא כפול לפי חתימת הקובץ.</p>
          </div>
          <label className="file-button">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) =>
                e.target.files?.[0] && void importCsv(e.target.files[0])
              }
            />
            {busy ? "מעבד..." : "בחירת קובץ"}
          </label>
        </article>
        <article className="tool-card">
          <HardDriveDownload />
          <div>
            <h3>גיבוי מלא</h3>
            <p>הורדת כל התורמים, התרומות, הסקירות, המשימות וההגדרות.</p>
          </div>
          <Button variant="outline" asChild>
            <a href="/api/export" download>
              הורדת גיבוי
            </a>
          </Button>
        </article>
      </section>
      <div className="advanced-grid">
        {groups.map((g) => (
          <article key={g.title} className="advanced-card">
            <span>
              <g.icon />
            </span>
            <div>
              <h3>{g.title}</h3>
              <p>{g.desc}</p>
              <small>{g.state}</small>
            </div>
            <ChevronLeft />
          </article>
        ))}
      </div>
    </div>
  );
}
function LaunchGeneral() {
  const [notice, setNotice] = useState("");
  async function save() {
    const payload = {
      organization_name: field("org-name"),
      manager_name: field("manager-name"),
      default_delivery: field("default-delivery"),
      default_currency: field("default-currency"),
      system_timezone: field("system-timezone"),
      dual_calendar: "true",
      phone_country: "IL",
      language: "he",
      direction: "rtl",
    };
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setNotice(r.ok ? "ההגדרות הכלליות נשמרו" : "לא ניתן לשמור את ההגדרות");
  }
  return (
    <div className="launch-settings">
      {notice && (
        <div className="save-notice">
          <Check />
          {notice}
        </div>
      )}
      <section className="config-panel">
        <div className="panel-head">
          <div>
            <h2>פרטי בית חב״ד</h2>
            <p>הגדרות בסיס המשמשות בכל חלקי המערכת</p>
          </div>
          <Button onClick={save}>שמירת שינויים</Button>
        </div>
        <div className="config-grid general">
          <label>
            <span>שם המוסד</span>
            <input id="org-name" defaultValue="בית חב״ד לב העיר בית שמש" />
          </label>
          <label>
            <span>מנהל המערכת</span>
            <input id="manager-name" defaultValue="שניאור זלמן" />
          </label>
          <label>
            <span>דרך משלוח ברירת מחדל</span>
            <select id="default-delivery">
              <option>WhatsApp</option>
              <option>דוא״ל</option>
              <option>דואר</option>
              <option>לא לשלוח</option>
            </select>
          </label>
          <label>
            <span>מטבע ברירת מחדל</span>
            <select id="default-currency">
              <option value="ILS">שקל חדש (₪)</option>
              <option value="USD">דולר ($)</option>
              <option value="EUR">אירו (€)</option>
            </select>
          </label>
          <label>
            <span>אזור זמן</span>
            <select id="system-timezone">
              <option value="Asia/Jerusalem">ישראל · ירושלים</option>
            </select>
          </label>
          <label>
            <span>תצוגת תאריכים</span>
            <select disabled>
              <option>עברי ולועזי מסונכרנים</option>
            </select>
          </label>
          <label>
            <span>מדינת ברירת מחדל לטלפונים</span>
            <select disabled>
              <option>ישראל (+972)</option>
            </select>
          </label>
          <label>
            <span>שפת המערכת</span>
            <select disabled>
              <option>עברית · RTL</option>
            </select>
          </label>
        </div>
      </section>
      <div className="policy-grid">
        <article>
          <Shield />
          <div>
            <h3>גישה מאובטחת</h3>
            <p>האתר מוגבל למשתמשים שאושרו ברמת סביבת העבודה.</p>
          </div>
        </article>
        <article>
          <RefreshCw />
          <div>
            <h3>שמירה רציפה</h3>
            <p>נתוני הליבה נשמרים במסד נתונים ונגישים מכל מכשיר מורשה.</p>
          </div>
        </article>
        <article>
          <CalendarDays />
          <div>
            <h3>לוחות שנה מסונכרנים</h3>
            <p>כל תאריך נשמר פעם אחת ומוצג בעברית ובלועזית.</p>
          </div>
        </article>
      </div>
    </div>
  );
}
function ExpensesView() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  async function save() {
    try {
      await saveRecord("/api/donations", {
        donorName: field("expense-payee"),
        amount: field("expense-amount"),
        date: field("expense-date"),
        paymentMethod: field("expense-method"),
        purpose: field("expense-purpose"),
        movementType: "expense",
      });
      setOpen(false);
      setNotice("ההוצאה נשמרה בהצלחה");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "שגיאה בשמירה");
    }
  }
  return (
    <>
      {notice && (
        <div className="save-notice">
          <Check />
          {notice}
        </div>
      )}
      <div className="summary-strip">
        <div>
          <small>הוצאות החודש</small>
          <b>₪0</b>
        </div>
        <div>
          <small>ממתינות לסיווג</small>
          <b>0</b>
        </div>
        <div>
          <small>תזרים נטו</small>
          <b>מחושב מהתנועות</b>
        </div>
      </div>
      <section className="panel">
        <Toolbar
          placeholder="חיפוש הוצאה או ספק"
          action="הוצאה חדשה"
          onAction={() => setOpen(true)}
        />
        <div className="database-empty">
          <CreditCard />
          <h3>עדיין אין הוצאות שמורות</h3>
          <p>הוצאות ידניות או תנועות מ־Webhook יופיעו כאן.</p>
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>הזנת הוצאה ידנית</DialogTitle>
            <DialogDescription>
              ההוצאה תישמר כתנועה נפרדת ולא תשויך לכרטיס תורם.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              <span>מוטב / ספק</span>
              <input id="expense-payee" placeholder="שם הספק" />
            </label>
            <label>
              <span>סכום</span>
              <input
                id="expense-amount"
                inputMode="decimal"
                placeholder="₪ 0"
              />
            </label>
            <DualDateField id="expense-date" />
            <label>
              <span>אמצעי תשלום</span>
              <select id="expense-method">
                <option>העברה בנקאית</option>
                <option>אשראי</option>
                <option>מזומן</option>
                <option>הוראת קבע</option>
              </select>
            </label>
            <label>
              <span>קטגוריה</span>
              <input
                id="expense-purpose"
                placeholder="לדוגמה: פעילות, שכירות, ציוד"
              />
            </label>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={save}>שמירת הוצאה</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function ViewContent({ view }: { view: View }) {
  if (view === "advanced") return <SettingsHub initial="finance" />;
  if (view === "donors") return <DonorCenter />;
  if (view === "donations" || view === "expenses" || view === "movements")
    return <MovementCenter />;
  if (view === "retention") return <RetentionCenter />;
  if (view === "duplicates") return <DuplicateCenter />;
  if (view === "reviews") return <ReviewCenter />;
  if (view === "attention") return <AttentionCenter />;
  return <SettingsHub />;
}
export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [search, setSearch] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      requested = params.get("view") as View | null;
    if (requested && titles[requested]) setView(requested);
    if (requested === "movements" && params.get("new") === "1")
      window.setTimeout(
        () => window.dispatchEvent(new Event("open-movement-dialog")),
        120,
      );
  }, []);
  const navigateTo = (nextView: View) => {
    setView(nextView);
    const url = new URL(window.location.href);
    if (nextView === "dashboard") {
      url.search = "";
      url.hash = "";
    } else {
      url.searchParams.set("view", nextView);
      url.searchParams.delete("bank");
      url.searchParams.delete("transaction");
    }
    window.history.replaceState({}, "", url);
  };
  const openMovement = () => {
    navigateTo("movements");
    window.setTimeout(
      () => window.dispatchEvent(new Event("open-movement-dialog")),
      60,
    );
  };
  return (
    <SidebarProvider>
      <AppNav view={view} setView={navigateTo} />
      <SidebarInset className="app-main">
        <header className="topbar">
          <div className="title">
            <SidebarTrigger
              className="mobile-menu"
              aria-label="פתיחה או צמצום של תפריט הניווט"
            />
            <div>
              <h1>{titles[view][0]}</h1>
              <p>{titles[view][1]}</p>
            </div>
          </div>
          <div className="actions">
            <button onClick={() => setSearch(!search)} aria-label="חיפוש">
              <Search />
            </button>
          </div>
        </header>
        {search && (
          <div className="global-search">
            <Search />
            <input autoFocus placeholder="חיפוש בכל המערכת..." />
            <button onClick={() => setSearch(false)}>
              <X />
            </button>
          </div>
        )}
        <main className="content">
          {view === "dashboard" ? (
            <DashboardCenter setView={navigateTo} />
          ) : (
            <ViewContent view={view} />
          )}
        </main>
      </SidebarInset>
      <QuickActions onMovement={openMovement} />
    </SidebarProvider>
  );
}
