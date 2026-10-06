"use client";

import Link from "next/link";
import { User, Heart, ShoppingCart } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-6 pointer-events-none">
      <nav className="w-full max-w-6xl grid grid-cols-3 items-center px-8 py-4 bg-[#120B0E]/70 border border-white/10 backdrop-blur-2xl rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.6)] pointer-events-auto transition-all duration-300 ">
        
        {/* COLOANA 1: STANGA (SHOP) */}
        <div className="flex items-center justify-start">
          <Link 
            href="/" 
            className="text-base font-extrabold tracking-[0.3em] text-white uppercase hover:text-rose-300 transition-colors"
          >
            SHOP
          </Link>
        </div>

        {/* COLOANA 2: CENTRU (Butoanele de navigare mărite) */}
        <div className="hidden md:flex items-center justify-center gap-2 px-2 py-1 justify-self-center">
          <Link 
            href="/produse" 
            className="px-5 py-2 text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            Produse
          </Link>
          <Link 
            href="/materiale" 
            className="px-5 py-2 text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            Materiale
          </Link>
          <Link 
            href="/estimator" 
            className="px-5 py-2 text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            Estimator
          </Link>
        </div>

        {/* COLOANA 3: DREAPTA (Cont, Favorite, Coș mărite) */}
        <div className="flex items-center justify-end gap-2.5 sm:gap-3">
          
          {/* Contul meu */}
          <Link 
            href="/auth" 
            className="flex items-center gap-2.5 px-4 py-2 rounded-full hover:bg-white/10 text-neutral-200 hover:text-white transition-all text-sm font-medium group"
          >
            <User size={18} className="text-neutral-400 group-hover:text-rose-400 transition-colors" />
            <span className="hidden lg:inline">Cont</span>
          </Link>

          {/* Favorite */}
          <Link 
            href="/favorite" 
            className="flex items-center gap-2.5 px-4 py-2 rounded-full hover:bg-white/10 text-neutral-200 hover:text-white transition-all text-sm font-medium group"
          >
            <Heart size={18} className="text-neutral-400 group-hover:text-rose-400 transition-colors" />
            <span className="hidden lg:inline">Favorite</span>
          </Link>

          {/* Coșul meu */}
          <Link 
            href="/cart" 
            className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-rose-950/50 border border-rose-500/30 hover:bg-rose-900/50 text-rose-200 transition-all text-sm font-semibold group shadow-[0_0_20px_rgba(225,29,72,0.2)]"
          >
            <ShoppingCart size={18} className="text-rose-400 group-hover:scale-110 transition-transform" />
            <span>Coș</span>
          </Link>

        </div>
      </nav>
    </header>
  );
}