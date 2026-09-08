type CacheRow={value:unknown;at:number;promise?:Promise<unknown>};
const cache=new Map<number,CacheRow>();
const TTL=60_000;

export function getCachedDonorSummary<T>(id:number){const row=cache.get(id);return row&&Date.now()-row.at<TTL?row.value as T:null}
export async function prefetchDonorSummary<T>(id:number,force=false):Promise<T>{
 const existing=cache.get(id);if(!force&&existing&&Date.now()-existing.at<TTL)return existing.value as T;if(existing?.promise)return existing.promise as Promise<T>;
 const promise=fetch(`/api/donors/${id}?section=summary`,{cache:"no-store"}).then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error||"לא ניתן לטעון את הכרטיס");cache.set(id,{value,at:Date.now()});return value}).finally(()=>{const current=cache.get(id);if(current?.promise)cache.delete(id)});
 cache.set(id,{value:existing?.value,at:existing?.at||0,promise});return promise as Promise<T>
}
export function invalidateDonorSummary(id:number){cache.delete(id)}
