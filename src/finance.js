const moneyTypes = ['pickup','tips','shipping','operating','investment','refund'];
const financeSum = o => Object.values(o).reduce((a,b)=>a+b,0);
const safeMoney = n => Number.isSafeInteger(n)&&n>=0;
function financeAssert(ok){if(!ok)throw new Error('收支資料不一致');}
const financeDay = (day,opening) => ({day,opening,income:{pickup:0,tips:0,shipping:0},expense:{operating:0,investment:0},refund:0,entries:[],sealed:false,stats:null});
export class Ledger {
 constructor(){this.balance=0;this.lifetimeRevenue=0;this.lifetimeExpenses=0;this.paid=[];this.reports=[];this.archived={days:0,income:0,expense:0,closing:0};this.current=financeDay(1,0);}
 post(id,type,amount,source,night=false,reference=source){
  financeAssert(typeof id==='string'&&id.length<100&&typeof source==='string'&&source.length<100&&typeof reference==='string'&&reference.length<100&&moneyTypes.includes(type)&&safeMoney(amount));
  if(this.current.sealed||this.paid.includes(id))return false;
  const expense=type==='operating'||type==='investment';
  if(expense&&amount>this.balance)return false;
  if(type==='refund'){
   const original=[...this.reports,this.current].flatMap(d=>d.entries).find(e=>e.id===source);
   if(!original||!['operating','investment'].includes(original.type)||amount!==original.amount||[...this.reports,this.current].some(d=>d.entries.some(e=>e.type==='refund'&&e.source===source)))return false;
  }
  const next=this.balance+(expense?-amount:amount);financeAssert(safeMoney(next));
  if(['pickup','tips','shipping'].includes(type)){financeAssert(safeMoney(this.lifetimeRevenue+amount));this.current.income[type]+=amount;this.lifetimeRevenue+=amount;}
  else if(expense){financeAssert(safeMoney(this.lifetimeExpenses+amount));this.current.expense[type]+=amount;this.lifetimeExpenses+=amount;}
  else{financeAssert(this.lifetimeExpenses>=amount);this.current.refund+=amount;this.lifetimeExpenses-=amount;}
  this.balance=next;this.paid.push(id);this.current.entries.push({id,type,amount,source,night:!!night,reference});return true;
 }
 service(orderId,pickup,tip,shipping,night=false,reference=orderId){
  financeAssert(/^O\d+$/.test(orderId)&&[pickup,tip,shipping].every(safeMoney));
  if(this.paid.includes(`${orderId}:base`)||this.current.sealed)return false;
  financeAssert(safeMoney(this.balance+pickup+tip+shipping)&&safeMoney(this.lifetimeRevenue+pickup+tip+shipping));
  this.post(`${orderId}:base`,shipping?'shipping':'pickup',shipping||pickup,orderId,night,reference);
  if(tip)this.post(`${orderId}:tip`,'tips',tip,orderId,night,reference);return true;
 }
 seal(stats){if(this.current.sealed)return;this.current.sealed=true;this.current.stats=structuredClone(stats);}
 openDay(day){
  financeAssert(this.current.sealed&&day===this.current.day+1);
  this.reports.push(this.current);
  if(this.reports.length>30){const old=this.reports.shift();this.archived.days=old.day;this.archived.income+=financeSum(old.income);this.archived.expense+=financeSum(old.expense)-old.refund;this.archived.closing=old.opening+financeSum(old.income)-financeSum(old.expense)+old.refund;}
  this.current=financeDay(day,this.balance);
 }
 toJSON(){return structuredClone({balance:this.balance,lifetimeRevenue:this.lifetimeRevenue,lifetimeExpenses:this.lifetimeExpenses,paid:this.paid,reports:this.reports,archived:this.archived,current:this.current});}
 static fromJSON(data){
  financeAssert(data&&[data.balance,data.lifetimeRevenue,data.lifetimeExpenses].every(safeMoney)&&Array.isArray(data.paid)&&data.paid.length<=200000&&new Set(data.paid).size===data.paid.length&&data.paid.every(x=>typeof x==='string'&&x.length<100));
  financeAssert(Array.isArray(data.reports)&&data.reports.length<=30&&data.archived&&Object.values(data.archived).every(safeMoney));
  let day=data.archived.days,opening=data.archived.closing,income=data.archived.income,expense=data.archived.expense;const ids=new Set();
  financeAssert(opening===income-expense);
  for(const d of [...data.reports,data.current]){
   financeAssert(d&&d.day===++day&&d.opening===opening&&typeof d.sealed==='boolean'&&d.income&&d.expense&&Object.keys(d.income).sort().join()===['pickup','shipping','tips'].join()&&Object.keys(d.expense).sort().join()===['investment','operating'].join()&&[...Object.values(d.income),...Object.values(d.expense),d.refund].every(safeMoney)&&Array.isArray(d.entries)&&d.entries.length<=10000);
   if(d!==data.current)financeAssert(d.sealed);
   const sums={pickup:0,tips:0,shipping:0,operating:0,investment:0,refund:0};
   for(const e of d.entries){financeAssert(e&&typeof e.id==='string'&&!ids.has(e.id)&&data.paid.includes(e.id)&&moneyTypes.includes(e.type)&&safeMoney(e.amount)&&typeof e.source==='string'&&typeof e.night==='boolean'&&typeof e.reference==='string'&&e.reference.length<100);ids.add(e.id);sums[e.type]+=e.amount;}
   financeAssert(Object.entries(d.income).every(([k,v])=>sums[k]===v)&&Object.entries(d.expense).every(([k,v])=>sums[k]===v)&&sums.refund===d.refund);
   income+=financeSum(d.income);expense+=financeSum(d.expense)-d.refund;opening+=financeSum(d.income)-financeSum(d.expense)+d.refund;financeAssert(safeMoney(opening)&&safeMoney(income)&&safeMoney(expense));
  }
  financeAssert(opening===data.balance&&income===data.lifetimeRevenue&&expense===data.lifetimeExpenses);
  return Object.assign(Object.create(Ledger.prototype),structuredClone(data));
 }
}
