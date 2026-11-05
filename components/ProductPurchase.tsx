'use client';

import {useState} from 'react';
import {useLocale} from 'next-intl';
import {Link,useRouter} from '@/i18n/navigation';
import type {Locale,Product} from '@/lib/types';
import {useCartStore} from '@/store/cart';
import {useStorefront,useStorefrontItem} from './StorefrontProvider';
import {storefrontCopy} from './storefront-copy';

export function ProductPurchase({product,compact=false}:{product:Product;compact?:boolean}){
  const locale=useLocale() as Locale,copy=storefrontCopy(locale),router=useRouter();
  const {snapshot,error,refresh}=useStorefront();
  const quote=useStorefrontItem(product.id);
  const addItem=useCartStore(state=>state.addItem);
  const [quantity,setQuantity]=useState(1),[added,setAdded]=useState(false),[refreshing,setRefreshing]=useState(false);
  if(product.outOfStock)return null;
  if(error||!snapshot)return <div className="mt-4 text-sm text-[#4A2418]">
    {!compact&&<p>{copy.unavailable}</p>}
    <button type="button" disabled={refreshing} onClick={async()=>{setRefreshing(true);await refresh();setRefreshing(false);}} className="min-h-11 underline underline-offset-4 disabled:opacity-50">{copy.retry}</button>
  </div>;
  if(!quote?.available||quote.salePrice===null||!snapshot.intakeEnabled)return <Link href="/contact" className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">{locale==='vi'?'Liên hệ đặt hàng':'Contact Cohamy'}</Link>;
  function add(){if(!quote||quote.salePrice===null)return;addItem({productId:product.id,price:quote.salePrice,name:product.name,image:product.images[0]},quantity);setAdded(true);}
  return <div className="mt-6">
    {!compact&&<label className="mb-4 flex items-center gap-3 text-sm text-[#4A2418]">{copy.quantity}<input type="number" min={1} max={100} inputMode="numeric" value={quantity} onChange={event=>setQuantity(Math.min(100,Math.max(1,Math.trunc(Number(event.target.value)||1))))} className="h-11 w-20 rounded-lg border border-[#4A2418]/30 bg-white px-3 text-center tabular-nums"/></label>}
    <div className="flex flex-wrap gap-3">
      <button type="button" className="btn-primary inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold" onClick={()=>{add();router.push('/checkout');}}>{copy.buy}</button>
      {!compact&&<button type="button" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#4A2418]/40 px-5 py-3 text-sm font-semibold text-[#4A2418] hover:bg-[#FFF4D8]" onClick={add}>{copy.add}</button>}
    </div>
    <p role="status" className="mt-3 min-h-5 text-sm text-[#4A2418]">{added&&<>{copy.added} <Link href="/cart" className="underline underline-offset-4">{copy.cart}</Link></>}</p>
  </div>;
}
