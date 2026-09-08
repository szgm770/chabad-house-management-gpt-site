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

export function formatHebrewDate(value:string|Date){
  const date=value instanceof Date?value:new Date(`${value}T12:00:00`);
  if(Number.isNaN(date.getTime()))return "";
  const parts=new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"}).formatToParts(date);
  const day=Number(parts.find(part=>part.type==="day")?.value||0);
  const month=parts.find(part=>part.type==="month")?.value||"";
  const year=Number(parts.find(part=>part.type==="year")?.value||0);
  return `${hebrewNumeral(day)} ב${month} ${hebrewNumeral(year,{year:true})}`;
}
