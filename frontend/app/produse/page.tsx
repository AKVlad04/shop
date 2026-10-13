"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DarkRoseNoirBackground } from "@/components/DarkRoseNoirBackground";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { API_BASE_URL } from "@/lib/productImages";

type ProductSort = "default" | "popular" | "newest" | "price-asc" | "price-desc";

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "default", label: "Implicit" },
  { value: "popular", label: "Cele mai populare" },
  { value: "newest", label: "Cele mai noi" },
  { value: "price-asc", label: "Preț: crescător" },
  { value: "price-desc", label: "Preț: descrescător" },
];

function ProductsCatalog() {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category");
  const [products, setProducts] = useState<(ProductCardData & {
    description: string;
    tags?: string[];
    created_at: string;
  })[]>([]);
  const initialSearch = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [sortOrder, setSortOrder] = useState<ProductSort>("default");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSortMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSortMenuOpen(false);
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest("[data-sort-menu]")
      ) {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isSortMenuOpen]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Eroare la preluarea produselor:", err);
        setLoading(false);
      });
  }, []);

  const normalizedSearchTerms = useMemo(
    () =>
      appliedSearch
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((term) => !["de", "din", "pentru", "si", "cu", "la", "un", "o"].includes(term)),
    [appliedSearch]
  );

  const sortedProducts = useMemo(() => {
    const matchingProducts = products.filter((product) => {
      if (categorySlug && product.category_slug !== categorySlug) return false;

      const searchableText = [
        product.name,
        product.category,
        ...(product.tags ?? []),
      ]
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      return normalizedSearchTerms.every((term) => searchableText.includes(term));
    });

    return [...matchingProducts].sort((left, right) => {
      switch (sortOrder) {
        case "popular":
          return right.is_featured - left.is_featured || left.id - right.id;
        case "newest":
          return Date.parse(right.created_at) - Date.parse(left.created_at) || right.id - left.id;
        case "price-asc":
          return left.price - right.price || left.id - right.id;
        case "price-desc":
          return right.price - left.price || left.id - right.id;
        default:
          return left.id - right.id;
      }
    });
  }, [categorySlug, products, normalizedSearchTerms, sortOrder]);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(searchInput);
  };

  return (
    <DarkRoseNoirBackground className="flex min-h-screen w-full flex-col justify-between relative overflow-x-hidden">
      <Navbar />

      <main className="w-full max-w-6xl mx-auto px-4 pt-32 pb-16 relative z-10 flex-1">
        
        {/* Titlu și secțiune de control (Contor produse + Căutare) */}
        <div className="relative z-30 mb-8 flex flex-col items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[#120B0E]/80 p-6 shadow-xl backdrop-blur-xl md:flex-row">
          <div>
            <h1 className="text-2xl font-black text-white">Toate produsele</h1>
            <p className="text-neutral-400 text-xs mt-1">
              {loading ? "Se calculează..." : `Sunt disponibile ${sortedProducts.length} produse`}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
            <form onSubmit={applySearch} className="flex min-w-0 flex-1 gap-2">
            <input
              type="text"
              placeholder="Caută după nume sau tag..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-xs text-white transition-all focus:border-rose-500/50 focus:outline-none sm:w-64"
            />
              <button
                type="submit"
                className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-950/60 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/70"
              >
                Caută
              </button>
            </form>
            <div className={`relative w-full sm:w-52 ${isSortMenuOpen ? "z-50" : ""}`} data-sort-menu>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isSortMenuOpen}
                onClick={() => setIsSortMenuOpen((open) => !open)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-black/40 px-3.5 py-2.5 text-left text-xs transition-all ${
                  isSortMenuOpen
                    ? "border-rose-500/50 shadow-[0_0_18px_rgba(225,29,72,0.12)]"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <SlidersHorizontal size={15} className="shrink-0 text-rose-300" />
                  <span className="truncate text-neutral-200">
                    {sortOptions.find((option) => option.value === sortOrder)?.label}
                  </span>
                </span>
                <ChevronDown
                  size={15}
                  className={`shrink-0 text-neutral-500 transition-transform ${
                    isSortMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isSortMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Sortează produsele"
                  className="absolute right-0 top-[calc(100%+8px)] z-[60] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#160d11]/95 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
                >
                  <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                    Sortează după
                  </p>
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={sortOrder === option.value}
                      onClick={() => {
                        setSortOrder(option.value);
                        setIsSortMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                        sortOrder === option.value
                          ? "bg-rose-950/55 font-semibold text-rose-200"
                          : "text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span>{option.label}</span>
                      {sortOrder === option.value && (
                        <Check size={15} className="text-rose-300" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loader sau Mesaj dacă nu sunt produse */}
        {loading && <p className="text-white text-center py-10">Se încarcă produsele...</p>}
        
        {!loading && sortedProducts.length === 0 && (
          <p className="text-neutral-400 text-center py-10">Nu am găsit niciun produs conform căutării.</p>
        )}

        {/* Grila de produse */}
        <div className="relative z-0 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

      </main>

      <Footer />
    </DarkRoseNoirBackground>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-white">Se încarcă produsele...</p>}>
      <ProductsCatalog />
    </Suspense>
  );
}