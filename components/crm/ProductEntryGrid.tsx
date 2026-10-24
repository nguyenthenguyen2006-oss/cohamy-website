'use client';

import {useId,useState,type ReactNode,type InputHTMLAttributes} from 'react';
import Image from 'next/image';
import {resolveProductImage} from './product-images';
import './product-entry-grid.css';

export type ProductEntryRow={key:string;name:string;sku?:string;image?:string;unit?:string;detail?:ReactNode;selected?:boolean};
export type ProductEntryColumn<R>={key:string;label:string;render:(row:R,index:number)=>ReactNode};

/** Rows stay mounted when filtered, so searching never discards an entered quantity. */
export function ProductEntryGrid<R extends ProductEntryRow>({rows,columns,label='Sản phẩm và số lượng',help}:{rows:R[];columns:ProductEntryColumn<R>[];label?:string;help?:string}){
 const id=useId(),[query,setQuery]=useState('');
 const needle=query.trim().toLocaleLowerCase('vi');
 const shown=rows.filter(r=>r.name.toLocaleLowerCase('vi').includes(needle)).length;
 return <fieldset className="crm-product-entry"><legend>{label}</legend>
  <div className="crm-product-entry-toolbar"><label htmlFor={id}>Tìm theo tên sản phẩm<input id={id} type="search" value={query} placeholder="Nhập tên để lọc bảng…" onChange={e=>setQuery(e.target.value)}/></label><span role="status">{rows.some(r=>r.selected!==undefined)&&<>{rows.filter(r=>r.selected).length} mặt hàng đã nhập · </>}{shown}/{rows.length} dòng</span></div>
  {help&&<p className="crm-product-entry-help">{help}</p>}
  <p className="crm-product-entry-mobile-hint">Vuốt ngang bảng để nhập số lượng và xem các cột còn lại.</p>
  <div className="crm-product-entry-scroll" role="region" aria-label={label} tabIndex={0}>
   <table><thead><tr><th scope="col">Ảnh</th><th scope="col">Tên sản phẩm</th><th scope="col">Đơn vị</th>{columns.map(c=><th scope="col" key={c.key}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map((row,i)=><tr key={row.key} hidden={!row.name.toLocaleLowerCase('vi').includes(needle)} className={row.selected?'is-filled':''}>
     <td className="crm-product-entry-image"><Image src={resolveProductImage(row.sku??'',row.image)} alt={row.name} unoptimized width={44} height={52} style={{width:44,height:52,objectFit:'contain'}}/></td>
     <th scope="row" className="crm-product-entry-name"><strong>{row.name}</strong>{row.detail&&<small>{row.detail}</small>}</th>
     <td className="crm-product-entry-unit">{row.unit||'Chưa khai báo'}</td>
     {columns.map(c=><td key={c.key}>{c.render(row,i)}</td>)}
    </tr>)}</tbody>
   </table>
   {!rows.length&&<p className="crm-product-entry-empty">Chưa có mặt hàng phù hợp với chứng từ này.</p>}
   {rows.length>0&&shown===0&&<p className="crm-product-entry-empty">Không có tên sản phẩm phù hợp. Số lượng đã nhập vẫn được giữ.</p>}
  </div>
 </fieldset>;
}

export function ProductQuantityInput({quick=false,...props}:InputHTMLAttributes<HTMLInputElement>&{quick?:boolean}){
 const controlled=props.value!==undefined;
 const [local,setLocal]=useState(String(props.defaultValue??''));
 const value=String(controlled?props.value??'':local);
 return <div className="crm-product-entry-quantity"><input {...props} defaultValue={undefined} value={value} data-product-quantity inputMode="decimal" type="number" min={props.min??0} step={props.step??'0.000001'} onChange={e=>{if(!controlled)setLocal(e.target.value);props.onChange?.(e);}} onKeyDown={e=>{
  props.onKeyDown?.(e);if(e.defaultPrevented)return;
  if(e.key==='Enter'||e.key==='ArrowDown'||e.key==='ArrowUp'){
   const inputs=Array.from(e.currentTarget.closest('tbody')?.querySelectorAll<HTMLInputElement>('tr:not([hidden]) input[data-product-quantity]')??[]);
   const next=inputs[inputs.indexOf(e.currentTarget)+(e.key==='ArrowUp'?-1:1)];
   e.preventDefault();next?.focus();next?.select();
  }
 }}/>{quick&&<div className="crm-product-entry-steps">{[10,20,50,100].map(step=><button type="button" key={step} aria-label={`${props['aria-label']} cộng ${step}`} onClick={e=>{
  const input=e.currentTarget.closest('.crm-product-entry-quantity')?.querySelector('input');if(!input)return;
  const next=String((Number(value)||0)+step);if(props.max!==undefined&&Number(next)>Number(props.max))return;
  // Use the native setter so both controlled and FormData fields receive the same change.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set?.call(input,next);input.dispatchEvent(new Event('input',{bubbles:true}));
 }}>+{step}</button>)}</div>}</div>;
}
