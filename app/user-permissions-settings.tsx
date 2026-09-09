"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Save, ShieldCheck, Trash2, UserRound, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type RoleKey = "admin" | "manager" | "finance" | "relations" | "viewer";
type UserStatus = "active" | "inactive";
type AccessUser = { id: string; name: string; email: string; role: RoleKey; status: UserStatus };
type Permissions = Record<RoleKey, Record<string, boolean>>;
const areas = [["dashboard","לוח בקרה"],["donors","תורמים"],["transactions","תנועות"],["reviews","סקירות"],["attention","דורש טיפול"],["settings","הגדרות"],["exports","ייצוא וגיבוי"]] as const;
const roles: Array<{key:RoleKey;label:string;detail:string}> = [
  {key:"admin",label:"מנהל מערכת",detail:"גישה מלאה לכל המערכת וההגדרות"},
  {key:"manager",label:"מנהל",detail:"ניהול שוטף ללא הגדרות רגישות"},
  {key:"finance",label:"כספים",detail:"תנועות, תרומות, דוחות וייצוא"},
  {key:"relations",label:"קשרי תורמים",detail:"תורמים, שימור קשר וסקירות"},
  {key:"viewer",label:"צפייה בלבד",detail:"צפייה בנתונים ללא שינוי"},
];
const defaultPermissions:Permissions={
  admin:Object.fromEntries(areas.map(([key])=>[key,true])),
  manager:{dashboard:true,donors:true,transactions:true,reviews:true,attention:true,settings:false,exports:true},
  finance:{dashboard:true,donors:true,transactions:true,reviews:false,attention:true,settings:false,exports:true},
  relations:{dashboard:true,donors:true,transactions:false,reviews:true,attention:true,settings:false,exports:false},
  viewer:{dashboard:true,donors:true,transactions:true,reviews:true,attention:true,settings:false,exports:false},
};
const emptyForm={id:"",name:"",email:"",role:"viewer" as RoleKey,status:"active" as UserStatus};

export default function UserPermissionsSettings(){
 const[users,setUsers]=useState<AccessUser[]>([]),[permissions,setPermissions]=useState<Permissions>(defaultPermissions),[form,setForm]=useState(emptyForm),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const roleMap=useMemo(()=>new Map(roles.map(role=>[role.key,role.label])),[]);
 useEffect(()=>{fetch("/api/settings").then(r=>r.json()).then(data=>{try{if(data.settings?.access_users)setUsers(JSON.parse(data.settings.access_users))}catch{}try{if(data.settings?.access_permissions)setPermissions({...defaultPermissions,...JSON.parse(data.settings.access_permissions)})}catch{}}).catch(()=>setNotice("לא ניתן לטעון את הגדרות המשתמשים כרגע."))},[]);
 async function persist(nextUsers=users,nextPermissions=permissions){setBusy(true);setNotice("");try{const r=await fetch("/api/settings",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({access_users:JSON.stringify(nextUsers),access_permissions:JSON.stringify(nextPermissions),access_enforcement:"enabled"})});const result=await r.json().catch(()=>({}));if(!r.ok)throw new Error(String(result.error||"לא ניתן לשמור את ההגדרות."));if(Array.isArray(result.accessUsers))setUsers(result.accessUsers);setNotice("הגדרות המשתמשים וההרשאות נשמרו.");return true}catch(error){setNotice(error instanceof Error?error.message:"לא ניתן לשמור את הגדרות המשתמשים כרגע.");return false}finally{setBusy(false)}}
 function openNew(){setForm(emptyForm);setEditing(true);setNotice("")}
 function openEdit(user:AccessUser){setForm(user);setEditing(true);setNotice("")}
 async function saveUser(){const name=form.name.trim(),email=form.email.trim().toLowerCase();if(!name||!/^\S+@\S+\.\S+$/.test(email)){setNotice("יש להזין שם וכתובת דוא״ל תקינה.");return}if(users.some(user=>user.email.toLowerCase()===email&&user.id!==form.id)){setNotice("כתובת הדוא״ל כבר נמצאת ברשימת המשתמשים.");return}const user={...form,id:form.id||crypto.randomUUID(),name,email},next=form.id?users.map(item=>item.id===form.id?users.map(item=>item.id===form.id?user:item):[...users,user];if(await persist(next,permissions))setEditing(false)}
 function removeUser(id:string){if(!window.confirm("להסיר את המשתמש מרשימת המורשים? ניתן להוסיף אותו מחדש בהמשך."))return;const next=users.filter(user=>user.id!==id);setUsers(next);void persist(next,permissions)}
 function togglePermission(role:RoleKey,area:string){if(role==="admin")return;setPermissions(current=>({...current,[role]:{...current[role],[area]:!current[role]?.[area]}}))}
 return <div className="user-access-settings">{notice&&<div className="save-notice"><Check/>{notice}</div>}
  <section className="access-mode-notice"><ShieldCheck/><div><h2>הכניסה מוגנת</h2><p>רק משתמשים פעילים ברשימה יכולים להיכנס באמצעות חשבון Google עם אותה כתובת דוא״ל.</p></div><span>פעיל</span></section>
  <section className="config-panel access-users-panel"><div className="panel-head"><div><h2>משתמשים מורשים</h2><p>רשימת האנשים שיוכלו להיכנס והתפקיד המיועד לכל אחד.</p></div><Button onClick={openNew}><Plus/>הוספת משתמש</Button></div>{users.length?<div className="access-user-list">{users.map(user=><article key={user.id}><span className="access-avatar"><UserRound/></span><div><b>{user.name}</b><small>{user.email}</small></div><em className={user.status}>{user.status==="active"?"פעיל":"מושבת"}</em><strong>{roleMap.get(user.role)}</strong><div className="access-user-actions"><button aria-label={`עריכת ${user.name}`} onClick={()=>openEdit(user)}><Pencil/></button><button className="danger" aria-label={`הסרת ${user.name}`} onClick={()=>removeUser(user.id)}><Trash2/></button></div></article>)}</div>:<div className="access-empty"><UsersRound/><h3>עדיין לא הוגדרו משתמשים</h3><p>הוסף משתמש ראשון כדי לקבוע מי רשאי להיכנס.</p><Button variant="outline" onClick={openNew}><Plus/>הוספת משתמש ראשון</Button></div>}</section>
  <section className="config-panel role-permissions-panel"><div className="panel-head"><div><h2>תפקידים והרשאות</h2><p>קבעו לאילו אזורים יוכל כל תפקיד לגשת. מנהל מערכת נשאר בעל גישה מלאה.</p></div><Button disabled={busy} onClick={()=>void persist()}><Save/>{busy?"שומר…":"שמירת הרשאות"}</Button></div><div className="permissions-scroll"><table><thead><tr><th>אזור במערכת</th>{roles.map(role=><th key={role.key}><b>{role.label}</b><small>{role.detail}</small></th>)}</tr></thead><tbody>{areas.map(([key,label])=><tr key={key}><th>{label}</th>{roles.map(role=><td key={role.key}><button type="button" disabled={role.key==="admin"} className={permissions[role.key]?.[key]?"allowed":"denied"} aria-label={`${label} — ${role.label}`} aria-pressed={Boolean(permissions[role.key]?.[key])} onClick={()=>togglePermission(role.key,key)}>{permissions[role.key]?.[key]?<Check/>:<X/>}</button></td>)}</tr>)}</tbody></table></div></section>
  {editing&&<div className="access-editor" role="dialog" aria-modal="true" aria-labelledby="access-editor-title"><button className="access-editor-backdrop" aria-label="סגירת החלון" onClick={()=>setEditing(false)}/><div className="access-editor-card"><div className="access-editor-head"><div><h2 id="access-editor-title">{form.id?"עריכת משתמש":"הוספת משתמש"}</h2><p>לאחר השמירה המשתמש יוכל להיכנס עם חשבון Google בעל כתובת דוא״ל זו.</p></div><button aria-label="סגירה" onClick={()=>setEditing(false)}><X/></button></div><div className="access-editor-fields"><label><span>שם מלא *</span><input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label><span>כתובת דוא״ל *</span><input type="email" dir="ltr" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label><span>תפקיד</span><select value={form.role} onChange={e=>setForm({...form,role:e.target.value as RoleKey})}>{roles.map(role=><option key={role.key} value={role.key}>{role.label}</option>)}</select></label><label><span>מצב</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value as UserStatus})}><option value="active">פעיל</option><option value="inactive">מושבת</option></select></label></div><div className="dialog-actions"><Button variant="outline" onClick={()=>setEditing(false)}>ביטול</Button><Button disabled={busy} onClick={()=>void saveUser()}>{busy?"שומר…":"שמירת משתמש"}</Button></div></div></div>}
 </div>
}
