import assert from 'node:assert/strict';
import {CrmError} from '../../lib/crm/permissions';
import {calculateHandoverSaleLine,calculateHandoverSaleTotals,normalizeDiscountPercent,type HandoverSalePricingInput} from '../../lib/crm/handover-sale-pricing';

const jsonOnly=process.argv.includes('--json');
const cases:{name:string;status:'PASS'}[]=[];
function test(name:string,run:()=>void){run();cases.push({name,status:'PASS'});if(!jsonOnly)console.log('PASS '+name);}
function rejects(run:()=>unknown,code:string){assert.throws(run,(error:unknown)=>error instanceof CrmError&&error.status===400&&error.code===code);}
const line=(listUnitPrice:string,quantity:string,discountPercent:string,vatRate='0',includeVat=false)=>calculateHandoverSaleLine({listUnitPrice,quantity,discountPercent,vatRate,includeVat});
const example=()=>[line('90000','2','10'),line('50000','3','20'),line('80000','1','5')];

test('Percent strings and finite numeric values normalize without a floating money calculation',()=>{
  for(const [input,expected]of [['001.2500','1.25'],['100.0000','100'],['0.0001','0.0001'],[' 50 ','50'],[10.5,'10.5'],[0,'0']] as const)assert.equal(normalizeDiscountPercent(input),expected);
});
test('The supplied A/B/C example is exactly 410000 list, 52000 discount and 358000 payable',()=>{
  const rows=example();
  assert.deepEqual(rows.map(row=>[row.unitPrice,row.amount,row.discountAmount]),[['81000','162000','18000'],['40000','120000','30000'],['76000','76000','4000']]);
  assert.deepEqual(calculateHandoverSaleTotals(rows,'0'),{goods:'410000',discount:'52000',net:'358000',vat:'0',shipping:'0',total:'358000',paid:'0',remaining:'358000'});
});
test('Four decimal percentage digits remain exact',()=>{
  const row=line('1000000','2','12.3456');
  assert.equal(row.discountPercent,'12.3456');assert.equal(row.unitPrice,'876544');assert.equal(row.amount,'1753088');assert.equal(row.discountAmount,'246912');
  assert.equal(line('1000000','1','0.0001').unitPrice,'999999');
});
test('Discounted unit VND rounds first, then quantity multiplies that same displayed unit',()=>{
  const row=line('3','3','50');
  assert.deepEqual([row.unitPrice,row.listLineTotal,row.amount,row.discountAmount],['2','9','6','3']);
  // Rounding 9 × 50% at line level would produce5, contradicting2 × 3.
  assert.equal(line('5','7','10').amount,'35');
});
test('Two-decimal package quantities calculate from the rounded net unit',()=>{
  const row=line('90000','1.25','10');
  assert.deepEqual([row.unitPrice,row.listLineTotal,row.amount,row.discountAmount],['81000','112500','101250','11250']);
  assert.equal(line('5','1.5','0').amount,'8');
});
test('One hundred percent discount is valid and creates zero monetary total',()=>{
  const row=line('80000','2','100','8',true);
  assert.deepEqual([row.unitPrice,row.amount,row.discountAmount,row.vatAmount,row.grossLineTotal],['0','0','160000','0','0']);
  assert.deepEqual(calculateHandoverSaleTotals([row],'0'),{goods:'160000',discount:'160000',net:'0',vat:'0',shipping:'0',total:'0',paid:'0',remaining:'0'});
});
test('Disabled VAT returns actual zero without depending on a tax configuration',()=>{
  const row=line('90000','2','10','not-configured',false);
  assert.deepEqual([row.vatRate,row.vatAmount,row.grossLineTotal],['0','0','162000']);
});
test('Explicit VAT is calculated per net line and shipping is added once',()=>{
  const rows=[line('90000','2','10','8',true),line('50000','3','20','5',true),line('80000','1','5','0',true)];
  assert.deepEqual(rows.map(row=>row.vatAmount),['12960','6000','0']);
  assert.deepEqual(calculateHandoverSaleTotals(rows,'20000'),{goods:'410000',discount:'52000',net:'358000',vat:'18960',shipping:'20000',total:'396960',paid:'0',remaining:'396960'});
});
test('VAT half-VND rounds up and four-decimal VAT is supported',()=>{
  assert.deepEqual([line('5','1','0','10',true).vatAmount,line('5','1','0','10',true).grossLineTotal],['1','6']);
  assert.equal(line('1000000','1','0','8.1234',true).vatAmount,'81234');
});
test('Shipping without VAT and an empty preview have deterministic totals',()=>{
  assert.equal(calculateHandoverSaleTotals(example(),'20000').total,'378000');
  assert.deepEqual(calculateHandoverSaleTotals([],'0'),{goods:'0',discount:'0',net:'0',vat:'0',shipping:'0',total:'0',paid:'0',remaining:'0'});
});
test('Money beyond JavaScript safe integers remains exact as strings',()=>{
  const row=line('9007199254740993','1','0');
  assert.equal(row.unitPrice,'9007199254740993');assert.equal(calculateHandoverSaleTotals([row],'0').total,'9007199254740993');
  assert.equal(line('9007199254740993','1','50').unitPrice,'4503599627370497');
});
test('Negative, over-limit, nonfinite, scientific and overprecision discount inputs are rejected',()=>{
  for(const value of ['-1','-0','+1','100.0001','101','1e1','',' ','.5','5.','0.00001','10,5','NaN','Infinity','10%',NaN,Infinity,-Infinity,-1,100.00001,1e-7])rejects(()=>normalizeDiscountPercent(value),'INVALID_DISCOUNT_PERCENT');
});
test('Nonpositive, scientific, excessive precision or oversized quantities are rejected',()=>{
  for(const quantity of ['0','0.00','-1','1.001','1e2','','100000000000000'])rejects(()=>line('90000',quantity,'10'),'INVALID_SALE_QUANTITY');
});
test('Malformed price and shipping amounts are rejected rather than coerced',()=>{
  for(const price of ['-1','1.5','1e5','','1000000000000000000000000000000',' 100'])rejects(()=>line(price,'1','0'),'INVALID_MONEY');
  rejects(()=>calculateHandoverSaleLine({listUnitPrice:90000,quantity:'1',discountPercent:'0',vatRate:'0',includeVat:false} as unknown as HandoverSalePricingInput),'INVALID_MONEY');
  for(const fee of ['-1','1.5','1e4',''])rejects(()=>calculateHandoverSaleTotals(example(),fee),'INVALID_MONEY');
});
test('Invalid VAT configuration is rejected when VAT is explicitly selected',()=>{
  for(const rate of ['-1','101','1e1','','8.12345'])rejects(()=>line('90000','1','0',rate,true),'INVALID_VAT_RATE');
});
test('Numeric30 monetary bounds hold for the unit, line, VAT, invoice and shipping sum',()=>{
  const max='999999999999999999999999999999';
  assert.equal(calculateHandoverSaleTotals([line(max,'1','0')],'0').total,max);
  rejects(()=>line(max,'2','0'),'MONEY_LIMIT');
  rejects(()=>line(max,'1','0','100',true),'MONEY_LIMIT');
  rejects(()=>calculateHandoverSaleTotals([line(max,'1','0')],'1'),'MONEY_LIMIT');
  rejects(()=>calculateHandoverSaleTotals([line(max,'1','0'),line('1','1','0')],'0'),'MONEY_LIMIT');
});
test('Invoice aggregation rejects inconsistent caller-supplied line totals',()=>{
  const row=line('90000','2','10');
  rejects(()=>calculateHandoverSaleTotals([{...row,discountAmount:'1'}],'0'),'SALE_TOTALS_INVALID');
  rejects(()=>calculateHandoverSaleTotals([{...row,grossLineTotal:'1'}],'0'),'SALE_TOTALS_INVALID');
  rejects(()=>calculateHandoverSaleTotals(Array.from({length:301},()=>row),'0'),'INVALID_SALE_LINES');
});

console.log(JSON.stringify({status:'PASS',environment:'LOCAL pure shared BigInt pricing; no database or provider',cases,productionWrites:0,externalEmails:0,rounding:'Discounted unit VND HALF_UP first; then quantity and explicit per-line VAT HALF_UP',percentPrecision:4},null,2));
