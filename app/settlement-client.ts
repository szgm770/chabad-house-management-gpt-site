type Entry={expires:number;promise:Promise<any>};
const cache=new Map<string,Entry>();
export function loadSettlements(query:string,refresh=false){
  const key=`/api/settlements?${query}`,now=Date.now(),found=cache.get(key);
  if(!refresh&&found&&found.expires>now)return found.promise;
  const promise=fetch(key).then(async r=>{if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||"לא ניתן לטעון את נתוני הכספים");return r.json()}).catch(error=>{cache.delete(key);throw error});
  cache.set(key,{expires:now+30_000,promise});
  return promise;
}
export function clearSettlementCache(){cache.clear()}
