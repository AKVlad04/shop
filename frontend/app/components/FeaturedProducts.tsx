"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { API_BASE_URL } from "@/lib/productImages";

export function FeaturedProducts() {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    carousel.scrollBy({
      left: direction * carousel.clientWidth,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        const featured = data.filter((p: ProductCardData) => p.is_featured === 1);
        setProducts(featured.length > 0 ? featured : data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Eroare la preluarea produselor:", err);
        setLoading(false);
      });
  }, []);

  if (loading || products.length === 0) return null;

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-16 relative">
      
      {/* Titlul secțiunii */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-rose-400">
            Top Selecție
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Produse Apreciate
          </h2>
        </div>
        {products.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollCarousel(-1)}
              aria-label="Produsele recomandate anterioare"
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:border-rose-500/40 hover:bg-rose-950/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel(1)}
              aria-label="Următoarele produse recomandate"
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:border-rose-500/40 hover:bg-rose-950/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={carouselRef}
        className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-3 pl-0 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Carusel produse apreciate"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="w-full shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-5rem)/4.333)]"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>

    </section>
  );
}