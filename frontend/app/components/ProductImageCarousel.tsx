"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

interface ProductImageCarouselProps {
  images: string[];
  name: string;
  href: string;
  className: string;
  imageClassName?: string;
  children?: ReactNode;
}

export function ProductImageCarousel({
  images,
  name,
  href,
  className,
  imageClassName = "h-full w-full object-cover",
  children,
}: ProductImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className={`${className} relative flex items-center justify-center`}>
        <Link href={href} className="absolute inset-0 z-0" aria-label={name} />
        <span className="text-neutral-600 text-xs">Fără imagine</span>
        {children}
      </div>
    );
  }

  const changeImage = (direction: -1 | 1) => {
    setActiveIndex((currentIndex) =>
      (currentIndex + direction + images.length) % images.length
    );
  };

  const stopLinkNavigation = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={`${className} relative`}>
      <Link href={href} className="absolute inset-0 z-0" aria-label={name}>
        <img
          src={images[activeIndex]}
          alt={name}
          className={imageClassName}
        />
      </Link>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              stopLinkNavigation(event);
              changeImage(-1);
            }}
            aria-label={`Imaginea precedentă pentru ${name}`}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-1.5 text-white opacity-80 transition hover:bg-black/80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              stopLinkNavigation(event);
              changeImage(1);
            }}
            aria-label={`Imaginea următoare pentru ${name}`}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-1.5 text-white opacity-80 transition hover:bg-black/80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {children}
    </div>
  );
}
