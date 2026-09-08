import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentDeclines } from "@/db/schema";
export async function GET(){try{return Response.json({declines:await getDb().select().from(paymentDeclines).orderBy(desc(paymentDeclines.id)).limit(500)})}catch(e){return Response.json({error:e instanceof Error?e.message:"שגיאה"},{status:500})}}
export async function PATCH(request:Request){try{const p=await request.json() as {id?:number;handled?:boolean};if(!p.id)return Response.json({error:"מזהה חסר"},{status:400});await getDb().update(paymentDeclines).set({handled:!!p.handled,handledAt:p.handled?new Date().toISOString():null}).where(eq(paymentDeclines.id,p.id));return Response.json({ok:true})}catch(e){return Response.json({error:e instanceof Error?e.message:"שגיאה"},{status:500})}}
export async function DELETE(request:Request){try{const id=Number(new URL(request.url).searchParams.get("id"));if(!id)return Response.json({error:"מזהה חסר"},{status:400});await getDb().delete(paymentDeclines).where(eq(paymentDeclines.id,id));return Response.json({ok:true})}catch(e){return Response.json({error:e instanceof Error?e.message:"שגיאה"},{status:500})}}
