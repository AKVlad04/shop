"use client";

import { Cpu, Palette, Sparkles, ShieldCheck } from "lucide-react";

export function WhyUs() {
  const benefits = [
    {
      icon: <Cpu className="text-rose-400" size={24} />,
      title: "Calitate Industrială",
      description: "Materiale rezistente de înaltă performanță și o precizie milimetrică la fiecare strat depus.",
    },
    {
      icon: <Sparkles className="text-rose-400" size={24} />,
      title: "Design Unic",
      description: "Modele originale, finisaje premium și atenție desăvârșită la detalii pentru fiecare piesă în parte.",
    },
    {
      icon: <Palette className="text-rose-400" size={24} />,
      title: "Opțiuni Custom",
      description: "Flexibilitate totală: posibilitatea de a personaliza culorile, dimensiunile sau cerințele tehnice.",
    },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-20 relative">
      
      {/* Titlul secțiunii cu efect de text adnotat / subliniat elegant */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-xs font-bold tracking-[0.25em] uppercase text-rose-400 mb-3 block">
          Avantajele Noastre
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          De ce să alegi {" "}
          <span className="relative inline-block text-rose-300 px-2 py-0.5">
            {/* Efectul de subliniere / adnotare fină */}
            <span className="absolute inset-0 bg-rose-950/40 border border-rose-500/30 rounded-lg -rotate-1 backdrop-blur-sm" />
            <span className="relative z-10">printurile noastre 3D</span>
          </span>
          ?
        </h2>
        <p className="text-neutral-400 text-sm mt-4">
          Nu facem doar obiecte, transformăm concepte abstracte în piese fizice durabile, gândite să reziste în timp.
        </p>
      </div>

      {/* Grid-ul cu cele 3 carduri minimaliste */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {benefits.map((item, index) => (
          <div 
            key={index}
            className="group relative bg-[#120B0E]/50 border border-white/10 rounded-3xl p-8 backdrop-blur-xl hover:border-rose-500/40 hover:bg-[#120B0E]/80 transition-all duration-300 flex flex-col items-start shadow-xl"
          >
            {/* Iconița încadrată într-un cerc fin iluminat */}
            <div className="w-12 h-12 rounded-2xl bg-rose-950/40 border border-rose-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(225,29,72,0.15)]">
              {item.icon}
            </div>

            <h3 className="text-white font-bold text-lg mb-2 group-hover:text-rose-300 transition-colors">
              {item.title}
            </h3>

            <p className="text-neutral-400 text-sm leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>

    </section>
  );
}