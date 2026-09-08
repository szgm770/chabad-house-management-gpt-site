"use client";

import { useEffect, useRef, useState } from "react";
import { HandCoins, Plus, UserPlus } from "lucide-react";
import DonorFormDialog from "./donor-form-dialog";

export default function QuickActions({onMovement}:{onMovement:()=>void}){
  const[open,setOpen]=useState(false);
  const[donorOpen,setDonorOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
    document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape)};
  },[]);
  return <><div ref={root} className={`quick-actions ${open?"is-open":""}`} dir="rtl">
    {open&&<div className="quick-action-menu" role="menu">
      <button role="menuitem" onClick={()=>{setOpen(false);setDonorOpen(true)}}><span><UserPlus/></span><div><b>הוספת תורם</b><small>פתיחת כרטיס תורם מלא</small></div></button>
      <button role="menuitem" onClick={()=>{setOpen(false);onMovement()}}><span><HandCoins/></span><div><b>הוספת תנועה</b><small>הכנסה או הוצאה חדשה</small></div></button>
    </div>}
    <button className="quick-action-trigger" aria-label={open?"סגירת פעולות מהירות":"פתיחת פעולות מהירות"} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Plus/></button>
  </div><DonorFormDialog open={donorOpen} onOpenChange={setDonorOpen}/></>;
}
