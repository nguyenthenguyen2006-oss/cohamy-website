"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn, formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import type { Locale } from "@/lib/types";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const getTotal = useCartStore((state) => state.getTotal);

  const total = getTotal();
  const priceLocale =
    locale === "vi" ? "vi-VN" : locale === "ko" ? "ko-KR" : "en-US";

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-[#2A120C]/35 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-[min(92vw,24rem)] flex-col border-l border-[#4A2418]/10 bg-[#FAF6EF] shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-[#4A2418]/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#D9A441]" />
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-[#2A120C]">
              {t("title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-[#FFF4D8]"
            aria-label={t("title")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingBag size={32} className="text-[#4A2418]/25" />
              <p className="text-sm text-[#4A2418]/70">{t("empty")}</p>
              <Link
                href="/products"
                onClick={onClose}
                className="text-sm font-medium text-[#D9A441] underline-offset-4 hover:underline"
              >
                {t("continueShopping")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.productId}
                  className="flex gap-3 rounded-xl border border-[#4A2418]/10 bg-[#FFF4D8]/50 p-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
                    <Image
                      src={item.image}
                      alt={item.name[locale]}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#2A120C]">
                      {item.name[locale]}
                    </p>
                    <p className="mt-0.5 text-sm text-[#D9A441]">
                      {formatPrice(item.price, priceLocale)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        className="rounded-md border border-[#4A2418]/15 p-1 hover:bg-white"
                        aria-label={`${t("quantity")} -`}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="rounded-md border border-[#4A2418]/15 p-1 hover:bg-white"
                        aria-label={`${t("quantity")} +`}
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="ml-auto rounded-md p-1 text-[#4A2418]/50 hover:text-[#4A2418]"
                        aria-label={t("remove")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="border-t border-[#4A2418]/10 px-5 py-5">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-[#4A2418]/70">{t("subtotal")}</span>
              <span className="font-semibold text-[#2A120C]">
                {formatPrice(total, priceLocale)}
              </span>
            </div>
            <Link
              href="/checkout"
              onClick={onClose}
              className="flex h-12 w-full items-center justify-center rounded-full bg-[#D9A441] text-sm font-semibold text-[#2A120C] transition-colors hover:bg-[#c99538]"
            >
              {t("checkout")}
            </Link>
          </div>
        ) : null}
      </aside>
    </>
  );
}