export function validSettlementRules(input: string){
 try{const rules=JSON.parse(input);return Array.isArray(rules)&&rules.length<=100&&!rules.some(r=>!r||typeof r.method!=="string"||!r.method.trim()||!["same","days","monthly","next_month","manual"].includes(r.mode)||!Number.isInteger(r.day)||r.day<0||r.day>365||(["monthly","next_month"].includes(r.mode)&&(r.day<1||r.day>31)))&&new Set(rules.map(r=>r.method.trim().toLowerCase())).size===rules.length;}catch{return false}
}
