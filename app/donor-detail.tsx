"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  AlertTriangle,
  CalendarHeart,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Edit3,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ReceiptText,
  Repeat2,
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
import type { EditableDonor } from "./donor-form-dialog";
import { formatCivilDate, formatHebrewDate } from "./hebrew-date";
import {
  getCachedDonorSummary,
  invalidateDonorSummary,
  prefetchDonorSummary,
} from "./donor-detail-cache";

const DonorFormDialog = dynamic(() => import("./donor-form-dialog"));
const MovementDialog = dynamic(() => import("./movement-dialog"));
const AddOrLinkPerson = dynamic(() => import("./add-or-link-person"));
const TransactionDetail = dynamic(() => import("./transaction-detail"));
const DonorRelationshipPanel = dynamic(() => import("./donor-relationship-panel"));

type SpecialDate = {
  id: number;
  kind: string;
  customName: string;
  hebrewDay: number;
  hebrewMonth: string;
  hebrewYear: number | null;
};
type Person = {
  id: number;
  fullName: string;
  greetingName: string;
  alternativeNames: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  postalAddress: string;
  idNumber: string;
  preferredMethod: string;
  notes: string;
  specialDates: SpecialDate[];
};
type Gift = {
  id: number;
  donorId: number | null;
  personId: number | null;
  donorName: string;
  amount: number;
  currency: string;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
  purpose: string;
  reason: string;
  movementType: string;
  department: string;
  subcategory: string;
  source: string;
  feeAmount: number;
  netAmount: number;
  externalId: string | null;
  matchStatus: string;
  rawPayload: string;
};
type Engagement = {
  id: number;
  personId: number | null;
  kind: string;
  summary: string;
  occurredAt: string;
  outcome: string;
  followUpDate: string | null;
};
type Donor = EditableDonor & {
  cardNameMode?: "AUTO" | "MANUAL";
  type: string;
  status: string;
  recurringStatus: string;
  recurringAmount: number;
  createdAt: string;
};
type Stats = {
  total: number;
  yearTotal: number;
  count: number;
  average: number;
  lastDate: string | null;
};
type RecurringCommitment = {
  id: number;
  amount: number;
  currency: string;
  paymentMethod: string;
  startDate: string;
  endDate: string | null;
  expectedDay: number;
  status: string;
  updatedAt: string;
};
type PaymentDecline = {
  id: number;
  amount: number;
  currency: string;
  message: string;
  declineSource: string;
  occurredAt: string;
  handled: boolean;
};
type Summary = {
  donor: Donor;
  people: Person[];
  stats: Stats;
  trend: Array<{ month: string; amount: number; count: number }>;
  recurring: RecurringCommitment[];
  declines: PaymentDecline[];
};
type Tab = "overview" | "donations" | "engagements";
const money = (value: number, currency = "ILS") =>
  Number(value || 0).toLocaleString("he-IL", { style: "currency", currency });
const civil = formatCivilDate;
const dayLetter = (value: number) =>
  [
    "",
    "א׳",
    "ב׳",
    "ג׳",
    "ד׳",
    "ה׳",
    "ו׳",
    "ז׳",
    "ח׳",
    "ט׳",
    "י׳",
    "י״א",
    "י״ב",
    "י״ג",
    "י״ד",
    "ט״ו",
    "ט״ז",
    "י״ז",
    "י״ח",
    "י״ט",
    "כ׳",
    "כ״א",
    "כ״ב",
    "כ״ג",
    "כ״ד",
    "כ״ה",
    "כ״ו",
    "כ״ז",
    "כ״ח",
    "כ״ט",
    "ל׳",
  ][value] || String(value);

function Info({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value?: string;
  href?: string;
}) {
  if (!value) return null;
  const content = (
    <>
      <small>{label}</small>
      <b>{value}</b>
    </>
  );
  return (
    <div className="donor-info">
      <Icon />
      <span>{href ? <a href={href}>{content}</a> : content}</span>
    </div>
  );
}
function PersonCard({
  person,
  compact = false,
}: {
  person: Person;
  compact?: boolean;
}) {
  return (
    <article className={`person-card ${compact ? "compact" : ""}`}>
      <div className="person-card-head">
        <span>{person.fullName.slice(0, 1)}</span>
        <div>
          <h3>{person.fullName}</h3>
          {person.greetingName && <p>לפנייה: {person.greetingName}</p>}
        </div>
      </div>
      <div className="person-info-grid">
        <Info
          icon={Phone}
          label="טלפון ראשי"
          value={person.phone}
          href={person.phone ? `tel:${person.phone}` : undefined}
        />
        <Info
          icon={Mail}
          label="דוא״ל"
          value={person.email}
          href={person.email ? `mailto:${person.email}` : undefined}
        />
        <Info
          icon={MessageCircle}
          label="דרך קשר / משלוח"
          value={person.preferredMethod}
        />
        <Info
          icon={Phone}
          label="טלפון נוסף"
          value={person.secondaryPhone}
          href={
            person.secondaryPhone ? `tel:${person.secondaryPhone}` : undefined
          }
        />
      </div>
      {!compact && (
        <>
          {person.postalAddress && (
            <Info icon={MapPin} label="כתובת" value={person.postalAddress} />
          )}{" "}
          {person.alternativeNames && (
            <p className="person-note">
              <b>שמות נוספים:</b> {person.alternativeNames}
            </p>
          )}
          {person.notes && <p className="person-note">{person.notes}</p>}
        </>
      )}
      {person.specialDates?.length > 0 && (
        <div className="special-date-chips">
          {person.specialDates.map((date) => (
            <span key={date.id}>
              <CalendarHeart />
              {date.customName || date.kind}: {dayLetter(date.hebrewDay)} ב
              {date.hebrewMonth}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export default function DonorDetail({ donorCardId }: { donorCardId: number }) {
  const cached = getCachedDonorSummary<Summary>(donorCardId),
    [data, setData] = useState<Summary | null>(cached),
    [error, setError] = useState(""),
    [tab, setTab] = useState<Tab>("overview"),
    [donations, setDonations] = useState<Gift[] | null>(null),
    [engagements, setEngagements] = useState<Engagement[] | null>(null),
    [editOpen, setEditOpen] = useState(false),
    [donationOpen, setDonationOpen] = useState(false),
    [engagementOpen, setEngagementOpen] = useState(false),
    [personOpen, setPersonOpen] = useState(false),
    [recurringOpen, setRecurringOpen] = useState(false),
    [selectedGift, setSelectedGift] = useState<Gift | null>(null),
    [notice, setNotice] = useState("");
  const loadSummary = useCallback(
    async (force = false) => {
      try {
        if (force) invalidateDonorSummary(donorCardId);
        setData(await prefetchDonorSummary<Summary>(donorCardId, force));
      } catch (e) {
        setError(e instanceof Error ? e.message : "לא ניתן לטעון את הכרטיס");
      }
    },
    [donorCardId],
  );
  const loadDonations = useCallback(async () => {
    const r = await fetch(`/api/donors/${donorCardId}?section=donations`),
      j = await r.json();
    if (r.ok) setDonations(j.donations || []);
  }, [donorCardId]);
  const loadEngagements = useCallback(async () => {
    const r = await fetch(`/api/donors/${donorCardId}?section=engagements`),
      j = await r.json();
    if (r.ok) setEngagements(j.engagements || []);
  }, [donorCardId]);
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    if (tab === "donations" && !donations) void loadDonations();
    if (tab === "engagements" && !engagements) void loadEngagements();
  }, [tab, donations, engagements, loadDonations, loadEngagements]);
  const personNames = useMemo(
    () => new Map((data?.people || []).map((p) => [p.id, p.fullName])),
    [data?.people],
  );
  if (error)
    return (
      <main className="donor-detail-shell">
        <div className="detail-empty">
          <UsersRound />
          <h1>הכרטיס לא זמין</h1>
          <p>{error}</p>
          <Button asChild>
            <a href="/?view=donors">חזרה למאגר</a>
          </Button>
        </div>
      </main>
    );
  if (!data) return <DonorDetailSkeleton />;
  const { donor, people, stats, trend, recurring = [], declines = [] } = data,
    legacy: Person = {
      id: 0,
      fullName: donor.name,
      greetingName: donor.alias,
      alternativeNames: donor.alias,
      phone: donor.phone,
      secondaryPhone: donor.secondaryPhone,
      email: donor.email,
      postalAddress: donor.address,
      idNumber: donor.idNumber,
      preferredMethod: donor.preferredMethod,
      notes: donor.notes,
      specialDates: (donor.specialDates || []) as SpecialDate[],
    },
    shownPeople = people.length ? people : [legacy],
    activeRecurring = recurring.filter((item) => item.status === "active"),
    lastStoppedRecurring = recurring.find((item) => item.status !== "active"),
    hasActiveRecurring = activeRecurring.length > 0 || donor.recurringStatus === "ACTIVE",
    openDeclines = declines.filter((item) => !item.handled);
  const closeDetail = () => {
    const fallback =
      new URLSearchParams(window.location.search).get("return") ||
      "/?view=donors";
    if (document.referrer && window.history.length > 1) window.history.back();
    else window.location.href = fallback;
  };
  const refreshAfterDonation = async () => {
    setNotice("התרומה נשמרה בכרטיס");
    setDonations(null);
    await Promise.all([loadSummary(true), loadDonations()]);
  };
  return (
    <main className="donor-detail-shell" dir="rtl">
      {notice && (
        <div className="save-notice">
          <Check />
          {notice}
        </div>
      )}
      <div className="donor-detail-topbar">
        <button onClick={closeDetail}>
          <ArrowRight />
          חזרה למסך הקודם
        </button>
        <span>כרטיס תורם #{donor.id}</span>
      </div>
      <header className="donor-detail-header">
        <div className="donor-title">
          <div className="donor-avatar">
            <HeartHandshake />
          </div>
          <div>
            <div className="donor-statuses">
              <span>{donor.status || "פעיל"}</span>
              <span
                className={
                  hasActiveRecurring
                    ? "active"
                    : "muted"
                }
              >
                {hasActiveRecurring
                  ? "הוראת קבע פעילה"
                  : "ללא הוראת קבע"}
              </span>
            </div>
            <h1>{donor.name}</h1>
            <p>
              {donor.type || "כרטיס תורם"}
              {people.length ? ` · ${people.length} אנשים משויכים` : ""}
            </p>
          </div>
        </div>
        <div className="donor-header-metrics">
          <div>
            <small>סך התרומות</small>
            <b>{money(stats.total)}</b>
          </div>
          <div>
            <small>תרומה אחרונה</small>
            <b>
              {stats.lastDate ? formatHebrewDate(stats.lastDate) : "אין עדיין"}
            </b>
            {stats.lastDate && <em>{civil(stats.lastDate)}</em>}
          </div>
        </div>
        <div className="donor-quick-actions">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit3 />
            עריכת פרטים
          </Button>
          <Button variant="outline" onClick={() => setDonationOpen(true)}>
            <CircleDollarSign />
            הוספת תרומה
          </Button>
          <Button onClick={() => setEngagementOpen(true)}>
            <Phone />
            תיעוד שיחה / פעולה
          </Button>
        </div>
      </header>
      <nav className="donor-detail-tabs" aria-label="אזורים בכרטיס">
        {(
          [
            { id: "overview", label: "סקירה" },
            { id: "donations", label: "תרומות" },
            { id: "engagements", label: "קשר ושיחות" },
          ] as { id: Tab; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "donations" && <span>{stats.count}</span>}
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <div className="donor-overview">
          <section className="detail-card people-section">
            <div className="detail-card-title">
              <div>
                <h2>האנשים בכרטיס</h2>
                <p>
                  {people.length
                    ? "המידע האישי נשמר בנפרד; התרומות נשארות משותפות"
                    : "פרטי האדם המרכזיים"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPersonOpen(true)}
              >
                <UserPlus />
                הוספת / קישור אדם
              </Button>
            </div>
            <div
              className={`people-grid ${shownPeople.length === 1 ? "single" : ""}`}
            >
              {shownPeople.map((person) => (
                <PersonCard key={person.id} person={person} compact />
              ))}
            </div>
          </section>
          <div className="overview-side">
            {(activeRecurring.length > 0 || lastStoppedRecurring) && (
              <section className={`detail-card recurring-status-card ${activeRecurring.length ? "is-active" : "is-ended"}`}>
                <div className="recurring-status-head">
                  <span><Repeat2 /></span>
                  <div>
                    <small>הוראות קבע</small>
                    <h2>{activeRecurring.length ? "הוראת קבע פעילה" : "הוראת הקבע הופסקה"}</h2>
                  </div>
                </div>
                {activeRecurring.map((item) => (
                  <div className="recurring-status-line" key={item.id}>
                    <b>{money(item.amount, item.currency || "ILS")} לחודש</b>
                    <span>חיוב צפוי ביום {item.expectedDay} · התחלה {civil(item.startDate)}</span>
                  </div>
                ))}
                {!activeRecurring.length && lastStoppedRecurring && (
                  <div className="recurring-status-line">
                    <b>{money(lastStoppedRecurring.amount, lastStoppedRecurring.currency || "ILS")} לחודש</b>
                    <span>
                      הופסקה בתאריך {civil(lastStoppedRecurring.endDate || lastStoppedRecurring.updatedAt)}
                    </span>
                  </div>
                )}
                <button className="detail-text-action" onClick={() => setRecurringOpen(true)}>
                  {activeRecurring.length ? "ניהול הוראת הקבע" : "הקמת הוראת קבע חדשה"}
                </button>
              </section>
            )}
            {declines.length > 0 && (
              <section className={`detail-card donor-declines-card ${openDeclines.length ? "has-open" : "all-handled"}`}>
                <div className="donor-declines-head">
                  <span><AlertTriangle /></span>
                  <div>
                    <small>סירובי עסקאות</small>
                    <h2>{openDeclines.length ? `${openDeclines.length} סירובים דורשים טיפול` : "כל הסירובים טופלו"}</h2>
                  </div>
                </div>
                <div className="donor-declines-list">
                  {declines.slice(0, 3).map((item) => (
                    <article key={item.id}>
                      <div>
                        <b>{money(item.amount, item.currency || "ILS")}</b>
                        <span className={item.handled ? "handled" : "open"}>{item.handled ? "טופל" : "דורש טיפול"}</span>
                      </div>
                      <p>{item.message || "העסקה נדחתה"}</p>
                      <small>{civil(item.occurredAt)} · {item.declineSource === "Keva" ? "חיוב הוראת קבע" : "עסקה"}</small>
                    </article>
                  ))}
                </div>
                <a className="detail-text-action" href="/?view=attention">לכל הסירובים והטיפול בהם</a>
              </section>
            )}
            <section className="detail-card">
              <div className="detail-card-title">
                <div>
                  <h2>תמונת תרומות</h2>
                  <p>הנתונים שייכים לכרטיס המשותף</p>
                </div>
                <ReceiptText />
              </div>
              <div className="overview-stat-list">
                <div>
                  <span>ב־12 החודשים האחרונים</span>
                  <b>{money(stats.yearTotal)}</b>
                </div>
                <div>
                  <span>מספר תרומות</span>
                  <b>{stats.count}</b>
                </div>
                <div>
                  <span>ממוצע חד־פעמי</span>
                  <b>{money(stats.average)}</b>
                </div>
                <div>
                  <span>הוראת קבע נוכחית</span>
                  <b>
                    {activeRecurring.length
                      ? activeRecurring.map((item) => money(item.amount, item.currency || "ILS")).join(" + ")
                      : donor.recurringAmount
                        ? money(donor.recurringAmount)
                      : "אין"}
                  </b>
                </div>
              </div>
              <button
                className="detail-text-action"
                onClick={() => setTab("donations")}
              >
                לכל התרומות
              </button>
              <button className="detail-text-action" onClick={() => setRecurringOpen(true)}>
                {donor.recurringAmount ? "ניהול הוראת קבע" : "הוספת הוראת קבע"}
              </button>
            </section>
            <section className="detail-card trend-card">
              <div className="detail-card-title">
                <div>
                  <h2>מגמת תרומות</h2>
                  <p>12 החודשים האחרונים</p>
                </div>
                <ReceiptText />
              </div>
              <DonationTrend rows={trend} />
            </section>
          </div>
          <DonorRelationshipPanel donorCardId={donor.id}/>
          <details className="detail-card more-info">
            <summary>
              <span>
                <h2>מידע נוסף</h2>
                <small>כתובת, הערות ותאריכים מיוחדים</small>
              </span>
              <ChevronDown />
            </summary>
            <div className="more-info-content">
              <div className="card-details-grid">
                <Info icon={UsersRound} label="שם הכרטיס" value={donor.name} />
                <Info
                  icon={MessageCircle}
                  label="סוג כרטיס"
                  value={donor.type}
                />
                <Info
                  icon={Phone}
                  label="טלפון מרכזי"
                  value={donor.phone}
                  href={donor.phone ? `tel:${donor.phone}` : undefined}
                />
                <Info
                  icon={Mail}
                  label="דוא״ל מרכזי"
                  value={donor.email}
                  href={donor.email ? `mailto:${donor.email}` : undefined}
                />
                <Info icon={MapPin} label="כתובת" value={donor.address} />
                <Info
                  icon={MessageCircle}
                  label="דרך משלוח"
                  value={donor.preferredMethod}
                />
              </div>
              {donor.notes && (
                <div className="donor-notes">
                  <b>הערות</b>
                  <p>{donor.notes}</p>
                </div>
              )}
              {donor.specialDates?.length ? (
                <div className="special-date-list">
                  {donor.specialDates.map((date) => (
                    <div
                      key={`${date.kind}-${date.customName}-${date.hebrewDay}-${date.hebrewMonth}`}
                    >
                      <CalendarHeart />
                      <span>
                        <b>{date.customName || date.kind}</b>
                        <small>
                          {dayLetter(Number(date.hebrewDay))} ב
                          {date.hebrewMonth}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        </div>
      )}
      {tab === "donations" && (
        <section className="detail-card detail-section">
          <div className="donation-summary-row">
            <div>
              <small>סך הכול</small>
              <b>{money(stats.total)}</b>
            </div>
            <div>
              <small>12 חודשים</small>
              <b>{money(stats.yearTotal)}</b>
            </div>
            <div>
              <small>מספר תרומות</small>
              <b>{stats.count}</b>
            </div>
            <div>
              <small>ממוצע חד־פעמי</small>
              <b>{money(stats.average)}</b>
            </div>
          </div>
          {donations === null ? (
            <TabSkeleton />
          ) : donations.length ? (
            <div className="donation-history">
              {donations.map((gift) => (
                <article
                  key={gift.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedGift(gift)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      setSelectedGift(gift);
                  }}
                >
                  <div className="gift-date">
                    <CalendarHeart />
                    <span>
                      <b>{formatHebrewDate(gift.date)}</b>
                      <small>{civil(gift.date)}</small>
                    </span>
                  </div>
                  <div>
                    <small>סכום</small>
                    <b>{money(gift.amount, gift.currency || "ILS")}</b>
                    <em>
                      {gift.personId
                        ? personNames.get(gift.personId) || "אדם משויך"
                        : "הכרטיס המשותף"}
                    </em>
                  </div>
                  <div>
                    <small>אמצעי תשלום</small>
                    <b>{gift.paymentMethod}</b>
                  </div>
                  <div>
                    <small>סוג</small>
                    <b>{gift.isRecurring ? "הוראת קבע" : "חד־פעמית"}</b>
                  </div>
                  <div>
                    <small>ייעוד</small>
                    <b>
                      {gift.subcategory ||
                        gift.purpose ||
                        gift.department ||
                        "—"}
                    </b>
                  </div>
                  <div>
                    <small>מקור</small>
                    <b>{gift.source === "manual" ? "ידני" : gift.source}</b>
                    <em>לחץ לצפייה בפרטי התרומה</em>
                  </div>
                  {gift.reason && <p>{gift.reason}</p>}
                </article>
              ))}
            </div>
          ) : (
            <div className="detail-empty compact">
              <ReceiptText />
              <h3>עדיין אין תרומות בכרטיס</h3>
              <Button onClick={() => setDonationOpen(true)}>
                הוספת תרומה ראשונה
              </Button>
            </div>
          )}
        </section>
      )}
      {tab === "engagements" && (
        <section className="detail-card detail-section">
          <div className="detail-card-title">
            <div>
              <h2>היסטוריית קשר</h2>
              <p>מהחדש לישן, כולל המשך טיפול</p>
            </div>
            <Button onClick={() => setEngagementOpen(true)}>
              <Plus />
              תיעוד שיחה / פעולה
            </Button>
          </div>
          {engagements === null ? (
            <TabSkeleton />
          ) : engagements.length ? (
            <div className="engagement-timeline">
              {engagements.map((item) => (
                <article key={item.id}>
                  <span className="timeline-dot" />
                  <div className="timeline-head">
                    <div>
                      <b>{item.kind}</b>
                      <em>
                        {item.personId
                          ? personNames.get(item.personId)
                          : "הכרטיס המשותף"}
                      </em>
                    </div>
                    <time>{civil(item.occurredAt)}</time>
                  </div>
                  <p>{item.summary}</p>
                  {item.outcome && <small>תוצאה: {item.outcome}</small>}
                  {item.followUpDate && (
                    <div className="follow-up">
                      <Clock3 />
                      פעולה הבאה: {formatHebrewDate(item.followUpDate)} ·{" "}
                      {civil(item.followUpDate)}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="contact-empty large">
              <MessageCircle />
              <p>עדיין לא תועד קשר עם התורם</p>
              <button onClick={() => setEngagementOpen(true)}>
                תיעוד שיחה / פעולה ראשונה
              </button>
            </div>
          )}
        </section>
      )}
      {editOpen && <DonorFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        donor={donor}
        onSaved={async () => {
          setNotice("פרטי הכרטיס עודכנו");
          await loadSummary(true);
        }}
      />}
      {donationOpen && <MovementDialog
        open={donationOpen}
        onOpenChange={setDonationOpen}
        presetDonor={{ id: donor.id, name: donor.name }}
        people={people}
        onSaved={refreshAfterDonation}
      />}
      <EngagementDialog
        open={engagementOpen}
        onOpenChange={setEngagementOpen}
        donorId={donor.id}
        people={people}
        onSaved={async () => {
          setNotice("הפעולה נוספה להיסטוריה");
          setEngagements(null);
          await Promise.all([loadSummary(true), loadEngagements()]);
        }}
      />
      {personOpen && <AddOrLinkPerson
        open={personOpen}
        onOpenChange={setPersonOpen}
        donorCardId={donor.id}
        onSaved={async () => {
          setNotice("האדם קושר לכרטיס");
          await loadSummary(true);
        }}
      />}
      <RecurringDialog open={recurringOpen} onOpenChange={setRecurringOpen} donorId={donor.id} people={people} onSaved={async()=>{setNotice("הוראת הקבע נשמרה");await loadSummary(true)}}/>
      {selectedGift && <TransactionDetail
        transaction={selectedGift}
        personName={
          selectedGift?.personId
            ? personNames.get(selectedGift.personId)
            : "הכרטיס המשותף"
        }
        onOpenChange={(value) => {
          if (!value) setSelectedGift(null);
        }}
      />}
    </main>
  );
}

function RecurringDialog({open,onOpenChange,donorId,people,onSaved}:{open:boolean;onOpenChange:(value:boolean)=>void;donorId:number;people:Person[];onSaved:()=>void}) {
  const today=new Date().toISOString().slice(0,10);
  const [form,setForm]=useState({amount:"",paymentMethod:"הוראת קבע",startDate:today,durationMonths:"",expectedDay:String(new Date().getDate()),personId:""}),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function save(){setBusy(true);setError("");const response=await fetch("/api/recurring",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,donorCardId:donorId})}),result=await response.json();setBusy(false);if(!response.ok){setError(result.error||"לא ניתן לשמור");return}onOpenChange(false);onSaved()}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="engagement-dialog"><DialogHeader className="text-right"><DialogTitle>הוראת קבע / שותפות חודשית</DialogTitle></DialogHeader><div className="detail-form-grid"><label><span>סכום *</span><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))}/></label><label><span>אמצעי תשלום</span><select value={form.paymentMethod} onChange={e=>setForm(v=>({...v,paymentMethod:e.target.value}))}>{["הוראת קבע","אשראי","העברה בנקאית","Bit","מזומן","צ׳ק"].map(value=><option key={value}>{value}</option>)}</select></label><label><span>תאריך התחלה *</span><input type="date" value={form.startDate} onChange={e=>setForm(v=>({...v,startDate:e.target.value}))}/></label><label><span>מספר חודשים</span><input type="number" min="1" placeholder="ללא הגבלה" value={form.durationMonths} onChange={e=>setForm(v=>({...v,durationMonths:e.target.value}))}/></label><label><span>יום צפוי בחודש *</span><input type="number" min="1" max="31" value={form.expectedDay} onChange={e=>setForm(v=>({...v,expectedDay:e.target.value}))}/></label>{people.length>1&&<label><span>משויך לאדם</span><select value={form.personId} onChange={e=>setForm(v=>({...v,personId:e.target.value}))}><option value="">הכרטיס המשותף</option>{people.map(person=><option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>}</div>{error&&<p className="form-error">{error}</p>}<div className="dialog-actions"><Button variant="outline" onClick={()=>onOpenChange(false)}>ביטול</Button><Button disabled={busy} onClick={()=>void save()}><Repeat2/>{busy?"שומר...":"שמירת הוראת קבע"}</Button></div></DialogContent></Dialog>
}

function DonationTrend({
  rows,
}: {
  rows: Array<{ month: string; amount: number; count: number }>;
}) {
  const months = useMemo(() => {
    const map = new Map(rows.map((row) => [row.month, row]));
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        row = map.get(key);
      return {
        key,
        label: new Intl.DateTimeFormat("he-IL", { month: "short" }).format(d),
        amount: Number(row?.amount || 0),
        count: Number(row?.count || 0),
        current: i === 11,
      };
    });
  }, [rows]);
  const max = Math.max(1, ...months.map((m) => m.amount));
  return (
    <div className="donation-trend-scroll">
      <div
        className="donation-trend"
        role="img"
        aria-label="גרף מגמת תרומות ב־12 החודשים האחרונים"
      >
        {months.map((month) => (
          <div
            className={`trend-column ${month.current ? "current" : ""}`}
            key={month.key}
            tabIndex={0}
          >
            <div className="trend-tooltip">
              <b>{month.label}</b>
              <span>{money(month.amount)}</span>
              <small>{month.count} תרומות</small>
            </div>
            <div className="trend-bar-wrap">
              <i
                style={{
                  height: `${Math.max(month.amount ? 8 : 2, (month.amount / max) * 100)}%`,
                }}
              />
            </div>
            <span>{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function DonorDetailSkeleton() {
  return (
    <main className="donor-detail-shell donor-skeleton" dir="rtl">
      <i className="skeleton-line short" />
      <section className="skeleton-header">
        <i />
        <div>
          <i />
          <i />
        </div>
      </section>
      <div className="skeleton-tabs">
        <i />
        <i />
        <i />
      </div>
      <div className="skeleton-body">
        <i />
        <i />
        <i />
      </div>
    </main>
  );
}
function TabSkeleton() {
  return (
    <div className="tab-skeleton">
      {[1, 2, 3, 4].map((i) => (
        <i key={i} />
      ))}
    </div>
  );
}
function EngagementDialog({
  open,
  onOpenChange,
  donorId,
  people,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  donorId: number;
  people: Person[];
  onSaved: () => void;
}) {
  const initial = {
    kind: "שיחת טלפון",
    personId: "",
    summary: "",
    outcome: "",
    occurredAt: new Date().toISOString().slice(0, 16),
    followUpDate: "",
  };
  const [form, setForm] = useState(initial),
    [error, setError] = useState("");
  const save = async () => {
    const r = await fetch(`/api/donors/${donorId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      }),
      j = await r.json();
    if (!r.ok) {
      setError(j.error || "לא ניתן לשמור");
      return;
    }
    setForm(initial);
    onOpenChange(false);
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="engagement-dialog">
        <DialogHeader className="text-right">
          <DialogTitle>תיעוד שיחה / פעולה</DialogTitle>
        </DialogHeader>
        <div className="detail-form-grid">
          <label>
            <span>סוג הפעולה</span>
            <select
              value={form.kind}
              onChange={(e) => setForm((v) => ({ ...v, kind: e.target.value }))}
            >
              {["שיחת טלפון", "WhatsApp", "פגישה", "דוא״ל", "הערה כללית"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            <span>שיחה עם</span>
            <select
              value={form.personId}
              onChange={(e) =>
                setForm((v) => ({ ...v, personId: e.target.value }))
              }
            >
              <option value="">הכרטיס המשותף</option>
              {people.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>תאריך ושעה</span>
            <input
              type="datetime-local"
              value={form.occurredAt}
              onChange={(e) =>
                setForm((v) => ({ ...v, occurredAt: e.target.value }))
              }
            />
          </label>
          <label>
            <span>תוצאה / סטטוס</span>
            <input
              value={form.outcome}
              onChange={(e) =>
                setForm((v) => ({ ...v, outcome: e.target.value }))
              }
            />
          </label>
          <label className="wide">
            <span>סיכום קצר *</span>
            <textarea
              rows={4}
              value={form.summary}
              onChange={(e) =>
                setForm((v) => ({ ...v, summary: e.target.value }))
              }
            />
          </label>
          <label>
            <span>פעולה הבאה</span>
            <input
              type="date"
              value={form.followUpDate}
              onChange={(e) =>
                setForm((v) => ({ ...v, followUpDate: e.target.value }))
              }
            />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={() => void save()}>שמירת הפעולה</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
