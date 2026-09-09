"use client";

import Link from "next/link";
import { BellRing, CalendarDays, RefreshCw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { formatHebrewDate } from "./hebrew-date";

type UpdateRow = {
  commitment: {
    id: number;
    donorCardId: number;
    amount: number;
    currency: string;
    paymentMethod: string;
    startDate: string;
    durationMonths: number | null;
    expectedDay: number;
    endDate: string | null;
    status: string;
    source: string;
    externalId: string | null;
    createdAt: string;
  };
  cardName: string | null;
  personName: string | null;
};

const money = (amount: number, currency: string) => {
  const safeCurrency = /^[A-Z]{3}$/.test(currency || "") ? currency : "ILS";
  return Number(amount || 0).toLocaleString("he-IL", { style: "currency", currency: safeCurrency });
};

export default function UpdatesCenter() {
  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/recurring", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "לא ניתן לטעון את העדכונים");
        if (active) setRows(result.recurring || []);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "לא ניתן לטעון את העדכונים"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="updates-center">
      <section className="updates-intro">
        <span><BellRing /></span>
        <div><h2>עדכונים מהמערכות המחוברות</h2><p>אירועים שאינם תנועה כספית בפועל נשמרים כאן בנפרד.</p></div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div><h2>הקמות הוראות קבע</h2><p>{loading ? "טוען עדכונים..." : `${rows.length} הוראות קבע שנקלטו`}</p></div>
          <RefreshCw />
        </div>
        {error ? (
          <div className="database-empty"><BellRing /><h3>לא ניתן לטעון כרגע</h3><p>{error}</p></div>
        ) : loading ? (
          <div className="donor-list-skeleton"><i /><i /><i /></div>
        ) : rows.length ? (
          <div className="updates-list">
            {rows.map(({ commitment, cardName, personName }) => (
              <article key={commitment.id}>
                <div className="update-icon"><RefreshCw /></div>
                <div className="update-main">
                  <div><b>הוקמה הוראת קבע</b><span className={`status ${commitment.status === "active" ? "active" : ""}`}>{commitment.status === "active" ? "פעילה" : commitment.status === "paused" ? "מושהית" : "הסתיימה"}</span></div>
                  <Link href={`/donors/${commitment.donorCardId}?origin=updates&return=${encodeURIComponent("/?view=updates")}`}><UserRound /> {cardName || "כרטיס תורם"}</Link>
                  {personName && <small>משויך ל־{personName}</small>}
                </div>
                <div className="update-amount"><strong>{money(commitment.amount, commitment.currency)}</strong><small>בכל חודש · יום {commitment.expectedDay}</small></div>
                <div className="update-date"><CalendarDays /><span><b>{formatHebrewDate(commitment.startDate)}</b><small>התחלה: {commitment.startDate}</small></span></div>
                <div className="update-source"><small>{commitment.source === "nedarim-plus" ? "נדרים פלוס" : commitment.source === "manual" ? "ידני" : commitment.source}</small>{commitment.externalId && <span>#{commitment.externalId}</span>}</div>
              </article>
            ))}
          </div>
        ) : (
          <div className="database-empty"><BellRing /><h3>עדיין אין עדכונים</h3><p>הקמת הוראת הקבע הבאה שתיקלט תופיע כאן.</p></div>
        )}
      </section>
    </div>
  );
}
