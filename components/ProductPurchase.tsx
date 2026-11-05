'use client';

import {useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import {Link,useRouter} from '@/i18n/navigation';
import type {Locale,Product} from '@/lib/types';
import {useCartStore} from '@/store/cart';
import {useCartDrawerStore} from '@/store/cart-drawer';
import {useStorefront,useStorefrontItem} from './StorefrontProvider';
import {storefrontCopy} from './storefront-copy';
import {QuantityControl} from './QuantityControl';
import {cartFont} from './cart-font';
import './product-purchase.css';

export function ProductPurchase({product,compact=false}:{product:Product;compact?:boolean}){
  const locale=useLocale() as Locale,copy=storefrontCopy(locale),router=useRouter(),t=useTranslations('products');
  const {snapshot,error,refresh}=useStorefront();
  const quote=useStorefrontItem(product.id);
  const addItem=useCartStore(state=>state.addItem),openCart=useCartDrawerStore(state=>state.openCart);
  const [quantity,setQuantity]=useState(1),[refreshing,setRefreshing]=useState(false);
  const className=`product-purchase ${cartFont.variable}${compact?' product-purchase--compact':''}`;
  if(product.outOfStock)return null;
  if(error||!snapshot)return <div className={className}>
    {!compact&&<p className="product-purchase-message">{copy.unavailable}</p>}
    <button type="button" disabled={refreshing} onClick={async()=>{setRefreshing(true);await refresh();setRefreshing(false);}} className="product-purchase-retry">{copy.retry}</button>
  </div>;
  if(!quote?.available||quote.salePrice===null||!snapshot.intakeEnabled)return <div className={className}><Link href="/contact" className="product-purchase-contact">{t('contactCta')}</Link></div>;
  function add(showCart:boolean){
    if(!quote||quote.salePrice===null)return;
    addItem({productId:product.id,price:quote.salePrice,name:product.name,image:product.images[0]},quantity);
    if(showCart)openCart();
  }
  return <div className={className}>
    <div className="product-purchase-quantity">
      {!compact&&<span>{copy.quantity}</span>}
      <QuantityControl value={quantity} onChange={setQuantity} compact={compact} label={compact?`${copy.quantity} ${product.name[locale]}`:copy.quantity}/>
    </div>
    <div className="product-purchase-actions">
      {!compact&&<button type="button" className="product-purchase-action product-purchase-action--buy" onClick={()=>{add(false);router.push('/checkout');}}>{copy.buy}</button>}
      <button type="button" className="product-purchase-action product-purchase-action--add" onClick={()=>add(true)}>{copy.add}</button>
    </div>
  </div>;
}
