"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

export function CategoriesGrid() {
  const categories = [
    {
      id: "gaming",
      title: "Gaming & Setup",
      subtitle: "Suporturi controllere, căști & accesorii",
      image: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&q=80&w=800",
      link: "/produse?categorie=gaming",
    },
    {
      id: "gadgeturi",
      title: "Accesorii & Gadgeturi",
      subtitle: "Organizare birou & piese practice",
      image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=800",
      link: "/produse?categorie=gadgeturi",
    },
    {
      id: "cadouri",
      title: "Decorațiuni & Cadouri",
      subtitle: "Keychains, corpuri iluminat & unicate",
      image: "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?auto=format&fit=crop&q=80&w=800",
      link: "/produse?categorie=cadouri",
    },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-16 relative">
      
      {/* Titlul secțiunii */}
      <div className="flex flex-col items-center text-center mb-12">
        <span className="text-xs font-bold tracking-[0.25em] uppercase text-rose-400 mb-2">
          Explorează pe Categorii
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Găsește exact ce cauți
        </h2>
      </div>

      {/* Grid-ul cu cele 3 carduri mari */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={cat.link}
            className="group relative h-96 rounded-[28px] overflow-hidden border border-white/10 bg-[#120B0E] flex flex-col justify-end p-6 transition-all duration-500 hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(225,29,72,0.2)]"
          >
            {/* Imaginea de fundal cu efect de Zoom la hover */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
              <Image
                src={cat.image}
                alt={cat.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-70 group-hover:opacity-90"
              />
              {/* Gradient întunecat peste imagine ca textul să fie perfect vizibil */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E0A0B] via-[#0E0A0B]/60 to-transparent" />
            </div>

            {/* Iconița de acțiune din colțul dreapta sus */}
            <div className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-rose-950 group-hover:border-rose-500/40 group-hover:text-rose-300 transition-all duration-300">
              <ArrowUpRight size={18} />
            </div>

            {/* Conținut text (Titlu și Subtitlu) */}
            <div className="relative z-10 transform transition-transform duration-300 group-hover:-translate-y-1">
              <p className="text-xs font-semibold text-rose-400 uppercase tracking-widest mb-1">
                {cat.subtitle}
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                {cat.title}
              </h3>
            </div>

          </Link>
        ))}
      </div>

    </section>
  );
}