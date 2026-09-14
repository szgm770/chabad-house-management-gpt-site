"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, DatabaseZap, Download, FileSpreadsheet, RefreshCw, Trash2 } from "lucide-react";
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
  return <div className="data-settings-stack"><ImportHistory/><section className="config-panel data-maintenance"><div className="panel-head"><div><h2>תקינות מודל הנתונים</h2><p>בדיקה ותיקון בטוחים של שיוכי אנשים, כרטיסי תורם ותנועות ישנות.</p></div><DatabaseZap/></div><p>הפעולה יוצרת כרטיס חסר, מסנכרנת שיוכים ומעבירה מקרים עמומים ל״דורש טיפול״. היא אינה מוחקת תרומות.</p><div className="dialog-actions"><Button disabled={busy} onClick={()=>void repair()}><RefreshCw className={busy?"spin":""}/>{busy?"בודק...":"הפעלת בדיקת תקינות"}</Button></div>{result&&<div className="save-notice"><CheckCircle2/>{result}</div>}</section><section className="config-panel backup-panel"><div className="panel-head"><div><h2>גיבוי וייצוא</h2><p>שמירת עותק מקומי של נתוני המערכת לצורכי בקרה.</p></div><Download/></div><p>קובץ הגיבוי נוצר בזמן ההורדה ואינו משנה או מוחק מידע במערכת.</p><div className="dialog-actions"><Button asChild variant="outline"><a href="/api/export" download><Download/>הורדת גיבוי מלא</a></Button></div></section></div>;
}

type ImportRun={id:number;filename:string;rowsTotal:number;rowsImported:number;rowsSkipped:number;createdAt:string};
function ImportHistory(){
  const[runs,setRuns]=useState<ImportRun[]>([]),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true),[deleting,setDeleting]=useState<number|null>(null);
  const load=()=>{setLoading(true);fetch("/api/movements/import").then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"לא ניתן לטעון את הייבואים");setRuns(data.runs||[])}).catch(error=>setNotice(error instanceof Error?error.message:"לא ניתן לטעון את הייבואים")).finally(()=>setLoading(false))};
  useEffect(load,[]);
  async function remove(run:ImportRun){
    if(!window.confirm(`לבטל את הייבוא „${run.filename}”? ${run.rowsImported} התנועות שנקלטו ממנו יימחקו. פעולה זו אינה מוחקת תנועות אחרות.`))return;
    setDeleting(run.id);setNotice("");
    try{const response=await fetch("/api/movements/import",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:run.id})});const data=await response.json();if(!response.ok)throw new Error(data.error||"לא ניתן לבטל את הייבוא");setRuns(current=>current.filter(item=>item.id!==run.id));setNotice(`הייבוא בוטל ו־${data.deleted} תנועות נמחקו.`);window.dispatchEvent(new Event("movements-changed"))}catch(error){setNotice(error instanceof Error?error.message:"לא ניתן לבטל את הייבוא")}finally{setDeleting(null)}
  }
  return <section className="config-panel import-history"><div className="panel-head"><div><h2>היסטוריית ייבוא תנועות</h2><p>מעקב וביטול מרוכז של קבצים שיובאו למערכת.</p></div><FileSpreadsheet/></div>{notice&&<div className="save-notice"><CheckCircle2/>{notice}</div>}{loading?<p className="import-history-empty">טוען את היסטוריית הייבוא…</p>:runs.length===0?<p className="import-history-empty">עדיין לא בוצעו ייבואי תנועות.</p>:<div className="import-history-list">{runs.map(run=><article key={run.id}><div><b>{run.filename}</b><small>{new Intl.DateTimeFormat("he-IL",{dateStyle:"short",timeStyle:"short"}).format(new Date(run.createdAt))}</small></div><dl><div><dt>בקובץ</dt><dd>{run.rowsTotal}</dd></div><div><dt>נקלטו</dt><dd>{run.rowsImported}</dd></div><div><dt>דולגו</dt><dd>{run.rowsSkipped}</dd></div></dl><Button variant="outline" disabled={deleting===run.id} onClick={()=>void remove(run)}><Trash2/>{deleting===run.id?"מבטל…":"ביטול הייבוא"}</Button></article>)}</div>}<p className="settings-help">ביטול מוחק רק תנועות שנקלטו מאותו קובץ. תנועות שנוספו ידנית או התקבלו ב־Webhook אינן מושפעות.</p></section>
}
