"use client";

import { useState } from "react";
import { MOCK_PRODUCTS } from "@/data/mockProducts";
import { ChevronLeft, ChevronRight, ShoppingCart, Heart, Star } from "lucide-react";
import Image from "next/image";

export function FeaturedProducts() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Funcții pentru navigarea prin carusel (săgeți)
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % MOCK_PRODUCTS.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + MOCK_PRODUCTS.length) % MOCK_PRODUCTS.length);
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-16 relative">
      
      {/* Titlul secțiunii și controalele */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-rose-400">
            Top Selecție
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Produse Apreciate
          </h2>
        </div>

        {/* Butoanele de navigare stânga/dreapta */}
        <div className="flex items-center gap-2">
          <button 
            onClick={prevSlide}
            className="p-2.5 rounded-full bg-[#120B0E]/80 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
            aria-label="Anteriorul"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={nextSlide}
            className="p-2.5 rounded-full bg-[#120B0E]/80 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
            aria-label="Următorul"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Grid-ul / Caruselul de produse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {MOCK_PRODUCTS.map((product) => (
          <div 
            key={product.id}
            className="group relative bg-[#120B0E]/50 border border-white/10 rounded-3xl p-4 backdrop-blur-xl hover:border-rose-500/40 hover:bg-[#120B0E]/80 transition-all duration-300 flex flex-col justify-between shadow-xl"
          >
            {/* Partea de Sus: Imagine și Badge */}
            <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-neutral-900 mb-4">
              <Image 
                src={product.image} 
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
              />
              
              {/* Badge (ex: Best Seller) */}
              {product.badge && (
                <span className="absolute top-3 left-3 px-3 py-1 bg-rose-950/80 border border-rose-500/30 backdrop-blur-md text-rose-200 text-[10px] font-bold tracking-wider uppercase rounded-full shadow-lg">
                  {product.badge}
                </span>
              )}

              {/* Buton Favorite rapid */}
              <button 
                className="absolute top-3 right-3 p-2 rounded-full bg-black/40 border border-white/10 text-white hover:text-rose-400 hover:bg-black/60 transition-all backdrop-blur-md"
                aria-label="Adaugă la favorite"
              >
                <Heart size={16} />
              </button>
            </div>

            {/* Informații Produs */}
            <div className="flex flex-col flex-grow">
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <span>{product.category}</span>
                <div className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Star size={13} fill="currentColor" />
                  <span>{product.rating}</span>
                </div>
              </div>

              <h3 className="text-white font-semibold text-sm mb-3 line-clamp-1 group-hover:text-rose-300 transition-colors">
                {product.name}
              </h3>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                <span className="text-lg font-black text-white">
                  {product.price} <span className="text-xs font-normal text-neutral-400">RON</span>
                </span>

                <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-950/40 border border-rose-500/20 text-rose-200 hover:bg-rose-900/60 hover:border-rose-500/40 transition-all text-xs font-semibold">
                  <ShoppingCart size={14} />
                  <span>Adaugă</span>
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

    </section>
  );
}