export type FeeSettings=Record<string,string|undefined>;

export function feeRate(paymentMethod:string,settings:FeeSettings){
  const value=(paymentMethod||"").trim().toLowerCase();
  const key=value.includes("ביט")||value.includes("bit")?"bit_fee":value.includes("אשראי")||value.includes("credit")||value.includes("card")?"credit_fee":value.includes("העברה")||value.includes("bank")?"bank_fee":"";
  const rate=key?Number(settings[key]||0):0;
  return Number.isFinite(rate)&&rate>0?rate:0;
}

export function netAmount(amount:number,paymentMethod:string,settings:FeeSettings){
  const rate=feeRate(paymentMethod,settings);
  const fee=Math.round(amount*rate)/100;
  return {rate,fee,net:Math.max(0,Math.round((amount-fee)*100)/100)};
}
