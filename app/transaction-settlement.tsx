"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatHebrewDate } from "./hebrew-date";
import { rulesFromSettings, settlementFor, type SettlementRule } from "./settlement";
import type { MovementRecord } from "./movement-dialog";
export default function TransactionSettlement({transaction:t}:{transaction:MovementRecord}){
 const[rules,setRules]=useState<SettlementRule[]>([]),[expected,setExpected]=useState(t.expectedSettlementDate||""),[actual,setActual]=useState(t.actualSettlementDate||""),[review,setReview]=useState(!!t.settlementReview),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch("/api/settings").then(r=>r.json()).then(d=>setRules(rulesFromSettings(d.settings||{}))).catch(()=>setNotice("לא ניתן לטעון את כלל הזיכוי"))},[]);
 const s=settlementFor({...t,expectedSettlementDate:expected,actualSettlementDate:actual,settlementReview:review},rules);
 async function save(){setBusy(true);try{const r=await fetch("/api/settlements",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:t.id,expectedSettlementDate:expected||null,actualSettlementDate:actual||null,settlementReview:review})});const d=await r.json();if(!r.ok){setNotice(d.error);return}Object.assign(t,{expectedSettlementDate:expected||null,actualSettlementDate:actual||null,settlementReview:review});setNotice("פרטי הזיכוי נשמרו");window.dispatchEvent(new Event("settlement-updated"))}catch{setNotice("לא ניתן לשמור כרגע. נסה שוב.")}finally{setBusy(false)}}
 const money=(n:number)=>n.toLocaleString("he-IL",{style:"currency",currency:t.currency||"ILS"});
 return <section className="bank-stack config-panel"><h3>{t.movementType==="expense"?"חיוב החשבון":"זיכוי לחשבון"}</h3><p>ברוטו {money(t.amount)} · עמלה {money(t.feeAmount||0)} · נטו {money(t.amount-(t.feeAmount||0))}</p><p>סטטוס: {s.status} · מועד צפוי: {s.expected?`${s.expected} · ${formatHebrewDate(s.expected)}`:"טרם הוגדר"}</p>{s.automatic&&<p className="settlement-auto-note">הזיכוי נחשב כנכנס אוטומטית לפי הכלל שהוגדר לאמצעי התשלום.</p>}<label>מועד צפוי ידני (ריק = לפי הכלל)<input type="date" value={expected} onChange={e=>setExpected(e.target.value)}/>{expected&&<small>{formatHebrewDate(expected)}</small>}</label><label>תאריך כניסה מאומת (אופציונלי)<input type="date" value={actual} onChange={e=>setActual(e.target.value)}/>{actual&&<small>{formatHebrewDate(actual)}</small>}</label><label><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/> חריגה — לא לחשב כנכנס עד לבדיקה</label><Button disabled={busy} onClick={save}>שמירת פרטי זיכוי</Button>{notice&&<p role="status">{notice}</p>}</section>
}
