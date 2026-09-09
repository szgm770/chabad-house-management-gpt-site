"use client";

import { useState } from "react";

export default function SetupDatabasePage() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  async function initialize() {
    setState("loading"); setMessage("");
    try {
      const response = await fetch("/api/setup", { method: "POST" });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "לא ניתן לאתחל את המסד.");
      setState("done"); setMessage(payload.message || "מסד הנתונים מוכן.");
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : "אירעה שגיאה.");
    }
  }
  return <main dir="rtl" className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12"><section className="w-full rounded-2xl border bg-white p-7 shadow-sm"><h1 className="text-2xl font-bold text-slate-900">הכנת מסד הנתונים</h1><p className="mt-3 text-base leading-7 text-slate-600">הפעולה תיצור את טבלאות מערכת ניהול בית חב״ד במסד החדש. היא בטוחה להפעלה חוזרת ואינה מכניסה נתוני דוגמה.</p><button onClick={initialize} disabled={state === "loading" || state === "done"} className="mt-7 min-h-11 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-60">{state === "loading" ? "מכין את המסד…" : state === "done" ? "המסד מוכן" : "הכנת מסד הנתונים"}</button>{message && <p className={`mt-4 text-sm ${state === "error" ? "text-red-700" : "text-emerald-700"}`}>{message}</p>}</section></main>;
}
