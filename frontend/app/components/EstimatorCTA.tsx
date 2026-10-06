"use client";

import Link from "next/link";
import { Box, Upload, ArrowRight, Sparkles, Cpu } from "lucide-react";

export function EstimatorCTA() {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-16 relative">
      
      {/* Containerul principal cu efect de sticlă mată și bordură luminoasă */}
      <div className="relative isolate overflow-hidden rounded-[32px] bg-[#120B0E]/70 border border-rose-500/30 p-8 sm:p-12 backdrop-blur-2xl shadow-[0_0_50px_rgba(225,29,72,0.15)]">
        
        {/* Efecte de fundal luminoase în interiorul cardului */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-rose-950/40 blur-3xl -z-10" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-pink-950/20 blur-3xl -z-10" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Stânga: Textul și îndemnul */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-semibold tracking-wide uppercase mb-6 backdrop-blur-md">
              <Sparkles size={13} className="text-rose-400 animate-pulse" />
              <span>Estimator Instant de Preț</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase leading-tight mb-4">
              AI UN MODEL PROPRIU <span className="bg-gradient-to-r from-rose-400 to-pink-300 bg-clip-text text-transparent">STL?</span>
            </h2>

            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mb-8 max-w-xl">
              Trimite-l la estimat și îți spunem prețul pe loc! Sistemul analizează geometria piesei, volumul de material necesar și timpul de printare pentru o ofertă corectă, în câteva secunde.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/estimator"
                className="flex items-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-rose-900 to-rose-950 text-white font-bold text-sm tracking-wide border border-rose-500/40 shadow-[0_0_25px_rgba(225,29,72,0.4)] hover:shadow-[0_0_35px_rgba(225,29,72,0.6)] hover:scale-105 transition-all duration-300"
              >
                <Upload size={18} />
                <span>Testează Estimatorul Acum</span>
                <ArrowRight size={16} />
              </Link>
            </div>

          </div>

          {/* Dreapta: O previzualizare vizuală modernă (element tech/3d simulat) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-sm h-64 rounded-2xl bg-black/40 border border-white/10 p-6 flex flex-col items-center justify-center text-center backdrop-blur-md group hover:border-rose-500/40 transition-all duration-500 shadow-inner">
              
              {/* Iconiță centrală animată / stilizată */}
              <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.3)] group-hover:scale-110 transition-transform duration-500">
                <Box size={32} strokeWidth={1.5} />
              </div>

              <div className="space-y-1">
                <p className="text-white font-bold text-sm tracking-wide">Trage fișierul STL aici</p>
                <p className="text-neutral-400 text-xs">Suportă STL, OBJ, 3MF</p>
              </div>

              {/* Tag mic tehnic */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[10px] font-mono text-neutral-400">
                <Cpu size={12} className="text-rose-400" />
                <span>AI Calculator</span>
              </div>

            </div>
          </div>

        </div>

      </div>

    </section>
  );
}