import { getDb } from "@/db";
import { appSettings, attentionItems, auditLog, donations, donorCards, duplicateDecisions, engagements, feedbackItems, importRuns, mergeEvents, paymentDeclines, people, recurringCommitments, reviewRecipients, reviews, specialDates, tasks } from "@/db/schema";

export async function GET(){
  try{
    const db=getDb();
    const [donors,peopleRows,movements,reviewsRows,recipients,tasksRows,engagementRows,dates,settings,imports,audit,recurring,attention,declines,duplicateHistory,merges,feedback]=await Promise.all([
      db.select().from(donorCards),db.select().from(people),db.select().from(donations),db.select().from(reviews),db.select().from(reviewRecipients),db.select().from(tasks),db.select().from(engagements),db.select().from(specialDates),db.select().from(appSettings),db.select().from(importRuns),db.select().from(auditLog),db.select().from(recurringCommitments),db.select().from(attentionItems),db.select().from(paymentDeclines),db.select().from(duplicateDecisions),db.select().from(mergeEvents),db.select().from(feedbackItems)
    ]);
    return Response.json({exportedAt:new Date().toISOString(),version:2,data:{donors,people:peopleRows,movements,reviews:reviewsRows,reviewRecipients:recipients,tasks:tasksRows,engagements:engagementRows,specialDates:dates,settings,imports,audit,recurring,attention,declines,duplicateHistory,merges,feedback}},{headers:{"content-disposition":`attachment; filename="chabad-full-backup-${new Date().toISOString().slice(0,10)}.json`}})
  }catch(e){return Response.json({error:e instanceof Error?e.message:"שגיאה"},{status:500})}
}
