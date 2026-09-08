"use client";

import { useState } from "react";
import { CheckCircle2, DatabaseZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DataMaintenance() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function repair() {
    setBusy(true);
    setResult("");
    try {
      const response = await fetch("/api/maintenance/repair", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "התיקון נכשל");
      const counts = Object.values((data.result || {}) as Record<string, unknown>).filter(value=>typeof value==="number") as number[];
      setResult(`הבדיקה הושלמה: ${counts.reduce((sum,value)=>sum+value,0)} תיקונים בוצעו.`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "לא ניתן להשלים את הבדיקה");
    } finally {
      setBusy(false);
    }
  }
  return <section className="config-panel data-maintenance"><div className="panel-head"><div><h2>תקינות מודל הנתונים</h2><p>בדיקה ותיקון בטוחים של שיוכי Person, DonorCard ותנועות ישנות.</p></div><DatabaseZap/></div><p>הפעולה יוצרת כרטיס חסר לאדם, מסנכרנת את רשימת האנשים בכרטיס ומעבירה מקרים עמומים ל״דורש טיפול״. היא אינה מוחקת תרומות.</p><div className="dialog-actions"><Button disabled={busy} onClick={()=>void repair()}><RefreshCw className={busy?"spin":""}/>{busy?"בודק...":"הפעלת בדיקת תקינות"}</Button></div>{result&&<div className="save-notice"><CheckCircle2/>{result}</div>}</section>;
}
