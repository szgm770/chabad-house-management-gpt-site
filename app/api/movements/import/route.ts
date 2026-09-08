import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { importRuns } from "@/db/schema";
import { ingestMovement, type MovementInput } from "@/app/api/movements/ingest";

type Body={filename?:string;fingerprint?:string;rows?:MovementInput[]};
export async function POST(request:Request){
  try{
    const body=await request.json() as Body;
    if(!body.filename||!body.fingerprint||!Array.isArray(body.rows))return Response.json({error:"קובץ הייבוא אינו תקין"},{status:400});
    const db=getDb();
    const previous=await db.select().from(importRuns).where(eq(importRuns.fingerprint,body.fingerprint)).limit(1);
    if(previous.length)return Response.json({error:"הקובץ הזה כבר יובא בעבר",duplicate:true},{status:409});
    let imported=0,skipped=0;
    for(const row of body.rows.slice(0,5000)){
      try{await ingestMovement({...row,source:"file"});imported++}catch{skipped++}
    }
    await db.insert(importRuns).values({source:"movements-file",filename:body.filename,fingerprint:body.fingerprint,rowsTotal:body.rows.length,rowsImported:imported,rowsSkipped:skipped});
    return Response.json({imported,skipped});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"שגיאה"},{status:500})}
}
