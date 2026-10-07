"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, Check, ChevronDown, LoaderCircle, Tag, Trash2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { QuantityStepperButton } from "@/components/buttons/quantity-stepper-button";
import { cartCount, getCartSnapshot, subscribeToCart, writeCart, type CartEntry } from "@/lib/cart";
import { API_BASE_URL, getProductImageUrl } from "@/lib/productImages";

type QuoteItem = {
  id: number;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
  lineTotal: number;
};

type CartQuote = {
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon: { id: number; code: string; name: string } | null;
};

function money(value: number) {
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(value);
}

export default function CartPage() {
  const cartSnapshot = useSyncExternalStore(subscribeToCart, getCartSnapshot, () => "[]");
  const entries = useMemo(() => JSON.parse(cartSnapshot) as CartEntry[], [cartSnapshot]);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState("");
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    if (entries.length === 0) return;
    let active = true;
    const getQuote = async () => {
      setQuoting(true);
      setRequestError("");
      try {
        const response = await fetch(`${API_BASE_URL}/api/cart/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: entries, ...(appliedCoupon ? { couponCode: appliedCoupon } : {}) }),
        });
        const result = await response.json() as { error?: string; quote?: CartQuote } & Partial<CartQuote>;
        if (!active) return;
        if (!response.ok) {
          setQuote(result.quote ?? null);
          if (appliedCoupon) {
            setCouponError(result.error || "Cuponul nu a putut fi aplicat.");
            setAppliedCoupon("");
          } else {
            setRequestError(result.error || "Totalul coșului nu a putut fi calculat.");
          }
          return;
        }
        setQuote(result as CartQuote);
        if (result.coupon) {
          setCouponError("");
          setCouponInput(result.coupon.code);
        }
      } catch (error) {
        if (active) {
          setQuote(null);
          setRequestError(error instanceof Error ? error.message : "Totalul coșului nu a putut fi calculat.");
        }
      } finally {
        if (active) setQuoting(false);
      }
    };
    void getQuote();
    return () => {
      active = false;
    };
  }, [appliedCoupon, entries]);

  const updateQuantity = (productId: number, quantity: number) => {
    const nextEntries = entries.map((entry) => entry.productId === productId ? { ...entry, quantity } : entry);
    writeCart(nextEntries);
  };

  const removeItem = (productId: number) => {
    const nextEntries = entries.filter((entry) => entry.productId !== productId);
    writeCart(nextEntries);
  };

  const applyCoupon = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!couponInput.trim()) {
      setCouponError("Introdu codul cuponului.");
      return;
    }
    setCouponError("");
    setAppliedCoupon(couponInput.trim());
  };

  const clearCoupon = () => {
    setAppliedCoupon("");
    setCouponInput("");
    setCouponError("");
  };

  const displayQuote = entries.length > 0 ? quote : null;

  return (
    <main className="min-h-screen bg-[#10090c] text-white">
      <Navbar />
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <Link href="/produse" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 transition hover:text-white">
          <ArrowLeft size={16} />Înapoi la produse
        </Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-rose-400">Selecția ta</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Coșul meu</h1>
          </div>
          <span className="text-sm text-neutral-400">{cartCount(entries)} {cartCount(entries) === 1 ? "produs" : "produse"}</span>
        </div>

        {entries.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/[0.08] bg-[#180f13] px-6 py-16 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-rose-500/20 bg-rose-950/30 text-rose-300"><Tag size={22} /></div>
            <h2 className="mt-5 text-xl font-bold">Coșul tău este gol</h2>
            <p className="mt-2 text-sm text-neutral-400">Adaugă produse care îți plac și le vei găsi aici.</p>
            <Link href="/produse" className="mt-6 inline-flex rounded-full bg-rose-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-600">Descoperă produsele</Link>
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#180f13]">
              <div className="border-b border-white/[0.07] px-5 py-4">
                <h2 className="text-sm font-bold">Produsele tale</h2>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {displayQuote?.items.map((item) => (
                  <article key={item.id} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap sm:p-5">
                    <Link href={`/produse/${item.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30 sm:size-24">
                      {item.imageUrl ? <Image src={getProductImageUrl(item.imageUrl)} alt={item.name} fill unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-xs text-neutral-600">Fără poză</span>}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/produse/${item.slug}`} className="font-semibold text-white transition hover:text-rose-200">{item.name}</Link>
                      <p className="mt-1 text-sm text-neutral-400">{money(item.price)} / buc.</p>
                      <div className="mt-3">
                        <QuantityStepperButton value={item.quantity} min={1} onChange={(quantity) => updateQuantity(item.id, quantity)} className="h-9 scale-[0.92] origin-left" />
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3 sm:ml-0 sm:flex-col sm:items-end">
                      <strong className="whitespace-nowrap text-sm tabular-nums text-white">{money(item.lineTotal)}</strong>
                      <button type="button" onClick={() => removeItem(item.id)} aria-label={`Elimină ${item.name} din coș`} className="rounded-lg p-2 text-neutral-500 transition hover:bg-red-950/40 hover:text-red-300"><Trash2 size={16} /></button>
                    </div>
                  </article>
                ))}
                {!displayQuote && (
                  <div className="p-5 text-center">
                    <p className="text-sm text-neutral-400">{quoting ? "Se calculează totalul…" : requestError || "Se încarcă produsele…"}</p>
                    {!quoting && entries.map((entry) => (
                      <div key={entry.productId} className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2 text-left text-xs text-neutral-400">
                        <span>Produs indisponibil sau cu preț neconfirmat · ID {entry.productId} · × {entry.quantity}</span>
                        <button type="button" onClick={() => removeItem(entry.productId)} className="ml-3 shrink-0 text-rose-300 hover:text-white">Elimină</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <aside className="rounded-3xl border border-white/[0.08] bg-[#180f13] p-5 sm:p-6">
              <h2 className="text-lg font-bold">Sumar comandă</h2>
              <button type="button" onClick={() => setCouponOpen((open) => !open)} aria-expanded={couponOpen} className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-left text-sm text-neutral-300 transition hover:border-rose-500/30 hover:text-white">
                <span className="inline-flex items-center gap-2"><Tag size={15} className="text-rose-300" />Ai un cupon?</span>
                <ChevronDown size={16} className={`transition-transform ${couponOpen ? "rotate-180" : ""}`} />
              </button>
              {couponOpen && (
                <form onSubmit={applyCoupon} className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-3">
                  <label htmlFor="cart-coupon" className="text-xs font-medium text-neutral-400">Cod promoțional</label>
                  <div className="mt-2 flex gap-2">
                    <input id="cart-coupon" value={couponInput} onChange={(event) => setCouponInput(event.target.value)} placeholder="Ex. BINEAI VENIT" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#10090c] px-3 py-2.5 text-sm uppercase text-white outline-none placeholder:normal-case placeholder:text-neutral-600 focus:border-rose-500/50" />
                    <button type="submit" disabled={quoting || !couponInput.trim()} className="rounded-lg bg-rose-800 px-3.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50">{quoting ? <LoaderCircle size={15} className="animate-spin" /> : "Aplică"}</button>
                  </div>
                  {displayQuote?.coupon && <div className="mt-2 flex items-center justify-between text-xs text-emerald-300"><span className="inline-flex items-center gap-1"><Check size={13} />{displayQuote.coupon.name} · {displayQuote.coupon.code}</span><button type="button" onClick={clearCoupon} className="text-neutral-400 hover:text-white">Elimină</button></div>}
                  {couponError && <p role="alert" className="mt-2 text-xs text-rose-300">{couponError}</p>}
                </form>
              )}

              <div className="my-5 space-y-3 border-y border-white/[0.07] py-5 text-sm">
                <div className="flex justify-between text-neutral-400"><span>Subtotal</span><span className="tabular-nums text-white">{displayQuote ? money(displayQuote.subtotal) : "—"}</span></div>
                <div className="flex justify-between text-neutral-400"><span>Reducere</span><span className={`tabular-nums ${displayQuote?.discount ? "text-emerald-300" : "text-white"}`}>{displayQuote?.discount ? `−${money(displayQuote.discount)}` : displayQuote ? money(0) : "—"}</span></div>
                <div className="flex justify-between text-neutral-400"><span>Livrare</span><span className="tabular-nums text-white">{displayQuote ? displayQuote.shipping ? money(displayQuote.shipping) : "Gratuită" : "—"}</span></div>
                <p className="text-[11px] leading-5 text-neutral-500">Transport gratuit pentru comenzi de minimum 150 Lei; altfel, 20 Lei.</p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm font-semibold text-neutral-300">Total</span>
                <strong className="text-2xl font-black tabular-nums text-white">{displayQuote ? money(displayQuote.total) : "—"}</strong>
              </div>
              {requestError && <p role="alert" className="mt-3 text-xs text-rose-300">{requestError}</p>}
              <button type="button" disabled className="mt-6 w-full cursor-not-allowed rounded-full bg-rose-800/50 px-5 py-3.5 text-sm font-bold text-rose-100/70" title="Plățile online vor fi configurate într-o etapă viitoare">
                Continuă spre plată
              </button>
              <p className="mt-3 text-center text-[11px] leading-5 text-neutral-500">Plata online și introducerea adresei vor fi activate în etapa următoare.</p>
              {quoting && <p className="mt-3 flex items-center justify-center gap-2 text-xs text-neutral-500"><LoaderCircle size={13} className="animate-spin" />Se actualizează totalul</p>}
            </aside>
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}
