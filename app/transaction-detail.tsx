"use client";
import Link from "next/link";
import {
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  FileText,
  ReceiptText,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatHebrewDate } from "./hebrew-date";
import type { MovementRecord } from "./movement-dialog";
import TransactionSettlement from "./transaction-settlement";
type Props = {
  transaction: MovementRecord | null;
  personName?: string;
  onOpenChange: (open: boolean) => void;
};
const money = (value: number | undefined, currency = "ILS") =>
  Number(value || 0).toLocaleString("he-IL", { style: "currency", currency });
function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CreditCard;
  label: string;
  value?: string | number | null;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="transaction-field">
      <Icon />
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
    </div>
  );
}
export default function TransactionDetail({
  transaction,
  onOpenChange,
  personName,
}: Props) {
  if (!transaction) return null;
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(transaction.rawPayload || "{}");
  } catch {}
  const reference = String(
      raw.receiptNumber || raw.Receipt || raw.asmachta || raw.reference || "",
    ),
    civil = new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${transaction.date}T12:00:00`)),
    returnUrl =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/?view=movements",
    donorHref = transaction.donorId
      ? `/donors/${transaction.donorId}?origin=transaction&return=${encodeURIComponent(returnUrl)}`
      : "";
  return (
    <Dialog open={!!transaction} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="transaction-detail-dialog sm:max-w-2xl"
      >
        <DialogHeader className="text-right">
          <DialogTitle>פרטי תנועה</DialogTitle>
        </DialogHeader>
        <div className="transaction-hero">
          <span
            className={
              transaction.movementType === "expense" ? "expense" : "income"
            }
          >
            <CircleDollarSign />
          </span>
          <div>
            <small>
              {transaction.movementType === "expense" ? "הוצאה" : "הכנסה"}
            </small>
            <strong>
              {money(transaction.amount, transaction.currency || "ILS")}
            </strong>
            <p>
              {transaction.isRecurring
                ? "תנועה קבועה / הוראת קבע"
                : "תנועה חד־פעמית"}
            </p>
          </div>
        </div>
        <div className="transaction-detail-grid">
          <Field
            icon={CalendarDays}
            label="תאריך עברי"
            value={formatHebrewDate(transaction.date)}
          />
          <Field icon={CalendarDays} label="תאריך לועזי" value={civil} />
          {transaction.donorId ? (
            <div className="transaction-field">
              <UserRound />
              <span>
                <small>כרטיס תורם</small>
                <Link href={donorHref}>
                  {transaction.donorName}
                  <ExternalLink />
                </Link>
              </span>
            </div>
          ) : (
            <Field icon={UserRound} label="שיוך" value="לא משויך" />
          )}
          <Field
            icon={UserRound}
            label="נתרם על ידי"
            value={personName || "הכרטיס המשותף"}
          />
          <Field
            icon={CreditCard}
            label="אמצעי תשלום"
            value={transaction.paymentMethod}
          />
          <Field
            icon={FileText}
            label="מקור הנתונים"
            value={
              transaction.source === "manual" ? "ידני" : transaction.source
            }
          />
          <Field
            icon={ReceiptText}
            label="יעד / קטגוריה"
            value={
              transaction.subcategory ||
              transaction.purpose ||
              transaction.department
            }
          />
          <Field
            icon={ReceiptText}
            label="סיבת התרומה"
            value={transaction.purpose}
          />
          <Field
            icon={CircleDollarSign}
            label="סכום ברוטו"
            value={money(transaction.amount, transaction.currency || "ILS")}
          />
          <Field
            icon={CircleDollarSign}
            label="עמלה"
            value={
              transaction.feeAmount
                ? money(transaction.feeAmount, transaction.currency || "ILS")
                : "ללא עמלה"
            }
          />
          <Field
            icon={CircleDollarSign}
            label="סכום נטו"
            value={money(
              transaction.netAmount ?? transaction.amount,
              transaction.currency || "ILS",
            )}
          />
          <Field
            icon={FileText}
            label="Transaction ID"
            value={transaction.externalId}
          />
          <Field
            icon={ReceiptText}
            label="מספר קבלה / אסמכתא"
            value={reference}
          />
          <Field
            icon={FileText}
            label="סטטוס"
            value={transaction.matchStatus === "review" ? "דורש שיוך" : "נקלט"}
          />
        </div>
        <TransactionSettlement key={transaction.id} transaction={transaction}/>
        {transaction.reason && (
          <div className="transaction-notes">
            <b>הערות</b>
            <p>{transaction.reason}</p>
          </div>
        )}
        <p className="transaction-security">
          פרטי כרטיס אשראי ונתוני תשלום רגישים אינם מוצגים.
        </p>
      </DialogContent>
    </Dialog>
  );
}
