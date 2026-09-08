import { validSettlementRules } from "@/app/validate-settlement-rules";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";
export async function GET(){try{const rows=await getDb().select().from(appSettings);return Response.json({settings:Object.fromEntries(rows.map(r=>[r.key,r.value]))})}catch(e){return Response.json({error:e instanceof Error?e.message:"שגיאה"},{status:500})}}
export async function PUT(request:Request){try{const payload=await request.json() as Record<string,string>;if(payload.settlement_rules!==undefined&&!validSettlementRules(payload.settlement_rules))return Response.json({error:"יש לבדוק את אמצעי התשלום ומועדי הזיכוי"},{status:400});const db=getDb();for(const [key,value] of Object.entries(payload)){const found=await db.select({key:appSettings.key}).from(appSettings).where(eq(appSettings.key,key)).limit(1);if(found.length)await db.update(appSettings).set({value,updatedAt:new Date().toISOString()}).where(eq(appSettings.key,key));else await db.insert(appSettings).values({key,value})}return Response.json({ok:true})}catch(e){return Response.json({error:e instanceof Error?e.message:"שגיאה"},{status:500})}}
