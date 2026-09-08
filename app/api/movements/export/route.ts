import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { donations } from "@/db/schema";

const headers=["סוג תנועה","שם התורם / עבור מה ההוצאה","סכום","מטבע","תאריך לועזי","אמצעי תשלום","מחלקה ראשית","קטגוריית משנה","תנועה קבועה","הערות","מזהה חיצוני","מקור"];
const cell=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;

export async function GET(){
  try{
    const rows=await getDb().select().from(donations).orderBy(desc(donations.date),desc(donations.id));
    const data=rows.map(row=>[row.movementType==="expense"?"הוצאה":"הכנסה",row.donorName,row.amount,row.currency,row.date,row.paymentMethod,row.department,row.subcategory,row.isRecurring?"כן":"לא",row.reason,row.externalId||"",row.source]);
    const csv="\ufeff"+[headers,...data].map(row=>row.map(cell).join(",")).join("\r\n");
    return new Response(csv,{headers:{"content-type":"text/csv;charset=utf-8","content-disposition":`attachment; filename="movements-${new Date().toISOString().slice(0,10)}.csv"`}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"שגיאה"},{status:500})}
}
