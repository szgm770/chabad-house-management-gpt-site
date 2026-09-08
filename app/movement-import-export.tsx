"use client";

import { ChangeEvent, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const headers=["סוג תנועה","שם התורם / עבור מה ההוצאה","סכום","מטבע","תאריך לועזי","אמצעי תשלום","מחלקה ראשית","קטגוריית משנה","תנועה קבועה","הערות","מזהה חיצוני","מקור"];
const examples=[
  ["הכנסה","ישראל ישראלי","360","ILS","2026-08-31","אשראי","בית חב״ד","שותפות חודשית","כן","תרומה חודשית","","ידני"],
  ["הוצאה","חברת החשמל","520","ILS","2026-08-31","העברה בנקאית","בית כנסת","","לא","חשבון חשמל","","ידני"]
];
const cell=(value:string)=>`"${value.replaceAll('"','""')}"`;
const download=(filename:string,contents:string)=>{const blob=new Blob(["\ufeff"+contents],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=filename;anchor.click();URL.revokeObjectURL(url)};
const parseCsv=(text:string)=>{const rows:string[][]=[];let row:string[]=[],value="",quoted=false;for(let i=0;i<text.length;i++){const char=text[i],next=text[i+1];if(char==='"'&&quoted&&next==='"'){value+='"';i++;continue}if(char==='"'){quoted=!quoted;continue}if(char===","&&!quoted){row.push(value.trim());value="";continue}if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value="";continue}value+=char}row.push(value.trim());if(row.some(Boolean))rows.push(row);return rows};

export default function MovementImportExport({onImported}:{onImported:()=>void}){
  const[open,setOpen]=useState(false),[message,setMessage]=useState(""),[pending,setPending]=useState<{filename:string;fingerprint:string;rows:Record<string,unknown>[]} | null>(null),[busy,setBusy]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  function template(){download("תבנית-ייבוא-תנועות.csv",[headers,...examples].map(row=>row.map(cell).join(",")).join("\r\n"))}
  async function exportAll(){const response=await fetch("/api/movements/export");if(!response.ok){setMessage("לא ניתן לייצא כרגע");return}download("רשימת-תנועות.csv",(await response.text()).replace(/^\ufeff/,""))}
  async function importFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file)return;setMessage("");
    if(!file.name.toLowerCase().endsWith(".csv")){setMessage("יש להעלות קובץ CSV שנשמר מתוך Excel.");return}
    const text=(await file.text()).replace(/^\ufeff/,"");const [columns,...data]=parseCsv(text);
    const index=(name:string)=>columns?.findIndex(column=>column.trim()===name)??-1;
    if(index("סוג תנועה")<0||index("שם התורם / עבור מה ההוצאה")<0||index("סכום")<0||index("תאריך לועזי")<0){setMessage("מבנה הקובץ אינו מתאים. הורד את התבנית והשתמש בכותרות הקיימות.");return}
    const get=(row:string[],name:string)=>row[index(name)]||"";
    const rows=data.map(row=>({movementType:get(row,"סוג תנועה")==="הוצאה"?"expense" as const:"donation" as const,donorName:get(row,"שם התורם / עבור מה ההוצאה"),amount:get(row,"סכום"),currency:get(row,"מטבע")||"ILS",date:get(row,"תאריך לועזי"),paymentMethod:get(row,"אמצעי תשלום"),department:get(row,"מחלקה ראשית"),subcategory:get(row,"קטגוריית משנה"),purpose:get(row,"קטגוריית משנה"),isRecurring:["כן","true","1"].includes(get(row,"תנועה קבועה").toLowerCase()),reason:get(row,"הערות"),externalId:get(row,"מזהה חיצוני")||undefined})).filter(row=>row.donorName&&row.amount&&row.date);
    if(!rows.length){setMessage("לא נמצאו בקובץ תנועות תקינות לייבוא.");return}
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
    setPending({filename:file.name,fingerprint:hash,rows});setMessage(`נמצאו ${rows.length} תנועות תקינות. בדוק את התצוגה המקדימה ואשר את הייבוא.`);event.target.value="";
  }
  async function confirmImport(){if(!pending)return;setBusy(true);const response=await fetch("/api/movements/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(pending)});const result=await response.json();
    if(!response.ok){setMessage(result.error||"הייבוא נכשל");setBusy(false);return}
    setMessage(`הייבוא הושלם: ${result.imported} תנועות נוספו${result.skipped?`, ${result.skipped} שורות דולגו`:""}.`);setPending(null);setBusy(false);onImported();
  }
  return <><Button variant="outline" onClick={()=>setOpen(true)}><FileSpreadsheet/>ייבוא / ייצוא</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="import-dialog"><DialogHeader className="text-right"><DialogTitle>ייבוא וייצוא תנועות</DialogTitle><DialogDescription>תהליך בטוח ומסודר להעברת הכנסות והוצאות באמצעות Excel.</DialogDescription></DialogHeader><div className="import-steps"><article><span>1</span><div><b>הורדת קובץ לדוגמה</b><p>התבנית כוללת את כל העמודות ושורות לדוגמה להכנסה ולהוצאה.</p></div><Button variant="outline" onClick={template}><Download/>הורדת התבנית</Button></article><article><span>2</span><div><b>העלאה ובדיקה</b><p>הקובץ לא יישמר לפני שתוצג תצוגה מקדימה ותאשר אותו.</p></div><Button onClick={()=>fileRef.current?.click()}><Upload/>בחירת קובץ</Button><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e=>void importFile(e)}/></article><article><span>3</span><div><b>ייצוא כל התנועות</b><p>הורדת כל ההכנסות וההוצאות עם מלוא הפרטים.</p></div><Button variant="outline" onClick={()=>void exportAll()}><Download/>ייצוא הרשימה</Button></article></div>{message&&<p className="import-message" role="status">{message}</p>}{pending&&<section className="import-preview"><div className="panel-head"><div><h3>תצוגה מקדימה</h3><p>{pending.filename} · {pending.rows.length} רשומות</p></div><button aria-label="ביטול הייבוא" onClick={()=>setPending(null)}><X/></button></div><div className="import-preview-list">{pending.rows.slice(0,5).map((row,index)=><article key={index}><CheckCircle2/><div><b>{String(row.donorName)}</b><small>{String(row.movementType)==="expense"?"הוצאה":"הכנסה"} · {String(row.amount)} {String(row.currency)} · {String(row.date)}</small></div></article>)}</div>{pending.rows.length>5&&<small>ועוד {pending.rows.length-5} רשומות</small>}<Button disabled={busy} onClick={()=>void confirmImport()}>{busy?"מייבא...":"אישור וייבוא הנתונים"}</Button></section>}<div className="import-tip"><b>חשוב:</b> אין לשנות את שמות העמודות. תאריך נכתב בפורמט <code>YYYY-MM-DD</code>, וסוג התנועה הוא „הכנסה” או „הוצאה”.</div></DialogContent></Dialog></>
}
