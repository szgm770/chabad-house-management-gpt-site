import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentDeclines } from "@/db/schema";
import { normalizeNedarimDateTime, normalizeNedarimPayload, readWebhookPayload, requireNedarimSource } from "@/lib/webhook-security";

export async function POST(request:Request){
  try{
    requireNedarimSource(request);
    const p=normalizeNedarimPayload(await readWebhookPayload(request));
    if(p.Status&&p.Status!=="Error")return Response.json({error:"העדכון אינו מסומן כסירוב"},{status:400});
    const dedupeId=[p.KevaId||p.Param1||p.Param2||"transaction",p.ErrorTime||"",p.Message||""].join(":");
    const db=getDb(),existing=await db.select({id:paymentDeclines.id}).from(paymentDeclines).where(and(eq(paymentDeclines.source,"nedarim-plus"),eq(paymentDeclines.externalId,dedupeId))).limit(1);
    if(existing.length)return Response.json({ok:true,duplicate:true,id:existing[0].id});
    const safe=Object.fromEntries(Object.entries(p).filter(([key])=>!["Tokef"].includes(key)));
    const[decline]=await db.insert(paymentDeclines).values({source:"nedarim-plus",externalId:dedupeId,recurringId:p.KevaId||null,donorName:p.ClientName||"",phone:p.Phone||"",email:p.Mail||"",idNumber:p.Zeout||"",amount:Number(p.Amount||0),currency:p.Currency==="2"?"USD":"ILS",message:p.Message||"סירוב עסקה",declineSource:p.Source||"Transaction",occurredAt:normalizeNedarimDateTime(p.ErrorTime),rawJson:JSON.stringify(safe)}).returning();
    return Response.json({ok:true,id:decline.id,WEBDocID:decline.id},{status:201});
  }catch(e){return Response.json({error:e instanceof Error?e.message:"שגיאה"},{status:400})}
}
