import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, auditLog, donations, importRuns } from "@/db/schema";
import { ingestMovement, type MovementInput } from "@/app/api/movements/ingest";
import { getChatGPTUser } from "@/app/chatgpt-auth";

type Body={filename?:string;fingerprint?:string;rows?:MovementInput[]};
type AccessUser={email?:string;role?:string;status?:string};

async function requireManager(){
  const user=await getChatGPTUser();
  if(!user)return false;
  const rows=await getDb().select().from(appSettings).where(eq(appSettings.key,"access_users")).limit(1);
  try{
    const users=JSON.parse(rows[0]?.value||"[]") as AccessUser[];
    return users.some(item=>item.email?.toLowerCase()===user.email?.toLowerCase()&&item.role==="admin"&&item.status==="active");
  }catch{return false}
}

export async function GET(){
  try{
    if(!await requireManager())return Response.json({error:"הפעולה זמינה למנהל המערכת בלבד"},{status:403});
    const runs=await getDb().select().from(importRuns).where(eq(importRuns.source,"movements-file")).orderBy(desc(importRuns.id)).limit(100);
    return Response.json({runs});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"לא ניתן לטעון את היסטוריית הייבוא"},{status:500})}
}

export async function POST(request:Request){
  try{
    const body=await request.json() as Body;
    if(!body.filename||!body.fingerprint||!Array.isArray(body.rows))return Response.json({error:"קובץ הייבוא אינו תקין"},{status:400});
    const db=getDb();
    const previous=await db.select().from(importRuns).where(eq(importRuns.fingerprint,body.fingerprint)).limit(1);
    if(previous.length&&previous[0].rowsImported>0)return Response.json({error:"הקובץ הזה כבר יובא בעבר",duplicate:true},{status:409});
    if(previous.length)await db.delete(importRuns).where(eq(importRuns.id,previous[0].id));
    let imported=0,skipped=0,matched=0,created=0,review=0,duplicates=0;
    const errors:Record<string,number>={};
    for(const row of body.rows.slice(0,5000)){
      try{
        const result=await ingestMovement({...row,source:"file",importFingerprint:body.fingerprint});
        if(result.duplicate){duplicates++;continue}
        imported++;
        if(result.donorAction==="created")created++;else if(result.donorAction==="review")review++;else if(result.donorAction==="matched")matched++;
      }catch(error){
        skipped++;
        const reason=error instanceof Error?error.message:"שגיאה לא ידועה";
        errors[reason]=(errors[reason]||0)+1;
      }
    }
    await db.insert(importRuns).values({source:"movements-file",filename:body.filename,fingerprint:body.fingerprint,rowsTotal:body.rows.length,rowsImported:imported,rowsSkipped:skipped});
    return Response.json({imported,skipped,matched,created,review,duplicates,errors:Object.entries(errors).map(([reason,count])=>({reason,count}))});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"שגיאה"},{status:500})}
}

export async function DELETE(request:Request){
  try{
    if(!await requireManager())return Response.json({error:"הפעולה זמינה למנהל המערכת בלבד"},{status:403});
    const body=await request.json() as {id?:number};
    if(!body.id)return Response.json({error:"לא נבחר גל ייבוא"},{status:400});
    const db=getDb();
    const runs=await db.select().from(importRuns).where(and(eq(importRuns.id,Number(body.id)),eq(importRuns.source,"movements-file"))).limit(1);
    if(!runs.length)return Response.json({error:"גל הייבוא לא נמצא"},{status:404});
    const run=runs[0];
    const movements=await db.select({id:donations.id}).from(donations).where(eq(donations.importFingerprint,run.fingerprint));
    const ids=movements.map(item=>String(item.id));
    for(let index=0;index<ids.length;index+=100){
      const chunk=ids.slice(index,index+100);
      if(chunk.length)await db.delete(auditLog).where(and(eq(auditLog.entityType,"movement"),inArray(auditLog.entityId,chunk)));
    }
    await db.delete(donations).where(eq(donations.importFingerprint,run.fingerprint));
    await db.delete(importRuns).where(eq(importRuns.id,run.id));
    await db.insert(auditLog).values({action:"movement_import_rolled_back",entityType:"import_run",entityId:String(run.id),details:JSON.stringify({filename:run.filename,fingerprint:run.fingerprint,deletedMovements:movements.length})});
    return Response.json({deleted:movements.length,filename:run.filename});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"לא ניתן לבטל את הייבוא"},{status:500})}
}
