"use client";
import { useEffect, useState } from "react";
import { Check, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Categories=Record<string,string[]>;
const initial:Categories={"בית חב״ד":["שותפות חודשית","תרומה כללית","חלוקת מצות","פעילות חגים","שיעורי תורה ותלמוד תורה","קופת צדקה"],"בית כנסת":["כיסא של אליהו","נדרים ונדבות","מתנות לאביונים","קמחא דפסחא","עליות לתורה"],"חנות":["מכירת ספרי קודש","תשמישי קדושה","מזוזות ותפילין","ערכות חג וארבעת המינים"]};
export default function MovementCategorySettings(){
 const[items,setItems]=useState<Categories>(initial),[notice,setNotice]=useState(""),[newDepartment,setNewDepartment]=useState(""),[drafts,setDrafts]=useState<Record<string,string>>({});
 useEffect(()=>{fetch("/api/settings").then(r=>r.json()).then(j=>{try{if(j.settings?.movement_categories)setItems(JSON.parse(j.settings.movement_categories))}catch{}})},[]);
 const addDepartment=()=>{const name=newDepartment.trim();if(!name)return;if(items[name]){setNotice("מחלקה בשם הזה כבר קיימת");return}setItems(x=>({...x,[name]:[]}));setNewDepartment("");setNotice("")};
 const rename=(oldName:string,newName:string)=>{const clean=newName.trim();if(!clean||clean===oldName||items[clean])return;setItems(current=>{const next:Categories={};Object.entries(current).forEach(([key,value])=>next[key===oldName?clean:key]=value);return next})};
 const addCategory=(department:string)=>{const value=(drafts[department]||"").trim();if(!value||items[department]?.includes(value))return;setItems(x=>({...x,[department]:[...x[department],value]}));setDrafts(x=>({...x,[department]:""}))};
 async function save(){const r=await fetch("/api/settings",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({movement_categories:JSON.stringify(items)})});setNotice(r.ok?"רשימות המחלקות נשמרו":"לא ניתן לשמור כרגע")}
 return <section className="config-panel category-settings">{notice&&<div className="save-notice"><Check/>{notice}</div>}<div className="panel-head"><div><h2>מחלקות וקטגוריות לתנועות</h2><p>הוספה, עריכה ומחיקה של הרשימות שמופיעות בהזנת תנועה.</p></div><Button onClick={()=>void save()}><Save/>שמירת הרשימות</Button></div>
  <div className="category-add"><label><span>מחלקה חדשה</span><input value={newDepartment} onChange={e=>setNewDepartment(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addDepartment()}}} placeholder="לדוגמה: פעילות קהילתית"/></label><Button variant="outline" onClick={addDepartment}><Plus/>הוספה</Button></div>
  <div className="category-list">{Object.entries(items).map(([department,categories])=><article key={department}><div className="category-title"><input aria-label={`שם מחלקה ${department}`} defaultValue={department} onBlur={e=>rename(department,e.target.value)}/><button className="danger-action" aria-label={`מחיקת ${department}`} onClick={()=>{if(window.confirm(`למחוק את המחלקה ${department} ואת הקטגוריות שלה?`))setItems(x=>{const copy={...x};delete copy[department];return copy})}}><Trash2/></button></div><div className="category-chips">{categories.length?categories.map(category=><span key={category}>{category}<button aria-label={`מחיקת ${category}`} onClick={()=>setItems(x=>({...x,[department]:x[department].filter(v=>v!==category)}))}><X/></button></span>):<small>עדיין אין קטגוריות במחלקה זו</small>}</div><div className="category-inline-add"><input value={drafts[department]||""} onChange={e=>setDrafts(x=>({...x,[department]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCategory(department)}}} placeholder="שם קטגוריה חדשה"/><button onClick={()=>addCategory(department)}><Plus/>הוספה</button></div></article>)}</div>
 </section>
}
