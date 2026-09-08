"use client";
import { useState } from "react";
import { Building2, CreditCard, Database, Link2, SlidersHorizontal, UsersRound } from "lucide-react";
import SettlementSettings from "./settlement-settings";
import SettingsCenter from "./settings-center";
import WebhookAddresses from "./webhook-addresses";
import MovementCategorySettings from "./movement-category-settings";
import BrandSettings from "./brand-settings";
import DataMaintenance from "./data-maintenance";
import RelationshipPrioritySettings from "./relationship-priority-settings";
import UserPermissionsSettings from "./user-permissions-settings";
type Topic="general"|"finance"|"automation"|"integrations"|"users"|"data";
const topics=[{id:"general" as Topic,label:"כללי",icon:Building2},{id:"finance" as Topic,label:"כספים",icon:CreditCard},{id:"automation" as Topic,label:"אוטומציות",icon:SlidersHorizontal},{id:"integrations" as Topic,label:"אינטגרציות",icon:Link2},{id:"users" as Topic,label:"הרשאות",icon:UsersRound},{id:"data" as Topic,label:"נתונים",icon:Database}];
export default function SettingsHub({initial="general"}:{initial?:Topic}){const[topic,setTopic]=useState<Topic>(initial);return <div className="settings-hub settings-clean"><nav className="settings-topics" aria-label="נושאי הגדרות">{topics.map(t=><button key={t.id} aria-label={t.label} aria-current={topic===t.id?"page":undefined} className={topic===t.id?"active":""} onClick={()=>setTopic(t.id)}><t.icon/><span>{t.label}</span></button>)}</nav><div className={`settings-topic topic-${topic}`}>{topic==="integrations"&&<WebhookAddresses/>}{topic==="users"?<UserPermissionsSettings/>:topic==="general"?<><SettingsCenter/><BrandSettings/></>:<><SettingsCenter advanced/>{topic==="finance"&&<><SettlementSettings/><MovementCategorySettings/></>}{topic==="automation"&&<RelationshipPrioritySettings/>}{topic==="data"&&<DataMaintenance/>}</>}</div></div>}
