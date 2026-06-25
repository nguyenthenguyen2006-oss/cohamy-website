"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/types";

interface CheckoutFormProps {
  locale: Locale;
}

export function CheckoutForm({ locale }: CheckoutFormProps) {
  const t = useTranslations("checkout");
  const items = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const clearCart = useCartStore((s) => s.clearCart);
  const [done, setDone] = useState(false);
  const [payment, setPayment] = useState("cod");

  if (!items.length && !done) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="mb-6">{t("subtitle")}</p>
        <Link href="/products" className="btn-primary px-8 h-12 rounded-full inline-flex items-center">
          Mua sắm
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="font-serif text-4xl text-[#D9A441] mb-4">{t("success")}</h1>
        <p className="text-[#4A2418]/80 mb-8">{t("successMessage")}</p>
        <Link href="/" className="btn-primary px-8 h-12 rounded-full inline-flex items-center">
          {t("backToHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 grid lg:grid-cols-5 gap-10">
      <form
        className="lg:col-span-3 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          clearCart();
          setDone(true);
        }}
      >
        <div>
          <h1 className="font-serif text-4xl mb-2">{t("title")}</h1>
          <p className="text-[#4A2418]/70">{t("subtitle")}</p>
        </div>

        <fieldset className="space-y-4">
          <legend className="font-medium mb-2">{t("contactInfo")}</legend>
          <input required placeholder={t("fields.fullName")} className="w-full h-12 px-4 border rounded-xl bg-white" />
          <input required type="email" placeholder={t("fields.email")} className="w-full h-12 px-4 border rounded-xl bg-white" />
          <input required placeholder={t("fields.phone")} className="w-full h-12 px-4 border rounded-xl bg-white" />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-medium mb-2">{t("shippingInfo")}</legend>
          <input required placeholder={t("fields.address")} className="w-full h-12 px-4 border rounded-xl bg-white" />
          <div className="grid sm:grid-cols-3 gap-3">
            <input required placeholder={t("fields.city")} className="h-12 px-4 border rounded-xl bg-white" />
            <input placeholder={t("fields.district")} className="h-12 px-4 border rounded-xl bg-white" />
            <input placeholder={t("fields.ward")} className="h-12 px-4 border rounded-xl bg-white" />
          </div>
          <textarea placeholder={t("fields.notePlaceholder")} rows={3} className="w-full p-4 border rounded-xl bg-white" />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-medium mb-2">{t("paymentMethod")}</legend>
          {(["cod", "bank", "momo"] as const).map((method) => (
            <label key={method} className="flex items-center gap-3 p-4 border rounded-xl bg-white cursor-pointer">
              <input
                type="radio"
                name="payment"
                value={method}
                checked={payment === method}
                onChange={() => setPayment(method)}
              />
              {t(`payment.${method}`)}
            </label>
          ))}
        </fieldset>

        <button type="submit" className="btn-primary w-full h-14 rounded-2xl">
          {t("placeOrder")}
        </button>
      </form>

      <aside className="lg:col-span-2">
        <div className="p-6 bg-white rounded-2xl border border-[#4A2418]/10 sticky top-24">
          <h2 className="font-medium mb-4">{t("orderSummary")}</h2>
          <div className="space-y-3 text-sm">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between gap-2">
                <span className="line-clamp-1">{item.name[locale]} × {item.quantity}</span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4 flex justify-between font-medium">
            <span>Tổng</span>
            <span className="text-[#D9A441]">{formatPrice(getTotal())}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}