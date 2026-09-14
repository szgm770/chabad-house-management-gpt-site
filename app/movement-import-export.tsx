"use client";

import { ChangeEvent, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const headers=["סוג תנועה","מזהה כרטיס תורם","מזהה אדם","שם התורם / עבור מה ההוצאה","תעודת זהות","טלפון","דוא״ל","כתובת","סכום","מטבע","תאריך לועזי","אמצעי תשלום","מחלקה ראשית","קטגוריית משנה","תנועה קבועה","הערות","מזהה חיצוני","מקור"];
const examples=[
  ["הכנסה","","","ישראל ישראלי","123456782","0501234567","israel@example.com","רחוב ישראל 1","360","ILS","2026-08-31","אשראי","בית חב״ד","שותפות חודשית","כן","תרומה חודשית","","ידני"],
  ["הוצאה","","","חברת החשמל","","","","","520","ILS","2026-08-31","העברה בנקאית","בית כנסת","","לא","חשבון חשמל","","ידני"]
];
const cell=(value:string)=>`"${value.replaceAll('"','""')}"`;
const download=(filename:string,contents:string)=>{const blob=new Blob(["\ufeff"+contents],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=filename;anchor.click();URL.revokeObjectURL(url)};
const parseCsv=(text:string)=>{const rows:string[][]=[];let row:string[]=[],value="",quoted=false;for(let i=0;i<text.length;i++){const char=text[i],next=text[i+1];if(char==='"'&&quoted&&next==='"'){value+='"';i++;continue}if(char==='"'){quoted=!quoted;continue}if(char===","&&!quoted){row.push(value.trim());value="";continue}if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value="";continue}value+=char}row.push(value.trim());if(row.some(Boolean))rows.push(row);return rows};
const importAmount=(value:string)=>value.replace(/[₪$€£,\s]/g,"");
const importDate=(value:string)=>{const text=value.trim();if(!text)return new Date().toISOString().slice(0,10);if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)){const[y,m,d]=text.split("-");return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`}const match=text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);if(match)return `${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;const serial=Number(text);if(Number.isFinite(serial)&&serial>20000&&serial<100000)return new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);return text};

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
    const rows=data.map(row=>({movementType:get(row,"סוג תנועה")==="הוצאה"?"expense" as const:"donation" as const,donorId:Number(get(row,"מזהה כרטיס תורם"))||undefined,personId:Number(get(row,"מזהה אדם"))||undefined,donorName:get(row,"שם התורם / עבור מה ההוצאה"),idNumber:get(row,"תעודת זהות"),phone:get(row,"טלפון"),email:get(row,"דוא״ל"),address:get(row,"כתובת"),amount:importAmount(get(row,"סכום")),currency:get(row,"מטבע")||"ILS",date:importDate(get(row,"תאריך לועזי")),paymentMethod:get(row,"אמצעי תשלום")||"לא צוין",department:get(row,"מחלקה ראשית"),subcategory:get(row,"קטגוריית משנה"),purpose:get(row,"קטגוריית משנה"),isRecurring:["כן","true","1"].includes(get(row,"תנועה קבועה").toLowerCase()),reason:get(row,"הערות"),externalId:get(row,"מזהה חיצוני")||undefined})).filter(row=>Number.isFinite(Number(row.amount))&&Number(row.amount)!==0);
    if(!rows.length){setMessage("לא נמצא בקובץ סכום תקין. שאר העמודות יכולות להישאר ריקות.");return}
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
    const identified=rows.filter(row=>row.movementType==="expense"||row.donorId||row.idNumber||row.phone||row.email).length;
    setPending({filename:file.name,fingerprint:hash,rows});setMessage(`נמצאו ${rows.length} תנועות תקינות. ${identified} כוללות אמצעי זיהוי ודאי. בדוק את התצוגה המקדימה ואשר את הייבוא.`);event.target.value="";
  }
  async function confirmImport(){if(!pending)return;setBusy(true);const response=await fetch("/api/movements/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(pending)});const result=await response.json();
    if(!response.ok){setMessage(result.error||"הייבוא נכשל");setBusy(false);return}
    const errorText=Array.isArray(result.errors)&&result.errors.length?` סיבות הדילוג: ${result.errors.map((item:{reason:string;count:number})=>`${item.reason} (${item.count})`).join(", ")}.`:"";
    setMessage(`הייבוא הושלם: ${result.imported} תנועות נוספו. ${result.matched||0} שויכו לכרטיס קיים, ${result.created||0} יצרו כרטיס חדש${result.review?`, ${result.review} הועברו לבדיקת התאמה`:""}${result.skipped?`, ${result.skipped} שורות דולגו`:""}.${errorText}`);setPending(null);setBusy(false);onImported();
  }
  return <><Button variant="outline" onClick={()=>setOpen(true)}><FileSpreadsheet/>ייבוא / ייצוא</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="import-dialog"><DialogHeader className="text-right"><DialogTitle>ייבוא וייצוא תנועות</DialogTitle><DialogDescription>תהליך בטוח ומסודר להעברת הכנסות והוצאות באמצעות Excel.</DialogDescription></DialogHeader><div className="import-steps"><article><span>1</span><div><b>הורדת קובץ לדוגמה</b><p>התבנית כוללת מזהי כרטיס ואדם, ת״ז, טלפון, דוא״ל וכתובת להתאמה מדויקת.</p></div><Button variant="outline" onClick={template}><Download/>הורדת התבנית</Button></article><article><span>2</span><div><b>העלאה ובדיקה</b><p>גם שורות חלקיות ייקלטו; רק סכום תקין הוא חובה.</p></div><Button onClick={()=>fileRef.current?.click()}><Upload/>בחירת קובץ</Button><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e=>void importFile(e)}/></article><article><span>3</span><div><b>ייצוא כל התנועות</b><p>הורדת כל ההכנסות וההוצאות עם פרטי הזיהוי הקיימים.</p></div><Button variant="outline" onClick={()=>void exportAll()}><Download/>ייצוא הרשימה</Button></article></div>{message&&<p className="import-message" role="status">{message}</p>}{pending&&<section className="import-preview"><div className="panel-head"><div><h3>תצוגה מקדימה</h3><p>{pending.filename} · {pending.rows.length} רשומות</p></div><button aria-label="ביטול הייבוא" onClick={()=>setPending(null)}><X/></button></div><div className="import-preview-list">{pending.rows.slice(0,5).map((row,index)=><article key={index}><CheckCircle2/><div><b>{String(row.donorName||"ללא שם — יועבר לבדיקה")}</b><small>{String(row.movementType)==="expense"?"הוצאה":row.donorId||row.idNumber||row.phone||row.email?"הכנסה · כולל זיהוי":"הכנסה · זיהוי לפי שם"} · {String(row.amount)} {String(row.currency)} · {String(row.date)}</small></div></article>)}</div>{pending.rows.length>5&&<small>ועוד {pending.rows.length-5} רשומות</small>}<Button disabled={busy} onClick={()=>void confirmImport()}>{busy?"מייבא...":"אישור וייבוא הנתונים"}</Button></section>}<div className="import-tip"><b>חשוב:</b> הסכום הוא שדה החובה היחיד. תאריך חסר יקבל את תאריך הייבוא, ושם חסר ייקלט כ״ללא שם״ ויועבר לבדיקת התאמה. ת״ז, טלפון או דוא״ל מסייעים למנוע כפילויות.</div></DialogContent></Dialog></>
}
