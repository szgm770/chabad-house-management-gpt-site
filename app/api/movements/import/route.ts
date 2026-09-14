import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, auditLog, donations, importRuns } from "@/db/schema";
import { ingestMovement, type MovementInput } from "@/app/api/movements/ingest";
import { getChatGPTUser } from "@/app/chatgpt-auth";

type Body={filename?:string;fingerprint?:string;rows?:MovementInput[];chunkIndex?:number;totalChunks?:number;totalRows?:number};
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

const isMovementImport=(source:string)=>{
  const normalized=source.trim().toLowerCase();
  return normalized!=="donors-file"&&normalized!=="donors";
};

export async function GET(){
  try{
    if(!await requireManager())return Response.json({error:"הפעולה זמינה למנהל המערכת בלבד"},{status:403});
    const db=getDb();
    const [allRuns,importedMovements]=await Promise.all([
      db.select().from(importRuns).orderBy(desc(importRuns.id)).limit(300),
      db.select({fingerprint:donations.importFingerprint,createdAt:donations.createdAt}).from(donations).where(isNotNull(donations.importFingerprint)),
    ]);
    const known=new Set(allRuns.map(run=>run.fingerprint));
    const missing=new Map<string,{count:number;createdAt:string}>();
    for(const movement of importedMovements){
      const fingerprint=movement.fingerprint;
      if(!fingerprint||known.has(fingerprint))continue;
      const current=missing.get(fingerprint)||{count:0,createdAt:movement.createdAt};
      current.count++;if(movement.createdAt<current.createdAt)current.createdAt=movement.createdAt;missing.set(fingerprint,current);
    }
    for(const [fingerprint,group] of missing)await db.insert(importRuns).values({source:"movements-file",filename:`ייבוא תנועות ששוחזר · ${group.createdAt.slice(0,10)}`,fingerprint,rowsTotal:group.count,rowsImported:group.count,rowsSkipped:0,createdAt:group.createdAt}).onConflictDoNothing();
    const runs=(missing.size?await db.select().from(importRuns).orderBy(desc(importRuns.id)).limit(300):allRuns).filter(run=>isMovementImport(run.source)).slice(0,100);
    return Response.json({runs});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"לא ניתן לטעון את היסטוריית הייבוא"},{status:500})}
}

export async function POST(request:Request){
  try{
    const body=await request.json() as Body;
    if(!body.filename||!body.fingerprint||!Array.isArray(body.rows))return Response.json({error:"קובץ הייבוא אינו תקין"},{status:400});
    const db=getDb();
    const previous=await db.select().from(importRuns).where(eq(importRuns.fingerprint,body.fingerprint)).limit(1);
    const chunked=Number.isInteger(body.chunkIndex)&&Number.isInteger(body.totalChunks)&&Number(body.totalChunks)>0;
    const chunkIndex=chunked?Number(body.chunkIndex):0;
    const totalRows=chunked?Math.max(Number(body.totalRows)||body.rows.length,body.rows.length):body.rows.length;
    if(chunked&&chunkIndex>0&&!previous.length)return Response.json({error:"רצף הייבוא הופסק. יש להתחיל את הייבוא מחדש"},{status:409});
    if(previous.length&&(!chunked||chunkIndex===0)){
      const completed=previous[0].rowsTotal>0&&previous[0].rowsImported+previous[0].rowsSkipped>=previous[0].rowsTotal;
      if(completed&&previous[0].rowsImported>0)return Response.json({error:"הקובץ הזה כבר יובא בעבר",duplicate:true},{status:409});
      await db.delete(donations).where(eq(donations.importFingerprint,body.fingerprint));
      await db.delete(importRuns).where(eq(importRuns.id,previous[0].id));
    }
    if(chunked&&chunkIndex===0)await db.insert(importRuns).values({source:"movements-file",filename:body.filename,fingerprint:body.fingerprint,rowsTotal:totalRows,rowsImported:0,rowsSkipped:0});
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
    if(chunked){
      const current=(await db.select().from(importRuns).where(eq(importRuns.fingerprint,body.fingerprint)).limit(1))[0];
      await db.update(importRuns).set({rowsImported:(current?.rowsImported||0)+imported,rowsSkipped:(current?.rowsSkipped||0)+skipped+duplicates}).where(eq(importRuns.fingerprint,body.fingerprint));
    }else{
      await db.insert(importRuns).values({source:"movements-file",filename:body.filename,fingerprint:body.fingerprint,rowsTotal:totalRows,rowsImported:imported,rowsSkipped:skipped+duplicates});
    }
    return Response.json({imported,skipped,matched,created,review,duplicates,errors:Object.entries(errors).map(([reason,count])=>({reason,count}))});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"שגיאה"},{status:500})}
}

export async function DELETE(request:Request){
  try{
    if(!await requireManager())return Response.json({error:"הפעולה זמינה למנהל המערכת בלבד"},{status:403});
    const body=await request.json() as {id?:number};
    if(!body.id)return Response.json({error:"לא נבחר גל ייבוא"},{status:400});
    const db=getDb();
    const runs=await db.select().from(importRuns).where(eq(importRuns.id,Number(body.id))).limit(1);
    if(!runs.length||!isMovementImport(runs[0].source))return Response.json({error:"גל הייבוא לא נמצא"},{status:404});
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
