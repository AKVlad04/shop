"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, PackageSearch } from "lucide-react";

export function UnavailablePage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(7);

  useEffect(() => {
    const timeout = window.setTimeout(() => router.replace("/"), 7000);
    const interval = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#10090c] px-5 py-12 text-white">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-900/10 blur-[100px]" />
      <section className="relative w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#180f13]/90 p-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-12">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-950/45 text-rose-300 shadow-[0_0_35px_rgba(225,29,72,0.12)]">
          <PackageSearch size={30} strokeWidth={1.7} />
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.3em] text-rose-400">Eroare 404</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Nu am găsit pagina</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-neutral-400 sm:text-base">
          Pagina pe care o cauți nu mai este disponibilă sau nu există. Te vom duce înapoi la pagina principală în câteva secunde.
        </p>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-neutral-400">
          <Clock3 size={14} className="text-rose-300" />
          Redirecționare în <span aria-live="polite" className="min-w-3 font-bold tabular-nums text-white">{secondsLeft}</span> secunde
        </div>
        <div className="mt-8">
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/30 bg-gradient-to-r from-rose-900 to-rose-950 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:border-rose-400/50 hover:from-rose-800 hover:to-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
            <ArrowLeft size={16} />
            Înapoi acum la pagina principală
          </Link>
        </div>
      </section>
    </main>
  );
}
