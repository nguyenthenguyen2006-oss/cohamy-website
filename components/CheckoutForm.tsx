"use client";

import { useEffect, useRef, useState } from "react";
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
  const [orderCode, setOrderCode] = useState("");
  const [serverSubtotal, setServerSubtotal] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const [payment, setPayment] = useState("cod");
  useEffect(() => { if (done) window.scrollTo({ top: 0, behavior: "instant" }); }, [done]);

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
        <p className="text-[#4A2418]/80 mb-4">{t("receivedMessage")}</p>
        <p className="font-medium mb-8">{t("orderCode")}: {orderCode}</p>
        <p className="mb-8">{t("confirmedSubtotal")}: {BigInt(serverSubtotal).toLocaleString(locale)} VND</p>
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
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy.current) return;
          busy.current = true; setPending(true); setError("");
          const form = new FormData(e.currentTarget);
          const contact = Object.fromEntries(["fullName", "email", "phone", "address", "city", "district", "ward", "note"].map(name => [name, String(form.get(name) || "")]));
          const body = { locale, payment, contact, items: items.map(item => ({ productId: item.productId, quantity: item.quantity })) };
          try {
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body))))).map(byte => byte.toString(16).padStart(2,"0")).join("");
            const stored = localStorage.getItem("cohamy-order-request");
            let saved: { hash: string; key: string } | null = null;
            try { saved = stored ? JSON.parse(stored) : null; } catch { /* Replace invalid local request metadata. */ }
            const key = saved?.hash === hash ? saved.key : crypto.randomUUID();
            localStorage.setItem("cohamy-order-request", JSON.stringify({ hash, key }));
            const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, idempotencyKey: key }) });
            const result = await response.json();
            if (response.status !== 201 || result.status !== "PENDING_REVIEW" || result.paid !== false || typeof result.code !== "string" || typeof result.subtotal !== "string" || !/^\d{1,18}$/u.test(result.subtotal)) throw new Error("ORDER_NOT_SAVED");
            setOrderCode(result.code); setServerSubtotal(result.subtotal); clearCart(); setDone(true);
            localStorage.removeItem("cohamy-order-request");
          } catch { setError(t("saveFailed")); }
          finally { busy.current = false; setPending(false); }
        }}
      >
        <div>
          <h1 className="font-serif text-4xl mb-2">{t("title")}</h1>
          <p className="text-[#4A2418]/70">{t("subtitle")}</p>
        </div>

        <fieldset className="space-y-4">
          <legend className="font-medium mb-2">{t("contactInfo")}</legend>
          <input required name="fullName" aria-label={t("fields.fullName")} placeholder={t("fields.fullName")} className="w-full h-12 px-4 border rounded-xl bg-white" />
          <input required name="email" aria-label={t("fields.email")} type="email" placeholder={t("fields.email")} className="w-full h-12 px-4 border rounded-xl bg-white" />
          <input required name="phone" aria-label={t("fields.phone")} placeholder={t("fields.phone")} className="w-full h-12 px-4 border rounded-xl bg-white" />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-medium mb-2">{t("shippingInfo")}</legend>
          <input required name="address" aria-label={t("fields.address")} placeholder={t("fields.address")} className="w-full h-12 px-4 border rounded-xl bg-white" />
          <div className="grid sm:grid-cols-3 gap-3">
            <input required name="city" aria-label={t("fields.city")} placeholder={t("fields.city")} className="h-12 px-4 border rounded-xl bg-white" />
            <input name="district" aria-label={t("fields.district")} placeholder={t("fields.district")} className="h-12 px-4 border rounded-xl bg-white" />
            <input name="ward" aria-label={t("fields.ward")} placeholder={t("fields.ward")} className="h-12 px-4 border rounded-xl bg-white" />
          </div>
          <textarea name="note" aria-label={t("fields.notePlaceholder")} placeholder={t("fields.notePlaceholder")} rows={3} className="w-full p-4 border rounded-xl bg-white" />
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

        {error && <p role="alert" className="text-red-800">{error}</p>}
        <p className="text-sm text-[#4A2418]/80">{t("pendingNotice")}</p>
        <button type="submit" disabled={pending} className="btn-primary w-full h-14 rounded-2xl disabled:opacity-50">
          {pending ? t("saving") : t("placeOrder")}
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
