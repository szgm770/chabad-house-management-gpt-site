export type RelationshipGroup = { key:string; label:string; rank:number|null; source:"automatic"|"manual" };

export const defaultRelationshipGroups:RelationshipGroup[] = [
  {key:"active_campaign",label:"קמפיין פעיל",rank:1,source:"automatic"},
  {key:"recurring_active",label:"הו״ק פעילה החודש",rank:2,source:"automatic"},
  {key:"recurring_increase",label:"הגדלת סכום הו״ק",rank:3,source:"automatic"},
  {key:"recurring_ended",label:"חידוש הו״ק שהסתיימה",rank:4,source:"automatic"},
  {key:"recent_donor",label:"תורמים לאחרונה",rank:5,source:"automatic"},
  {key:"community",label:"קהילה",rank:6,source:"manual"},
  {key:"local_acquaintances",label:"מכרים מהאזור",rank:7,source:"manual"},
  {key:"chabad_beit_shemesh",label:"חב״ד בית שמש",rank:8,source:"manual"},
  {key:"friends_family",label:"חברים ומשפחה",rank:9,source:"manual"},
  {key:"tzach_referrals",label:"פניות מצא״ח",rank:10,source:"manual"},
  {key:"other",label:"כללי נוספים",rank:null,source:"manual"},
];

export const relationshipStatuses = [
  ["needs_contact","צריך לפנות"],["no_answer","התקשרתי — לא ענה"],
  ["follow_up","לחזור בתאריך"],["conversation","שיחה התקיימה"],
  ["increase_requested","ביקשתי הגדלה"],["recurring_renewed","חידש הו״ק"],
  ["donation_increased","הגדיל תרומה"],["donated","תרם"],
  ["handled","טופל"],["not_now","לא מתאים לפנות כרגע"],
] as const;

export const finalRelationshipStatuses = new Set(["recurring_renewed","donation_increased","donated","handled","not_now"]);

export function parseGroups(value:string|null|undefined){try{const parsed=JSON.parse(value||"[]");return Array.isArray(parsed)?parsed.filter(x=>typeof x==="string"):[]}catch{return []}}
