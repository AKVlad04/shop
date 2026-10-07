"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { API_BASE_URL, getProductImageUrl } from "@/lib/productImages";

interface Category {
  id: number;
  name: string;
  slug: string;
  product_count: number;
  image_url?: string | null;
  image: string;
}

const categoryImages = [
  "/categories/34.jpg",
  "/categories/48.jpg",
  "/categories/65.jpg",
  "/categories/67.jpg",
];

const categoryImagesBySlug: Record<string, string> = {
  standuri: "/categories/34.jpg",
  keychains: "/categories/48.jpg",
  altele: "/categories/65.jpg",
};

export function CategoriesGrid() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState(false);
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
    fetch(`${API_BASE_URL}/api/categories`)
      .then((response) => {
        if (!response.ok) throw new Error("Categoriile nu au putut fi încărcate.");
        return response.json();
      })
      .then((data: Omit<Category, "image">[]) => {
        setCategories(
          data.map((category) => ({
            ...category,
            image:
              (category.image_url ? getProductImageUrl(category.image_url) : null) ??
              categoryImagesBySlug[category.slug] ??
              categoryImages[(category.id - 1) % categoryImages.length],
          }))
        );
      })
      .catch((err: unknown) => {
        console.error("Eroare la preluarea categoriilor:", err);
        setError(true);
      });
  }, []);

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
        {categories.length > 2 && (
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollCarousel(-1)}
              aria-label="Categoriile anterioare"
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:border-rose-500/40 hover:bg-rose-950/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel(1)}
              aria-label="Următoarele categorii"
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:border-rose-500/40 hover:bg-rose-950/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-center text-sm text-neutral-400">
          Categoriile nu au putut fi încărcate momentan.
        </p>
      )}
      <div
        ref={carouselRef}
        className={
          categories.length > 2
            ? "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6"
            : "grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6"
        }
        aria-label={categories.length > 2 ? "Carusel categorii" : undefined}
      >
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/produse?category=${encodeURIComponent(cat.slug)}`}
            className={`group relative isolate h-72 shrink-0 snap-start overflow-hidden rounded-[28px] border border-white/10 bg-[#120B0E] p-6 flex flex-col justify-end transition-all duration-500 hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(225,29,72,0.2)] sm:h-80 ${
              categories.length > 2
                ? "w-[82%] sm:w-[60%] lg:w-[40%]"
                : "w-full"
            }`}
          >
            {/* Imaginea de fundal cu efect de Zoom la hover */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <Image
                src={cat.image}
                alt={cat.name}
                fill
                unoptimized
                className="object-cover opacity-70 transition-transform duration-700 ease-out group-hover:scale-110 group-hover:opacity-90"
              />
              {/* Gradient întunecat peste imagine ca textul să fie perfect vizibil */}
              <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0E0A0B] via-[#0E0A0B]/60 to-transparent" />
            </div>

            {/* Iconița de acțiune din colțul dreapta sus */}
            <div className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition-all duration-300 group-hover:border-rose-500/40 group-hover:bg-rose-950 group-hover:text-rose-300">
              <ArrowUpRight size={18} />
            </div>

            {/* Conținut text (Titlu și Subtitlu) */}
            <div className="relative z-20 transform transition-transform duration-300 group-hover:-translate-y-1">
              <p className="text-xs font-semibold text-rose-400 uppercase tracking-widest mb-1">
                {cat.product_count} {cat.product_count === 1 ? "produs" : "produse"}
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                {cat.name}
              </h3>
            </div>

          </Link>
        ))}
      </div>

    </section>
  );
}