"use client";
import { useState } from "react";
import { ArrowRight, Building2, ChevronLeft, CreditCard, Database, Link2, Settings2, SlidersHorizontal, UsersRound } from "lucide-react";
import SettlementSettings from "./settlement-settings";
import SettingsCenter from "./settings-center";
import WebhookAddresses from "./webhook-addresses";
import MovementCategorySettings from "./movement-category-settings";
import BrandSettings from "./brand-settings";
import DataMaintenance from "./data-maintenance";
import RelationshipPrioritySettings from "./relationship-priority-settings";
import UserPermissionsSettings from "./user-permissions-settings";
type Topic="general"|"finance"|"automation"|"integrations"|"users"|"data";
const topics=[{id:"general" as Topic,label:"כללי",detail:"פרטי המוסד וברירות מחדל",icon:Building2},{id:"finance" as Topic,label:"כספים",detail:"עמלות, זיכויים וקטגוריות",icon:CreditCard},{id:"automation" as Topic,label:"אוטומציות",detail:"התראות וסדרי עדיפויות",icon:SlidersHorizontal},{id:"integrations" as Topic,label:"חיבורים",detail:"Webhooks ושירותים חיצוניים",icon:Link2},{id:"users" as Topic,label:"משתמשים",detail:"גישה, תפקידים והרשאות",icon:UsersRound},{id:"data" as Topic,label:"נתונים",detail:"תקינות ותחזוקת המידע",icon:Database}];
export default function SettingsHub({initial="general"}:{initial?:Topic}){
 const[topic,setTopic]=useState<Topic>(initial),[mobileOpen,setMobileOpen]=useState(false),current=topics.find(x=>x.id===topic)!;const CurrentIcon=current.icon;
 const choose=(next:Topic)=>{setTopic(next);setMobileOpen(true);window.scrollTo({top:0,behavior:"smooth"})};
 return <div className={`settings-hub settings-clean ${mobileOpen?"mobile-topic-open":""}`}>
  <header className="settings-page-head"><span><Settings2/></span><div><h2>הגדרות</h2><p>ניהול המערכת במקום אחד</p></div></header>
  <div className="settings-layout"><nav className="settings-topics" aria-label="נושאי הגדרות">{topics.map(t=><button key={t.id} aria-current={topic===t.id?"page":undefined} className={topic===t.id?"active":""} onClick={()=>choose(t.id)}><t.icon/><span><b>{t.label}</b><small>{t.detail}</small></span><ChevronLeft className="topic-chevron"/></button>)}</nav>
   <main className={`settings-topic topic-${topic}`}><button className="settings-mobile-back" onClick={()=>setMobileOpen(false)}><ArrowRight/>כל ההגדרות</button><div className="settings-section-head"><CurrentIcon/><div><h2>{current.label}</h2><p>{current.detail}</p></div></div>{topic==="general"&&<><SettingsCenter section="general"/><BrandSettings/></>}{topic==="finance"&&<><SettingsCenter section="finance"/><SettlementSettings/><MovementCategorySettings/></>}{topic==="automation"&&<><SettingsCenter section="automation"/><RelationshipPrioritySettings/></>}{topic==="integrations"&&<WebhookAddresses/>}{topic==="users"&&<UserPermissionsSettings/>}{topic==="data"&&<DataMaintenance/>}</main>
  </div>
 </div>
}
