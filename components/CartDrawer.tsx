'use client';

import {useEffect,useRef,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import {usePathname} from 'next/navigation';
import Image from 'next/image';
import {ShoppingBag,Trash2,X} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {useCartDrawerStore} from '@/store/cart-drawer';
import {useCartStore} from '@/store/cart';
import {productArrivals} from '@/data/product-arrivals';
import {getProductById} from '@/lib/products';
import {formatPrice} from '@/lib/utils';
import type {Locale,Product} from '@/lib/types';
import {useCartQuote} from './StorefrontProvider';
import {storefrontCopy} from './storefront-copy';
import {cartDrawerCopy} from './cart-drawer-copy';
import {QuantityControl} from './QuantityControl';
import {cartFont} from './cart-font';
import './cart-drawer.css';

function DrawerContents({close}:{close:()=>void}) {
  const locale=useLocale() as Locale,copy=cartDrawerCopy(locale),prices=storefrontCopy(locale),t=useTranslations('cart');
  const {hydrated,items,total,error,refresh,changed,unavailable,acceptPrices,snapshot}=useCartQuote();
  const updateQuantity=useCartStore(state=>state.updateQuantity),removeItem=useCartStore(state=>state.removeItem),addItem=useCartStore(state=>state.addItem);
  const [addedName,setAddedName]=useState('');
  const cartIds=new Set(items.map(({item})=>item.productId));
  const relatedIds=items.flatMap(({item})=>getProductById(item.productId)?.relatedProductIds??[]);
  const suggestions=[...productArrivals].filter(product=>!product.outOfStock&&!cartIds.has(product.id)&&snapshot?.items.some(item=>item.productId===product.id&&item.available&&item.salePrice!==null))
    .sort((a,b)=>Number(relatedIds.includes(b.id))-Number(relatedIds.includes(a.id))).slice(0,4);
  const canCheckout=hydrated&&items.length>0&&!error&&!unavailable&&!changed&&!!snapshot?.intakeEnabled;
  function addSuggestion(product:Product) {
    const price=snapshot?.items.find(item=>item.productId===product.id);
    if(error||!snapshot?.intakeEnabled||!price?.available||price.salePrice===null)return;
    addItem({productId:product.id,price:price.salePrice,name:product.name,image:product.images[0]},1);setAddedName(product.name[locale]);
  }
  const recommendationList=<>{suggestions.map(product=>{
    const quote=snapshot?.items.find(item=>item.productId===product.id);
    return <article className="cart-suggestion" key={product.id}>
      <Link href={{pathname:'/products/[slug]',params:{slug:product.slug[locale]}}} onClick={close} tabIndex={-1} aria-hidden="true"><Image src={product.images[0]} alt="" width={180} height={180}/></Link>
      <h3><Link href={{pathname:'/products/[slug]',params:{slug:product.slug[locale]}}} onClick={close}>{product.name[locale]}</Link></h3>
      <p className="cart-suggestion-price">{!error&&quote?.salePrice!==null&&quote?.salePrice!==undefined?formatPrice(quote.salePrice):'—'}</p>
      <button type="button" disabled={error||!snapshot?.intakeEnabled} onClick={()=>addSuggestion(product)}>{prices.add}</button>
    </article>;
  })}</>;
  return <div className={`cart-drawer-sheet${suggestions.length?'':' cart-drawer-no-suggestions'}`}>
    {suggestions.length>0&&<aside className="cart-recommendations" aria-labelledby="cart-recommendations-heading"><h2 id="cart-recommendations-heading">{copy.suggestions}</h2>{recommendationList}</aside>}
    <section className="cart-drawer-main">
      <header className="cart-drawer-header"><h2 id="cart-drawer-title">{copy.title}</h2><button type="button" className="cart-drawer-close" onClick={close} aria-label={copy.close}><X size={32} strokeWidth={1.25}/></button></header>
      <div className="cart-drawer-scroll">
        {!hydrated?<p role="status">{prices.pending}</p>:items.length===0?<div className="cart-drawer-empty"><ShoppingBag size={48} strokeWidth={1}/><h3>{copy.empty}</h3><Link href="/products" onClick={close}>{copy.continue}</Link></div>:<>
          <ul className="cart-drawer-items">{items.map(({item,quote})=>{
            const product=getProductById(item.productId);
            return <li className="cart-drawer-item" key={item.productId}>
              <Image src={item.image} alt={item.name[locale]} width={126} height={126}/>
              <div className="cart-drawer-item-info"><h3>{product?<Link href={{pathname:'/products/[slug]',params:{slug:product.slug[locale]}}} onClick={close}>{item.name[locale]}</Link>:item.name[locale]}</h3>
                {product&&<p className="cart-drawer-weight">{product.weight}</p>}
                <p className="cart-drawer-price">{!error&&quote?.available&&quote.salePrice!==null?formatPrice(quote.salePrice):'—'}</p>
                {!quote?.available&&<p className="cart-drawer-warning">{copy.unavailable}</p>}
                <QuantityControl value={item.quantity} onChange={value=>updateQuantity(item.productId,value)} label={`${prices.quantity}: ${item.name[locale]}`} compact/>
              </div>
              <button type="button" className="cart-drawer-remove" aria-label={`${copy.remove} ${item.name[locale]}`} onClick={()=>removeItem(item.productId)}><Trash2 size={18}/></button>
            </li>;
          })}</ul>
          {error&&<div className="cart-drawer-notice" role="alert"><p>{prices.unavailable}</p><button type="button" onClick={()=>void refresh()}>{prices.retry}</button></div>}
          {changed&&!error&&<div className="cart-drawer-notice" role="alert"><p>{prices.changed}</p><button type="button" onClick={acceptPrices}>{prices.accept}</button></div>}
          {unavailable&&!error&&<p className="cart-drawer-warning" role="alert">{prices.removed}</p>}
          {!snapshot?.intakeEnabled&&<p className="cart-drawer-warning" role="alert">{prices.paused}</p>}
          {suggestions.length>0&&<section className="cart-mobile-recommendations" aria-labelledby="cart-mobile-recommendations-heading"><h2 id="cart-mobile-recommendations-heading">{copy.suggestions}</h2><div>{recommendationList}</div></section>}
        </>}
        <p className="cart-drawer-announcement" role="status" aria-live="polite">{addedName?`${copy.added}: ${addedName}`:''}</p>
      </div>
      {items.length>0&&<footer className="cart-drawer-footer">
        <p className="cart-drawer-vat">{copy.vat}</p>
        {canCheckout?<Link href="/checkout" className="cart-drawer-checkout" onClick={close}>{copy.checkout}<span>{formatPrice(total)}</span></Link>:<button type="button" className="cart-drawer-checkout" disabled>{copy.checkout}<span>{error||unavailable?'—':formatPrice(total)}</span></button>}
        <Link href="/cart" className="cart-drawer-cart-link" onClick={close}>{copy.viewCart}</Link>
        <p className="cart-drawer-shipping">{copy.shipping}</p>
      </footer>}
      {items.length===0&&hydrated&&<footer className="cart-drawer-footer cart-drawer-empty-footer"><p>{t('emptyHint')}</p></footer>}
    </section>
  </div>;
}

export function CartDrawer() {
  const open=useCartDrawerStore(state=>state.open),close=useCartDrawerStore(state=>state.closeCart);
  const dialog=useRef<HTMLDialogElement>(null),pathname=usePathname(),previousPath=useRef(pathname);
  useEffect(()=>{
    if(previousPath.current!==pathname){previousPath.current=pathname;close();}
  },[pathname,close]);
  useEffect(()=>{
    const node=dialog.current;if(!node)return;
    if(!open){if(node.open)node.close();return;}
    const root=document.documentElement,previousOverflow=root.style.overflow;
    root.style.overflow='hidden';
    if(!node.open)node.showModal();
    return()=>{root.style.overflow=previousOverflow;if(node.open)node.close();};
  },[open]);
  return <dialog ref={dialog} className={`cart-drawer ${cartFont.variable}`} aria-labelledby="cart-drawer-title" onClose={close} onCancel={close} onClick={event=>{
    if(event.target!==dialog.current)return;const rect=event.currentTarget.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
  }}>{open&&<DrawerContents close={close}/>}</dialog>;
}
