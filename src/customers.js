// Stable cosmetic IDs: never reorder existing entries or consume gameplay RNG.
export const CUSTOMER_TYPES=Object.freeze([
 {key:'customer_young',name:'年輕街坊'},
 {key:'customer_office',name:'上班族'},
 {key:'customer_senior',name:'銀髮街坊'},
 {key:'customer_student',name:'黃衫學生'},
 {key:'customer_hat',name:'藍帽街坊'},
 {key:'customer_uncle',name:'酒紅背心伯伯'}
].map(Object.freeze));
export const CUSTOMER_COUNT=CUSTOMER_TYPES.length;
