'use client';

import {useLocale,useTranslations} from 'next-intl';
import {useStorefront,useStorefrontItem} from './StorefrontProvider';
import {storefrontCopy} from './storefront-copy';
import {formatPrice} from '@/lib/utils';
import type {Locale} from '@/lib/types';

export function ProductPrice({productId,compact=false,outOfStock=false}:{productId:string;compact?:boolean;outOfStock?:boolean}){
  const locale=useLocale() as Locale;
  const t=useTranslations('products');
  const {error}=useStorefront();
  const quote=useStorefrontItem(productId);
  const copy=storefrontCopy(locale);
  if(outOfStock)return <p className="mt-3 text-sm text-[#4A2418]">{t('outOfStock')}</p>;
  if(!quote?.available||quote.salePrice===null||error)return <p className="mt-3 text-sm text-[#4A2418]">{t('contactForPrice')}</p>;
  return <div className="mt-4" data-product-price={productId}>
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
      <strong className={compact?'text-lg font-bold text-[#2A120C]':'text-3xl font-bold text-[#2A120C]'}>{formatPrice(quote.salePrice)}</strong>
      {quote.discountPercent>0&&quote.listPrice!==null&&<>
        <span className="self-center rounded bg-[#D9A441] px-2 py-0.5 text-xs font-bold text-[#2A120C]">-{quote.discountPercent}%</span>
        <del className="text-sm text-[#73584D]">{formatPrice(quote.listPrice)}</del>
      </>}
    </div>
    <p className="mt-1 text-xs text-[#73584D]">{copy.includesVat}{quote.vatRate!==null?` ${quote.vatRate}%`:''}</p>
    {!compact&&quote.netSalePrice!==null&&quote.vatAmount!==null&&<p className="mt-2 text-sm leading-relaxed text-[#73584D]">{copy.net}: {formatPrice(quote.netSalePrice)}<br/>{copy.vat}: {formatPrice(quote.vatAmount)}</p>}
  </div>;
}
