/** Only catalogue rows with a positive quantity are submitted. Invalid entered values
 * remain in the payload so the server can reject them instead of silently losing work. */
export function enteredProductLines<T extends {quantity:string}>(lines:T[],includeZero=false):T[]{
 return lines.filter(line=>line.quantity.trim()!==''&&(includeZero||Number(line.quantity)!==0));
}

/** Merge available catalogue rows into a draft without changing its existing lines. */
export function withProductCatalogue<T>(lines:T[],products:{id:string}[],id:(line:T)=>string,create:(id:string)=>T):T[]{
 const existing=new Set(lines.map(id));
 return [...lines,...products.filter(p=>!existing.has(p.id)).map(p=>create(p.id))];
}

export const productField=(key:string,field:string)=>`${field}:${key}`;
export const productValue=(form:FormData,key:string,field:string)=>String(form.get(productField(key,field))??'');
export function enteredFormRows<T extends {key:string}>(form:FormData,rows:T[],includeZero=false):T[]{
 return rows.filter(row=>{const value=productValue(form,row.key,'quantity');return value.trim()!==''&&(includeZero||Number(value)!==0);});
}
