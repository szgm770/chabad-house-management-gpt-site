"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Item = { id: number | string; kind: string; donorCardId: number | null; title: string; detail: string; priority: string; dueDate: string | null; status: string };
type Filter = "open" | "resolved" | "all";

export default function AttentionCenter() {
  const [rows, setRows] = useState<Item[]>([]), [filter, setFilter] = useState<Filter>("open"), [loading, setLoading] = useState(true), [notice, setNotice] = useState("");
  async function load() { setLoading(true); const response = await fetch("/api/attention", { cache: "no-store" }); if (response.ok) setRows((await response.json()).items || []); else setNotice("לא ניתן לטעון את מרכז הטיפול"); setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function toggle(item: Item) { const status = item.status === "resolved" ? "open" : "resolved"; const response = await fetch("/api/attention", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, status, resolution: status === "resolved" ? "סומן כטופל ידנית" : "" }) }); if (response.ok) { setNotice(status === "resolved" ? "הפריט סומן כטופל" : "הפריט נפתח מחדש"); await load(); } }
  const shown = useMemo(() => rows.filter((row) => filter === "all" || row.status === filter), [rows, filter]);
  const openCount = rows.filter((row) => row.status !== "resolved").length;
  return <div className="attention-center">
    {notice && <div className="save-notice"><Check />{notice}</div>}
    <section className="attention-summary"><div><AlertCircle/><span><b>{openCount}</b><small>פריטים פתוחים</small></span></div><div><Check/><span><b>{rows.length-openCount}</b><small>טופלו</small></span></div></section>
    <section className="panel"><div className="panel-head"><div><h2>מרכז דורש טיפול</h2><p>סירובים, פרטי משלוח חסרים, שיוכים, משימות והוראות קבע</p></div><div className="attention-filters">{([['open','פתוחים'],['resolved','טופלו'],['all','הכול']] as const).map(([id,label])=><button key={id} className={filter===id?"active":""} onClick={()=>setFilter(id)}>{label}</button>)}</div></div>
      {loading?<div className="donor-list-skeleton">{[1,2,3].map((i)=><i key={i}/>)}</div>:shown.length?<div className="decline-list">{shown.map((item)=><article key={String(item.id)} className={item.status==="resolved"?"handled":""}><span className="decline-icon"><AlertCircle/></span><div className="decline-main"><b>{item.title}</b><p>{item.detail}</p><small>{item.dueDate||"ללא מועד"} · {item.priority==="high"?"עדיפות גבוהה":"עדיפות רגילה"}</small>{item.donorCardId&&<Link className="donor-name-link" href={`/donors/${item.donorCardId}?origin=attention&return=${encodeURIComponent('/?view=attention')}`}>פתיחת כרטיס התורם</Link>}</div><Button size="sm" variant={item.status==="resolved"?"outline":"default"} onClick={()=>void toggle(item)}>{item.status==="resolved"?<><RefreshCw/>פתיחה מחדש</>:<><Check/>סימון כטופל</>}</Button></article>)}</div>:<div className="database-empty"><Check/><h3>אין פריטים בתצוגה זו</h3><p>פריטים יישארו פתוחים עד שתטפל בהם או תסמן אותם כטופלו.</p></div>}
    </section>
  </div>;
}
