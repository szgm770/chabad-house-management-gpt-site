import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { donations, donorCards, people } from "@/db/schema";

const headers=["סוג תנועה","מזהה כרטיס תורם","מזהה אדם","שם התורם / עבור מה ההוצאה","תעודת זהות","טלפון","דוא״ל","כתובת","סכום","מטבע","תאריך לועזי","אמצעי תשלום","מחלקה ראשית","קטגוריית משנה","תנועה קבועה","הערות","מזהה חיצוני","מקור"];
const cell=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;

export async function GET(){
  try{
    const rows=await getDb().select({movement:donations,card:donorCards,person:people}).from(donations).leftJoin(donorCards,eq(donations.donorId,donorCards.id)).leftJoin(people,eq(donations.personId,people.id)).orderBy(desc(donations.date),desc(donations.id));
    const data=rows.map(({movement:row,card,person})=>[row.movementType==="expense"?"הוצאה":"הכנסה",row.donorId||"",row.personId||"",row.donorName,person?.idNumber||card?.idNumber||"",person?.phone||card?.phone||"",person?.email||card?.email||"",person?.postalAddress||card?.address||"",row.amount,row.currency,row.date,row.paymentMethod,row.department,row.subcategory,row.isRecurring?"כן":"לא",row.reason,row.externalId||"",row.source]);
    const csv="\ufeff"+[headers,...data].map(row=>row.map(cell).join(",")).join("\r\n");
    return new Response(csv,{headers:{"content-type":"text/csv;charset=utf-8","content-disposition":`attachment; filename="movements-${new Date().toISOString().slice(0,10)}.csv"`}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"שגיאה"},{status:500})}
}
