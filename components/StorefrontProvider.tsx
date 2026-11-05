'use client';

import {createContext,useCallback,useContext,useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import type {PublicStorefront,StorefrontItem} from '@/lib/storefront-pricing';
import {useCartStore} from '@/store/cart';

type StorefrontContextValue={snapshot:PublicStorefront|null;error:boolean;refresh:()=>Promise<PublicStorefront|null>};
const StorefrontContext=createContext<StorefrontContextValue>({snapshot:null,error:true,refresh:async()=>null});

function isSnapshot(value:unknown):value is PublicStorefront {
  if(!value||typeof value!=='object')return false;
  const row=value as PublicStorefront;
  return typeof row.quoteVersion==='string'&&typeof row.intakeEnabled==='boolean'&&Number.isInteger(row.version)&&Array.isArray(row.items)&&row.items.every(item=>typeof item.productId==='string'&&typeof item.available==='boolean'&&(item.salePrice===null||Number.isSafeInteger(item.salePrice))&&(item.listPrice===null||Number.isSafeInteger(item.listPrice)));
}

export function StorefrontProvider({initial,children}:{initial:PublicStorefront|null;children:React.ReactNode}) {
  const [snapshot,setSnapshot]=useState(initial);
  const [error,setError]=useState(!initial);
  const refresh=useCallback(async()=>{
    try {
      const response=await fetch('/api/storefront',{cache:'no-store'});
      const result:unknown=await response.json();
      if(!response.ok||!isSnapshot(result))throw new Error('PRICE_UNAVAILABLE');
      setSnapshot(result);setError(false);return result;
    }catch{setError(true);return null;}
  },[]);
  useEffect(()=>{
    const onFocus=()=>{void refresh();};
    window.addEventListener('focus',onFocus);
    return()=>window.removeEventListener('focus',onFocus);
  },[refresh]);
  const value=useMemo(()=>({snapshot,error,refresh}),[snapshot,error,refresh]);
  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront(){return useContext(StorefrontContext);}
export function useStorefrontItem(productId:string):StorefrontItem|undefined{return useStorefront().snapshot?.items.find(item=>item.productId===productId);}
const subscribe=()=>()=>{};
export function useCartQuote(){
  const hydrated=useSyncExternalStore(subscribe,()=>true,()=>false);
  const {snapshot,error,refresh}=useStorefront();
  const storedItems=useCartStore(state=>state.items);
  const acceptPrices=useCartStore(state=>state.acceptPrices);
  useEffect(()=>{void refresh();},[refresh]);
  const items=storedItems.map(item=>({item,quote:snapshot?.items.find(price=>price.productId===item.productId)}));
  const unavailable=items.some(({quote})=>!quote?.available||quote.salePrice===null);
  const changed=items.some(({item,quote})=>quote?.available&&quote.salePrice!==null&&quote.salePrice!==item.price);
  const total=items.reduce((sum,{item,quote})=>sum+(quote?.available&&quote.salePrice!==null?quote.salePrice*item.quantity:0),0);
  return {hydrated,snapshot,error,refresh,items,total,unavailable,changed,acceptPrices:()=>{if(snapshot)acceptPrices(snapshot.items.filter(item=>item.available&&item.salePrice!==null).map(item=>({productId:item.productId,price:item.salePrice!})));}};
}
