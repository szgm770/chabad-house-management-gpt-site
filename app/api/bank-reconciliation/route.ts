import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, auditLog, bankReconciliations, donations } from "@/db/schema";
import { bankRecurringFees } from "@/app/finance";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdministrator } from "@/lib/access-control";
import { rulesFromSettings, settlementFor, todayInIsrael, validDate } from "@/app/settlement";

const round=(n:number)=>Math.round(n*100)/100;
async function snapshot(date:string,currency:string){
  const db=getDb(),settings=Object.fromEntries((await db.select().from(appSettings)).map(row=>[row.key,row.value]));
  const [previous]=await db.select().from(bankReconciliations).where(and(eq(bankReconciliations.currency,currency),lt(bankReconciliations.date,date))).orderBy(desc(bankReconciliations.date)).limit(1);
  const rows=await db.select().from(donations).where(eq(donations.currency,currency)),rules=rulesFromSettings(settings),from=previous?.date||"0000-00-00";
  let change=0;
  for(const row of rows){
    const expense=row.movementType==="expense",transfer=row.paymentMethod.toLowerCase().includes("העברה")||row.paymentMethod.toLowerCase().includes("bank transfer");
    const effective=expense||transfer?row.actualSettlementDate||row.date:settlementFor(row,rules,date).actual;
    if(!effective||effective<=from||effective>date)continue;
    change+=expense?-(row.amount+(row.feeAmount||0)):row.amount-(row.feeAmount||0);
  }
  return {expectedBalance:round((previous?.actualBalance||0)+change),baseline:previous?{date:previous.date,balance:previous.actualBalance}:null};
}
export async function GET(request:Request){try{const user=await getChatGPTUser();if(!user||!(await isAdministrator(user.email)))return Response.json({error:"המידע זמין למנהל המערכת בלבד"},{status:403});const url=new URL(request.url),date=url.searchParams.get("date")||todayInIsrael(),currency=url.searchParams.get("currency")||"ILS";if(!validDate(date))return Response.json({error:"תאריך לא תקין"},{status:400});const db=getDb(),calculated=await snapshot(date,currency),history=await db.select().from(bankReconciliations).where(eq(bankReconciliations.currency,currency)).orderBy(desc(bankReconciliations.date)).limit(31);return Response.json({...calculated,date,currency,history})}catch{return Response.json({error:"לא ניתן לחשב את יתרת הבנק"},{status:500})}}
export async function POST(request:Request){try{
  const user=await getChatGPTUser();if(!user||!(await isAdministrator(user.email)))return Response.json({error:"הפעולה זמינה למנהל המערכת בלבד"},{status:403});
  const body=await request.json() as Record<string,unknown>,date=String(body.date||todayInIsrael()),currency=String(body.currency||"ILS");if(!validDate(date)||date>todayInIsrael())return Response.json({error:"יש לבחור תאריך תקין שאינו עתידי"},{status:400});const db=getDb();
  if(body.action==="return_fee"){const settings=Object.fromEntries((await db.select().from(appSettings)).map(row=>[row.key,row.value])),fee=bankRecurringFees(settings).returned;const [movement]=await db.insert(donations).values({donorName:"עמלת החזרת הוראת קבע בנקאית",amount:fee,currency,date,paymentMethod:"העברה בנקאית",purpose:"עמלת בנק",reason:String(body.note||"החזרת הוראת קבע"),feePercentage:0,feeAmount:0,netAmount:fee,movementType:"expense",department:"עמלות בנק",subcategory:"החזרת הוראת קבע",source:"manual"}).returning();await db.insert(auditLog).values({action:"bank_return_fee_recorded",entityType:"movement",entityId:String(movement.id),details:JSON.stringify({fee,currency})});return Response.json({movement,fee},{status:201})}
  const actualBalance=Number(body.actualBalance);if(!Number.isFinite(actualBalance))return Response.json({error:"יש להזין יתרה בפועל"},{status:400});const {expectedBalance}=await snapshot(date,currency),difference=round(actualBalance-expectedBalance),matched=Math.abs(difference)<.01,verifiedAt=new Date().toISOString(),values={date,currency,expectedBalance,actualBalance:round(actualBalance),difference,matched,note:String(body.note||""),verifiedBy:user.email,verifiedAt};await db.insert(bankReconciliations).values(values).onConflictDoUpdate({target:[bankReconciliations.date,bankReconciliations.currency],set:values});await db.insert(auditLog).values({action:"bank_reconciliation_saved",entityType:"bank_reconciliation",entityId:`${date}:${currency}`,details:JSON.stringify({expectedBalance,actualBalance,difference,matched})});return Response.json({reconciliation:values})
}catch{return Response.json({error:"לא ניתן לשמור את בדיקת הבנק"},{status:500})}}
