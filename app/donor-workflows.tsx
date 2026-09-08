"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CopyCheck, Link2, Merge, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export { default as RetentionCenter } from "./retention-center";

type Card = { id:number; cardName:string; phone:string; email:string; idNumber:string; alias:string };
type Pair = { key:string; left:Card; right:Card; reasons:string[]; confidence:number };
export function DuplicateCenter(){
  const[pairs,setPairs]=useState<Pair[]>([]),[loaded,setLoaded]=useState(false),[notice,setNotice]=useState("");
  async function load(){setLoaded(false);const response=await fetch("/api/duplicates",{cache:"no-store"});if(response.ok)setPairs((await response.json()).pairs||[]);setLoaded(true)}
  useEffect(()=>{void load()},[]);
  async function decide(pair:Pair,decision:"merge"|"link"|"separate"|"later"){if((decision==="merge"||decision==="link")&&!confirm(`לאשר ${decision==="merge"?"איחוד":"קישור"} של „${pair.right.cardName}” אל „${pair.left.cardName}”? התרומות והפעילות יישמרו.`))return;const response=await fetch("/api/duplicates",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({leftId:pair.left.id,rightId:pair.right.id,decision})});if(response.ok){setNotice(decision==="merge"?"הרשומות אוחדו ונשמר תיעוד לשחזור":decision==="link"?"האנשים והפעילות קושרו לכרטיס משותף":"ההחלטה נשמרה");await load()}else setNotice("לא ניתן להשלים את הפעולה")}
  if(!loaded)return <div className="dashboard-loading">טוען התאמות…</div>;
  return <section className="panel"><div className="panel-head"><div><h2>כפילויות לבדיקה</h2><p>השוואה לפי ת״ז, טלפון, דוא״ל ושמות דומים — ללא איחוד אוטומטי</p></div></div>{notice&&<div className="save-notice"><Check/>{notice}</div>}{pairs.length?<div className="dup-list">{pairs.map(pair=><article className="duplicate" key={pair.key}><span className="match-score"><b>{pair.confidence}%</b><small>התאמה</small></span><div className="person-compare"><div><small>כרטיס ראשון</small><h3>{pair.left.cardName}</h3><p>{[pair.left.phone,pair.left.email,pair.left.idNumber].filter(Boolean).join(" · ")||"אין פרטי זיהוי"}</p></div><CopyCheck/><div><small>כרטיס שני</small><h3>{pair.right.cardName}</h3><p>{[pair.right.phone,pair.right.email,pair.right.idNumber].filter(Boolean).join(" · ")||"אין פרטי זיהוי"}</p></div></div><p className="match-reason">{pair.reasons.join(" · ")}</p><div className="card-actions"><Button size="sm" onClick={()=>void decide(pair,"merge")}><Merge/>אותו אדם — איחוד</Button><Button size="sm" variant="outline" onClick={()=>void decide(pair,"link")}><Link2/>אנשים שונים — כרטיס משותף</Button><Button size="sm" variant="outline" onClick={()=>void decide(pair,"separate")}><X/>השאר נפרד</Button><Button size="sm" variant="ghost" onClick={()=>void decide(pair,"later")}>החלטה מאוחר יותר</Button></div></article>)}</div>:<div className="database-empty"><Check/><h3>אין כפילויות לבדיקה</h3><p>לא נמצאו התאמות חדשות שמחייבות החלטה.</p></div>}</section>
}
