const letters:[number,string][]=[
  [400,"ת"],[300,"ש"],[200,"ר"],[100,"ק"],[90,"צ"],[80,"פ"],[70,"ע"],[60,"ס"],[50,"נ"],[40,"מ"],[30,"ל"],[20,"כ"],[10,"י"],[9,"ט"],[8,"ח"],[7,"ז"],[6,"ו"],[5,"ה"],[4,"ד"],[3,"ג"],[2,"ב"],[1,"א"],
];

function punctuation(value:string){
  if(value.length===1)return `${value}׳`;
  return `${value.slice(0,-1)}״${value.slice(-1)}`;
}

export function hebrewNumeral(input:number,{year=false}:{year?:boolean}={}){
  let number=Math.max(0,Math.trunc(input));
  if(year&&number>=5000)number%=1000;
  if(number===15)return "ט״ו";
  if(number===16)return "ט״ז";
  let result="";
  for(const[value,letter]of letters){while(number>=value){result+=letter;number-=value}}
  return result?punctuation(result):"";
}

export function parseAppDate(value:string|Date){
  if(value instanceof Date)return Number.isNaN(value.getTime())?null:value;
  const raw=String(value||"").trim();
  if(!raw)return null;
  const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const local=raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  const normalized=iso
    ? `${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`
    : local
      ? `${local[3]}-${local[2].padStart(2,"0")}-${local[1].padStart(2,"0")}`
      : raw;
  const date=new Date(normalized.includes("T")?normalized:`${normalized}T12:00:00`);
  return Number.isNaN(date.getTime())?null:date;
}

export function normalizeAppDate(value:string|Date){
  const date=parseAppDate(value);
  if(!date)return "";
  const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

export function formatCivilDate(value:string|Date){
  const date=parseAppDate(value);
  if(!date)return "תאריך לא זמין";
  return new Intl.DateTimeFormat("he-IL",{day:"numeric",month:"long",year:"numeric"}).format(date);
}

export function formatHebrewDate(value:string|Date){
  const date=parseAppDate(value);
  if(!date)return "תאריך לא זמין";
  const parts=new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"}).formatToParts(date);
  const day=Number(parts.find(part=>part.type==="day")?.value||0);
  const month=parts.find(part=>part.type==="month")?.value||"";
  const year=Number(parts.find(part=>part.type==="year")?.value||0);
  return `${hebrewNumeral(day)} ב${month} ${hebrewNumeral(year,{year:true})}`;
}
