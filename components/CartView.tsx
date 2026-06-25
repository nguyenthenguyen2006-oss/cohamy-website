"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/types";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

interface CartViewProps {
  locale: Locale;
}

export function CartView({ locale }: CartViewProps) {
  const t = useTranslations("cart");
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const getTotal = useCartStore((s) => s.getTotal);

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

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex gap-4 p-4 bg-white rounded-2xl border border-[#4A2418]/10"
          >
            <img
              src={item.image}
              alt={item.name[locale]}
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div className="flex-1">
              <div className="font-medium">{item.name[locale]}</div>
              <div className="text-[#D9A441] mt-1">{formatPrice(item.price)}</div>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="p-1 border rounded-lg"
                >
                  <Minus size={14} />
                </button>
                <span className="min-w-[2rem] text-center">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="p-1 border rounded-lg"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="ml-auto text-[#4A2418]/50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="font-medium">
              {formatPrice(item.price * item.quantity)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-[#FFF4D8] rounded-2xl">
        <div className="flex justify-between text-lg font-medium">
          <span>{t("grandTotal")}</span>
          <span className="text-[#D9A441]">{formatPrice(getTotal())}</span>
        </div>
        <Link
          href="/checkout"
          className="btn-primary block text-center mt-6 py-4 rounded-2xl"
        >
          {t("checkout")}
        </Link>
      </div>
    </div>
  );
}