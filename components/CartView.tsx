"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/types";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import {useCartQuote} from './StorefrontProvider';
import {storefrontCopy} from './storefront-copy';

interface CartViewProps {
  locale: Locale;
}

export function CartView({ locale }: CartViewProps) {
  const t = useTranslations("cart");
  const {hydrated,items,total,error,refresh,changed,unavailable,acceptPrices,snapshot}=useCartQuote();
  const copy=storefrontCopy(locale);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  if(!hydrated)return <p role="status" className="mx-auto max-w-4xl px-6 py-12">{copy.pending}</p>;

  if (!items.length) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <ShoppingBag className="mx-auto text-[#D9A441] mb-6" size={48} />
        <h1 className="font-serif text-4xl mb-3">{t("empty")}</h1>
        <p className="text-[#4A2418]/70 mb-8">{t("emptyHint")}</p>
        <Link href="/products" className="btn-primary px-8 h-12 rounded-full inline-flex items-center">
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-serif text-4xl mb-2">{t("title")}</h1>
      <p className="text-[#4A2418]/70 mb-8">{t("subtitle")}</p>

      {error&&<div role="alert" className="mb-6 text-[#8A2F21]"><p>{copy.unavailable}</p><button type="button" className="min-h-11 underline underline-offset-4" onClick={()=>void refresh()}>{copy.retry}</button></div>}
      {changed&&!error&&<div role="alert" className="mb-6 rounded-lg bg-[#FFF4D8] p-4 text-[#4A2418]"><p>{copy.changed}</p><button type="button" onClick={acceptPrices} className="mt-2 min-h-11 underline underline-offset-4 font-semibold">{copy.accept}</button></div>}
      {unavailable&&!error&&<p role="alert" className="mb-6 text-[#8A2F21]">{copy.removed}</p>}

      <div className="space-y-4">
        {items.map(({item,quote}) => (
          <div
            key={item.productId}
            className="flex flex-wrap gap-4 p-4 bg-white rounded-2xl border border-[#4A2418]/10"
          >
            <Image
              src={item.image}
              alt={item.name[locale]}
              width={80}
              height={80}
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1 basis-40">
              <div className="font-medium">{item.name[locale]}</div>
              <div className="text-[#4A2418] mt-1 tabular-nums">{!error&&quote?.available&&quote.salePrice!==null?formatPrice(quote.salePrice):'—'}{quote?.available&&quote.salePrice!==item.price&&<del className="ml-2 text-sm text-[#73584D]">{formatPrice(item.price)}</del>}</div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="inline-flex h-11 w-11 items-center justify-center border rounded-lg"
                  aria-label={`${t("quantity")} -`}
                >
                  <Minus size={14} />
                </button>
                <span className="min-w-[2rem] text-center">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  disabled={item.quantity>=100}
                  className="inline-flex h-11 w-11 items-center justify-center border rounded-lg disabled:opacity-40"
                  aria-label={`${t("quantity")} +`}
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center text-[#73584D] hover:text-red-800"
                  aria-label={t("remove")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="font-medium tabular-nums">
              {!error&&quote?.available&&quote.salePrice!==null?formatPrice(quote.salePrice * item.quantity):'—'}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-[#FFF4D8] rounded-2xl">
        <div className="flex justify-between text-lg font-medium">
          <span>{copy.subtotal}</span>
          <span className="text-[#4A2418] tabular-nums">{!error&&!unavailable?formatPrice(total):'—'}</span>
        </div>
        <p className="mt-3 text-sm text-[#4A2418]">{copy.shipping}</p>
        {!snapshot?.intakeEnabled&&<p role="alert" className="mt-3 text-sm text-[#8A2F21]">{copy.paused}</p>}
        {!error&&!unavailable&&!changed&&snapshot?.intakeEnabled?<Link
          href="/checkout"
          className="btn-primary block text-center mt-6 py-4 rounded-2xl"
        >
          {t("checkout")}
        </Link>:<button type="button" disabled className="btn-primary mt-6 w-full rounded-2xl py-4 opacity-50">{t('checkout')}</button>}
      </div>
    </div>
  );
}
