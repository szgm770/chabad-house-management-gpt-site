export type FeeSettings=Record<string,string|undefined>;

const positive=(value:unknown,fallback=0)=>{const n=Number(value);return Number.isFinite(n)&&n>=0?n:fallback};
const normalized=(value:string)=>(value||"").trim().toLowerCase();

export function fixedFeeWithVat(base:number,settings:FeeSettings){
  const vat=positive(settings.vat_rate,18);
  return Math.round(base*(1+vat/100)*100)/100;
}

export function bankRecurringFees(settings:FeeSettings){
  return {
    vatRate:positive(settings.vat_rate,18),
    setup:fixedFeeWithVat(positive(settings.bank_recurring_setup_fee,8.6),settings),
    charge:fixedFeeWithVat(positive(settings.bank_recurring_charge_fee,1.7),settings),
    returned:fixedFeeWithVat(positive(settings.bank_recurring_return_fee,22.2),settings),
  };
}

export function feeRate(paymentMethod:string,settings:FeeSettings){
  const value=normalized(paymentMethod);
  const key=value.includes("ביט")||value.includes("bit")?"bit_fee":value.includes("אשראי")||value.includes("credit")||value.includes("card")?"credit_fee":"";
  const rate=key?Number(settings[key]||0):0;
  return Number.isFinite(rate)&&rate>0?rate:0;
}

export function netAmount(amount:number,paymentMethod:string,settings:FeeSettings){
  const value=normalized(paymentMethod);
  if(value.includes("הוראת קבע")||value.includes("bank direct debit")){
    const fee=bankRecurringFees(settings).charge;
    return {rate:0,fee,net:Math.max(0,Math.round((amount-fee)*100)/100)};
  }
  const rate=feeRate(paymentMethod,settings);
  const fee=Math.round(amount*rate)/100;
  return {rate,fee,net:Math.max(0,Math.round((amount-fee)*100)/100)};
}
