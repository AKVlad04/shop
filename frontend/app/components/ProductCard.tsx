"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { ProductImageCarousel } from "@/components/ProductImageCarousel";
import { AddToCartButton } from "@/components/buttons/add-to-cart-button";
import { addToCart } from "@/lib/cart";
import { getProductImages } from "@/lib/productImages";

export interface ProductCardData {
  id: number;
  name: string;
  slug: string;
  price: number;
  category: string;
  category_id?: number;
  category_slug?: string;
  image_url: string;
  images?: string[];
  is_featured: number;
}

interface ProductCardProps {
  product: ProductCardData;
}

export function ProductCard({ product }: ProductCardProps) {
  const productHref = `/produse/${product.slug}`;

  return (
    <article className="group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-[#120B0E]/50 p-4 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-rose-500/40 hover:bg-[#120B0E]/80">
      <ProductImageCarousel
        images={getProductImages(product)}
        name={product.name}
        href={productHref}
        className="mb-4 h-52 w-full overflow-hidden rounded-2xl bg-neutral-900"
        imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      >
        {product.is_featured === 1 && (
          <span className="absolute left-3 top-3 z-20 rounded-full border border-rose-500/30 bg-rose-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-200 shadow-lg backdrop-blur-md">
            Popular
          </span>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            alert("Adăugat la favorite!");
          }}
          className="absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-black/40 p-2 text-white transition-all hover:bg-black/60 hover:text-rose-400 backdrop-blur-md"
          aria-label={`Adaugă ${product.name} la favorite`}
        >
          <Heart size={16} />
        </button>
      </ProductImageCarousel>

      <div className="flex flex-1 flex-col">
        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
          {product.category}
        </span>
        <Link href={productHref}>
          <h2 className="mt-1 mb-3 line-clamp-1 text-sm font-semibold text-white transition-colors group-hover:text-rose-300">
            {product.name}
          </h2>
        </Link>

        <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-lg font-black text-white">
            {product.price.toFixed(2)} Lei
          </span>
          <AddToCartButton
            label="Adaugă"
            loadingLabel="Se adaugă…"
            addedLabel="Adăugat"
            errorLabel="Eroare"
            onClick={() => addToCart(product.id)}
            className="h-9 min-w-0 rounded-full border border-rose-500/20 bg-rose-950/40 px-3.5 py-2 text-xs text-rose-200 shadow-none hover:border-rose-500/40 hover:bg-rose-900/60"
          />
        </div>
      </div>
    </article>
  );
}
