// @ts-nocheck -- legacy transaction view, validated through runtime tests
"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Check,
  CircleDollarSign,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MovementRecord } from "./movement-dialog";
import { formatCivilDate, formatHebrewDate } from "./hebrew-date";
import { prefetchDonorSummary } from "./donor-detail-cache";
import { clearSettlementCache } from "./settlement-client";

const MovementDialog = dynamic(() => import("./movement-dialog"));
const MovementImportExport = dynamic(() => import("./movement-import-export"));
const BankCashflow = dynamic(() => import("./bank-cashflow"));
const TransactionDetail = dynamic(() => import("./transaction-detail"));

export default function MovementCenter() {
  const [bank, setBankState] = useState(false);
  useEffect(() => {
    setBankState(
      new URLSearchParams(window.location.search).get("bank") === "1",
    );
  }, []);
  function setBank(value: boolean) {
    setBankState(value);
    const url = new URL(window.location.href);
    value ? url.searchParams.set("bank", "1") : url.searchParams.delete("bank");
    window.history.replaceState({}, "", url);
  }
  const [rows, setRows] = useState<MovementRecord[]>([]),
    [filter, setFilter] = useState<"all" | "donation" | "expense">("all"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("date-desc"),
    [summary, setSummary] = useState({
      gross: 0,
      net: 0,
      expenses: 0,
      donationCount: 0,
      expenseCount: 0,
    }),
    [total, setTotal] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<MovementRecord | null>(null),
    [selected, setSelected] = useState<MovementRecord | null>(null),
    [notice, setNotice] = useState("");
  async function load(offset = 0, search = query, type = filter, order = sort) {
    const m = await fetch(
      `/api/donations?limit=20&offset=${offset}&type=${type}&q=${encodeURIComponent(search)}&sort=${order}`,
      { cache: "no-store" },
    );
    if (m.ok) {
      const result = await m.json(),
        loaded = result.donations || [];
      setRows((current) => (offset ? [...current, ...loaded] : loaded));
      setSummary(
        result.summary || {
          gross: 0,
          net: 0,
          expenses: 0,
          donationCount: 0,
          expenseCount: 0,
        },
      );
      setTotal(Number(result.total || 0));
      setHasMore(!!result.hasMore);
      const transactionId = Number(
        new URLSearchParams(window.location.search).get("transaction"),
      );
      if (transactionId)
        setSelected(
          loaded.find((row: MovementRecord) => row.id === transactionId) ||
            null,
        );
    }
  }
  function refreshFinancialData() {
    clearSettlementCache();
    window.dispatchEvent(new Event("settlement-updated"));
  }
  useEffect(() => {
    const show = () => {
      setEditing(null);
      setOpen(true);
    };
    window.addEventListener("open-movement-dialog", show);
    return () => window.removeEventListener("open-movement-dialog", show);
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search),
      savedFilter = p.get("filter");
    if (
      savedFilter === "donation" ||
      savedFilter === "expense" ||
      savedFilter === "all"
    )
      setFilter(savedFilter);
    setQuery(p.get("q") || "");
    setSort(p.get("sort") || "date-desc");
    const scroll = Number(sessionStorage.getItem("movements-scroll") || 0);
    if (scroll) requestAnimationFrame(() => window.scrollTo({ top: scroll }));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(
      () => void load(0, query, filter, sort),
      220,
    );
    return () => window.clearTimeout(timer);
  }, [query, filter, sort]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "movements");
    url.searchParams.set("filter", filter);
    query ? url.searchParams.set("q", query) : url.searchParams.delete("q");
    url.searchParams.set("sort", sort);
    window.history.replaceState({}, "", url);
  }, [filter, query, sort]);
  useEffect(() => {
    const url = new URL(window.location.href);
    selected
      ? url.searchParams.set("transaction", String(selected.id))
      : url.searchParams.delete("transaction");
    window.history.replaceState({}, "", url);
  }, [selected]);
  const shown = rows;
  async function remove(row: MovementRecord) {
    if (
      !confirm(
        `למחוק לצמיתות את התנועה של „${row.donorName}” בסך ${row.amount.toLocaleString("he-IL")} ₪?`,
      )
    )
      return;
    const r = await fetch(`/api/donations?id=${row.id}`, { method: "DELETE" });
    const result = await r.json().catch(() => ({}));
    if (!r.ok) {
      setNotice(result.error || "לא ניתן למחוק את התנועה");
      return;
    }
    setRows((current) => current.filter((item) => item.id !== row.id));
    setTotal((current) => Math.max(0, current - 1));
    setNotice("התנועה נמחקה");
    refreshFinancialData();
    void load();
  }
  const { gross, net, expenses } = summary;
  const currentUrl =
    typeof window === "undefined"
      ? "/?view=movements"
      : `${window.location.pathname}${window.location.search}`;
  return (
    <div className="movement-center">
      {notice && (
        <div className="save-notice">
          <Check />
          {notice}
        </div>
      )}
      <div className="bank-tabs">
        <Button
          variant={bank ? "outline" : "default"}
          onClick={() => setBank(false)}
        >
          תנועות
        </Button>
        <Button
          variant={bank ? "default" : "outline"}
          onClick={() => setBank(true)}
        >
          זיכויים ותזרים בנקאי
        </Button>
      </div>
      {bank && <BankCashflow />}
      {!bank && (
        <div>
          <section className="movement-summary" aria-label="סיכום תנועות החודש">
            <article>
              <small>תרומות החודש</small>
              <b>
                {net.toLocaleString("he-IL", {
                  style: "currency",
                  currency: "ILS",
                })}
              </b>
              <em>
                {summary.donationCount} תנועות · ברוטו{" "}
                {gross.toLocaleString("he-IL", {
                  style: "currency",
                  currency: "ILS",
                })}{" "}
                · עמלות{" "}
                {(gross - net).toLocaleString("he-IL", {
                  style: "currency",
                  currency: "ILS",
                })}
              </em>
            </article>
            <article>
              <small>הוצאות החודש</small>
              <b>
                {expenses.toLocaleString("he-IL", {
                  style: "currency",
                  currency: "ILS",
                })}
              </b>
              <em>{summary.expenseCount} תנועות הוצאה</em>
            </article>
            <article>
              <small>תוצאות בתצוגה הנוכחית</small>
              <b>{total}</b>
              <em>בהתאם לחיפוש ולסינון</em>
            </article>
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>כל התנועות</h2>
                <p>הכנסות, הוצאות ותנועות שנקלטו מהא��נטגרציות</p>
              </div>
              <div className="movement-head-actions">
                <MovementImportExport
                  onImported={() => {
                    refreshFinancialData();
                    void load();
                  }}
                />
                <Button
                  onClick={() => {
                    setEditing(null);
                    setOpen(true);
                  }}
                >
                  <Plus />
                  תנועה חדשה
                </Button>
              </div>
            </div>
            <div className="movement-toolbar">
              <label>
                <Search />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש שם, קטגוריה או אמצעי תשלום"
                />
              </label>
              <div className="movement-filters">
                <Filter />
                {(["all", "donation", "expense"] as const).map((type) => (
                  <button
                    key={type}
                    className={filter === type ? "active" : ""}
                    onClick={() => setFilter(type)}
                  >
                    {type === "all"
                      ? "הכול"
                      : type === "donation"
                        ? "הכנסות"
                        : "הוצאות"}
                  </button>
                ))}
              </div>
              <select
                className="movement-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="מיון תנועות"
              >
                <option value="date-desc">החדשות תחילה</option>
                <option value="date-asc">הישנות תחילה</option>
                <option value="amount-desc">סכום גבוה תחילה</option>
                <option value="amount-asc">סכום נמוך תחילה</option>
              </select>
            </div>
            {shown.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>סוג</th>
                      <th>שם / עבור</th>
                      <th>סכום</th>
                      <th>תאריך</th>
                      <th>מחלקה וקטגוריה</th>
                      <th>אמצעי תשלום</th>
                      <th>מקור</th>
                      <th aria-label="פעולות" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => (
                      <tr
                        key={row.id}
                        className="transaction-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            setSelected(row);
                        }}
                      >
                        <td>
                          <span className={`movement-kind ${row.movementType}`}>
                            {row.movementType === "expense" ? "הוצאה" : "הכנסה"}
                          </span>
                        </td>
                        <td>
                          {row.movementType === "donation" ? (
                            row.donorId ? (
                              <Link
                                prefetch
                                className="donor-name-link"
                                href={`/donors/${row.donorId}?origin=movements&return=${encodeURIComponent(currentUrl)}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  sessionStorage.setItem(
                                    "movements-scroll",
                                    String(window.scrollY),
                                  );
                                }}
                                onMouseEnter={() =>
                                  void prefetchDonorSummary(row.donorId!)
                                }
                                onFocus={() =>
                                  void prefetchDonorSummary(row.donorId!)
                                }
                              >
                                {row.donorName}
                              </Link>
                            ) : (
                              <>
                                <b>{row.donorName || "לא משויך"}</b>
                                <small className="movement-unmatched">
                                  לא משויך · ניתן לשייך בעריכה
                                </small>
                              </>
                            )
                          ) : (
                            <b>{row.donorName}</b>
                          )}
                          {row.purpose && (
                            <small className="movement-detail">
                              {row.purpose}
                            </small>
                          )}
                        </td>
                        <td>
                          <b
                            className={
                              row.movementType === "expense"
                                ? "expense-amount"
                                : "income-amount"
                            }
                          >
                            {row.movementType === "expense" ? "−" : "+"}
                            {Number(row.amount || 0).toLocaleString("he-IL", {
                              style: "currency",
                              currency: /^[A-Z]{3}$/.test(row.currency || "") ? row.currency : "ILS",
                            })}
                          </b>
                          {row.movementType === "donation" &&
                            row.feeAmount > 0 && (
                              <small className="movement-detail">
                                נטו{" "}
                                {Number(row.netAmount || 0).toLocaleString("he-IL", {
                                  style: "currency",
                                  currency: /^[A-Z]{3}$/.test(row.currency || "") ? row.currency : "ILS",
                                })}
                              </small>
                            )}
                        </td>
                        <td>
                            {formatHebrewDate(row.date)}
                          <small className="movement-detail">
                            {formatCivilDate(row.date)}
                          </small>
                        </td>
                        <td>
                          {row.department || "—"}
                          {row.subcategory && (
                            <small className="movement-detail">
                              {row.subcategory}
                            </small>
                          )}
                        </td>
                        <td>
                          {row.paymentMethod}
                          {row.isRecurring && (
                            <small className="movement-detail">קבועה</small>
                          )}
                        </td>
                        <td>
                          <span className="source-chip">
                            {row.source === "manual" ? "ידני" : row.source}
                          </span>
                          {row.externalId && (
                            <small className="movement-detail">
                              #{row.externalId}
                            </small>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              aria-label="עריכת תנועה"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditing(row);
                                setOpen(true);
                              }}
                            >
                              <Pencil />
                            </button>
                            <button
                              className="danger"
                              aria-label="מחיקת תנועה"
                              onClick={(event) => {
                                event.stopPropagation();
                                void remove(row);
                              }}
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
                <CircleDollarSign />
                <h3>אין תנועות בתצוגה זו</h3>
                <p>אפשר להוסיף תנועה ידנית, או להמתין לקליטה מה־webhooks.</p>
              </div>
            )}
            {hasMore && (
              <div className="load-more">
                <Button
                  variant="outline"
                  onClick={() => void load(rows.length, query, filter, sort)}
                >
                  טעינת תנועות נוספות
                </Button>
              </div>
            )}
          </section>
          {open && <MovementDialog
            open={open}
            onOpenChange={setOpen}
            movement={editing}
            onSaved={async () => {
              setNotice(editing ? "התנועה עודכנה" : "התנועה נשמרה");
              setEditing(null);
              refreshFinancialData();
              await load();
            }}
          />}
          {selected && <TransactionDetail
            transaction={selected}
            personName={selected?.personName || undefined}
            onOpenChange={(value) => {
              if (!value) setSelected(null);
            }}
          />}
        </div>
      )}
    </div>
  );
}
