"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export function NonuserMenuDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Deschide opțiunile contului"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="group flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-neutral-200 transition hover:border-rose-500/30 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        <span>Cont</span>
        <ChevronDown size={14} className={cn("text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Acces cont"
          className="absolute right-0 top-[calc(100%+10px)] z-[60] w-72 rounded-2xl border border-white/10 bg-[#160d11]/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:w-80"
        >
          <p className="text-sm font-semibold leading-relaxed text-white">
            Intră în contul tău să ai control absolut asupra comenzilor!
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/auth"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/60 px-3 py-2.5 text-xs font-semibold text-rose-100 transition hover:border-rose-400/50 hover:bg-rose-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogIn size={14} />
              Intră în cont
            </Link>
            <Link
              href="/auth"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <UserPlus size={14} />
              Cont nou
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
