import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, auditLog, donations, donorCards, people, recurringCommitments, reviewRecipients, reviews } from "@/db/schema";
import { defaultRelationshipGroups, finalRelationshipStatuses, parseGroups } from "@/app/relationship-config";

const safeConfig=(value?:string)=>{try{const parsed=JSON.parse(value||"");return Array.isArray(parsed)&&parsed.length?parsed:defaultRelationshipGroups}catch{return defaultRelationshipGroups}};
const daysAgo=(days:number)=>{const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)};

export async function GET(request:Request){
 try{
  const url=new URL(request.url),db=getDb(),page=Math.max(1,Number(url.searchParams.get("page")||1)),limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||30))),query=(url.searchParams.get("q")||"").trim().toLowerCase(),group=url.searchParams.get("group")||"",status=url.searchParams.get("status")||"",campaignId=Number(url.searchParams.get("campaign")||0),donorCardId=Number(url.searchParams.get("donorCardId")||0),recent=url.searchParams.get("recent")||"365";
  const [cards,personRows,donationStats,recurringRows,activeCampaignRows,settingRows]=await Promise.all([
   db.select().from(donorCards).where(and(sql`${donorCards.status} != 'merged'`,sql`${donorCards.status} != 'archived'`)).limit(5000),
   db.select({id:people.id,donorCardId:people.donorCardId,fullName:people.fullName,phone:people.phone,email:people.email}).from(people),
   db.select({donorCardId:donations.donorId,lastDonationDate:sql<string>`max(${donations.date})`,periodTotal:sql<number>`coalesce(sum(case when ${donations.date} >= date('now','-12 months') then ${donations.amount} else 0 end),0)`,allTotal:sql<number>`coalesce(sum(${donations.amount}),0)`}).from(donations).where(eq(donations.movementType,"donation")).groupBy(donations.donorId),
   db.select().from(recurringCommitments).orderBy(desc(recurringCommitments.createdAt)),
   db.select({reviewId:reviews.id,reviewName:reviews.name,donorCardId:reviewRecipients.donorCardId}).from(reviewRecipients).innerJoin(reviews,eq(reviewRecipients.reviewId,reviews.id)).where(eq(reviews.status,"active")),
   db.select().from(appSettings).where(eq(appSettings.key,"relationship_priority_config")),
  ]);
  const config=safeConfig(settingRows[0]?.value),configMap=new Map(config.map(item=>[item.key,item]));
  const peopleByCard=new Map<number,typeof personRows>();for(const person of personRows){if(!person.donorCardId)continue;peopleByCard.set(person.donorCardId,[...(peopleByCard.get(person.donorCardId)||[]),person])}
  const statsByCard=new Map(donationStats.filter(x=>x.donorCardId).map(x=>[Number(x.donorCardId),x]));
  const recurringByCard=new Map<number,typeof recurringRows>();for(const item of recurringRows)recurringByCard.set(item.donorCardId,[...(recurringByCard.get(item.donorCardId)||[]),item]);
  const campaignsByCard=new Map<number,Array<{id:number;name:string}>>();for(const row of activeCampaignRows){if(!row.donorCardId)continue;const current=campaignsByCard.get(row.donorCardId)||[];if(!current.some(x=>x.id===row.reviewId))current.push({id:row.reviewId,name:row.reviewName});campaignsByCard.set(row.donorCardId,current)}
  let items=cards.map(card=>{
   const persons=peopleByCard.get(card.id)||[],stats=statsByCard.get(card.id),recurring=recurringByCard.get(card.id)||[],campaigns=campaignsByCard.get(card.id)||[],manual=parseGroups(card.manualRelationshipGroups),automatic:string[]=[];
   const active=recurring.find(x=>x.status==="active"),ended=recurring.find(x=>x.status==="ended")||recurring.find(x=>x.endDate&&x.endDate<new Date().toISOString().slice(0,10));
   if(campaigns.length)automatic.push("active_campaign");if(active)automatic.push("recurring_active");if(active&&card.eligibleForRecurringIncrease)automatic.push("recurring_increase");if(ended||card.recurringStatus==="ENDED")automatic.push("recurring_ended");if(stats?.lastDonationDate)automatic.push("recent_donor");
   const relationshipGroups=[...new Set([...automatic,...manual])],ranks=relationshipGroups.map(key=>configMap.get(key)?.rank).filter((rank):rank is number=>typeof rank==="number"),priorityRank=ranks.length?Math.min(...ranks):99,due=card.nextContactDate&&card.nextContactDate<=new Date().toISOString().slice(0,10),recency=stats?.lastDonationDate?Math.max(0,365-Math.floor((Date.now()-new Date(stats.lastDonationDate).getTime())/86400000)):0,priorityScore=(100-priorityRank)*10000+(due?5000:0)+Math.min(4000,Math.round(Number(stats?.periodTotal||0)))+recency;
   return {...card,people:persons,phone:card.phone||persons.find(p=>p.phone)?.phone||"",relationshipGroups,manualRelationshipGroups:manual,automaticRelationshipGroups:automatic,priorityRank,priorityScore,lastDonationDate:stats?.lastDonationDate||null,periodTotal:Number(stats?.periodTotal||0),allTotal:Number(stats?.allTotal||0),recurringStatus:active?"active":ended?"ended":card.recurringStatus.toLowerCase(),recurringAmount:Number(active?.amount||card.recurringAmount||0),campaigns};
  });
  if(donorCardId)items=items.filter(item=>item.id===donorCardId);else items=items.filter(item=>item.relationshipGroups.length||item.nextAction||item.nextContactDate);if(query)items=items.filter(item=>[item.cardName,item.phone,item.email,...item.people.flatMap(p=>[p.fullName,p.phone,p.email])].some(value=>String(value||"").toLowerCase().includes(query)));
  if(group)items=items.filter(item=>item.relationshipGroups.includes(group));if(status==="open")items=items.filter(item=>!finalRelationshipStatuses.has(item.relationshipStatus));else if(status)items=items.filter(item=>item.relationshipStatus===status);if(campaignId)items=items.filter(item=>item.campaigns.some(c=>c.id===campaignId));
  if(group==="recent_donor"&&recent!=="all")items=items.filter(item=>item.lastDonationDate&&item.lastDonationDate>=daysAgo(Number(recent)));
  const sort=url.searchParams.get("sort")||"priority";items.sort((a,b)=>sort==="recent"?(b.lastDonationDate||"").localeCompare(a.lastDonationDate||""):sort==="donations"?b.periodTotal-a.periodTotal:sort==="followup"?(a.nextContactDate||"9999").localeCompare(b.nextContactDate||"9999"):b.priorityScore-a.priorityScore);
  const total=items.length,start=(page-1)*limit,summary=config.map(item=>({...item,count:items.filter(card=>card.priorityRank===item.rank).length}));
  const campaigns=Array.from(new Map(activeCampaignRows.map(row=>[row.reviewId,{id:row.reviewId,name:row.reviewName}])).values());
  return Response.json({items:items.slice(start,start+limit),total,page,limit,summary,config,campaigns});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"שגיאה"},{status:500})}
}

export async function PATCH(request:Request){
 try{
  const body=await request.json() as Record<string,unknown>,id=Number(body.id);if(!id)return Response.json({error:"מזהה כרטיס חסר"},{status:400});
  const patch:Record<string,unknown>={};if(Array.isArray(body.manualRelationshipGroups))patch.manualRelationshipGroups=JSON.stringify(body.manualRelationshipGroups);if(typeof body.relationshipStatus==="string")patch.relationshipStatus=body.relationshipStatus;if(typeof body.nextAction==="string")patch.nextAction=body.nextAction;if(body.nextFollowUpDate!==undefined)patch.nextContactDate=body.nextFollowUpDate||null;if(typeof body.relationshipNotes==="string")patch.relationshipNotes=body.relationshipNotes;if(typeof body.relationshipHandledBy==="string")patch.relationshipHandledBy=body.relationshipHandledBy;if(typeof body.eligibleForRecurringIncrease==="boolean")patch.eligibleForRecurringIncrease=body.eligibleForRecurringIncrease;
  const db=getDb();const [card]=await db.update(donorCards).set(patch).where(eq(donorCards.id,id)).returning();await db.insert(auditLog).values({action:"relationship_updated",entityType:"donor_card",entityId:String(id),details:JSON.stringify(patch)});return Response.json({card});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"שגיאה"},{status:500})}
}

export async function PUT(request:Request){
 try{const body=await request.json() as {config?:unknown};if(!Array.isArray(body.config))return Response.json({error:"הגדרת דירוג לא תקינה"},{status:400});const db=getDb(),value=JSON.stringify(body.config);await db.insert(appSettings).values({key:"relationship_priority_config",value}).onConflictDoUpdate({target:appSettings.key,set:{value,updatedAt:new Date().toISOString()}});return Response.json({ok:true})}catch(error){return Response.json({error:error instanceof Error?error.message:"שגיאה"},{status:500})}
}
