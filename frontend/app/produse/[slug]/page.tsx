"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  RotateCcw,
} from "lucide-react";
import type { PointerEvent, TransitionEvent, WheelEvent } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DarkRoseNoirBackground } from "@/components/DarkRoseNoirBackground";
import { AddToCartButton } from "@/components/buttons/add-to-cart-button";
import { QuantityStepperButton } from "@/components/buttons/quantity-stepper-button";
import { addToCart } from "@/lib/cart";
import { API_BASE_URL, getProductImages } from "@/lib/productImages";

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image_url: string;
  images?: string[];
}

export default function SingleProductPage() {
  const params = useParams();
  const slug = params?.slug;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const panRef = useRef({ x: 0, y: 0 });
  const slideFrameRef = useRef<number | null>(null);
  const zoomBounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideDirectionRef = useRef<-1 | 1>(1);
  const dragRef = useRef<{
    pointerId: number;
    mode: "pan" | "carousel";
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    startedOnImage: boolean;
    moved: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!slug) return;

    fetch(`${API_BASE_URL}/api/products/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Produsul nu a putut fi găsit.");
        return res.json();
      })
      .then((data) => {
        setProduct(data);
        setQuantity(1);
        const allImages = getProductImages(data);
        setSelectedImage(allImages[0] ?? "");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  // Colectăm toate imaginile disponibile pentru acest produs
  const productImages = useMemo(
    () => (product ? getProductImages(product) : []),
    [product]
  );

  const resetZoom = useCallback(() => {
    if (zoomBounceTimeoutRef.current) {
      clearTimeout(zoomBounceTimeoutRef.current);
      zoomBounceTimeoutRef.current = null;
    }
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
  }, []);

  const updatePan = useCallback((nextPan: { x: number; y: number }) => {
    panRef.current = nextPan;
    setPan(nextPan);
  }, []);

  const changeSelectedImage = useCallback(
    (direction: -1 | 1) => {
      if (productImages.length < 2) return;
      const currentIndex = productImages.indexOf(selectedImage);
      const index = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (index + direction + productImages.length) % productImages.length;
      setSelectedImage(productImages[nextIndex]);
      resetZoom();
    },
    [productImages, resetZoom, selectedImage]
  );

  const selectImage = (image: string) => {
    setSelectedImage(image);
    resetZoom();
  };

  const setWheelZoom = useCallback((direction: -1 | 1) => {
    const levels = [1, 1.5, 2, 3];
    const currentIndex = levels.indexOf(zoomLevel);
    const index = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.max(0, Math.min(levels.length - 1, index + direction));
    if (nextIndex !== index) {
      if (zoomBounceTimeoutRef.current) {
        clearTimeout(zoomBounceTimeoutRef.current);
        zoomBounceTimeoutRef.current = null;
      }
      setZoomLevel(levels[nextIndex]);
      if (nextIndex === 0) updatePan({ x: 0, y: 0 });
      return;
    }

    if (direction < 0 && index === 0) {
      if (zoomBounceTimeoutRef.current) clearTimeout(zoomBounceTimeoutRef.current);
      setZoomLevel(0.92);
      zoomBounceTimeoutRef.current = setTimeout(() => {
        setZoomLevel(1);
        zoomBounceTimeoutRef.current = null;
      }, 150);
    }
  }, [updatePan, zoomLevel]);

  const closeZoom = useCallback(() => {
    setIsZoomOpen(false);
    resetZoom();
  }, [resetZoom]);

  const handleImageWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setWheelZoom(event.deltaY < 0 ? 1 : -1);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (isSliding) return;
    const target = event.target;
    const startedOnImage =
      target instanceof Element &&
      target.closest("img[data-current-image='true']") !== null;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      mode: zoomLevel > 1 ? "pan" : "carousel",
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startedOnImage,
      moved: false,
    };
    setIsPanning(zoomLevel > 1);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (Math.abs(event.clientX - drag.startX) > 3 || Math.abs(event.clientY - drag.startY) > 3) {
      drag.moved = true;
    }
    if (drag.mode === "pan") {
      const bounds = event.currentTarget.getBoundingClientRect();
      const image = event.currentTarget.querySelector<HTMLImageElement>(
        "[data-current-image='true']"
      );
      const imageWidth = (image?.offsetWidth ?? bounds.width) * zoomLevel;
      const imageHeight = (image?.offsetHeight ?? bounds.height) * zoomLevel;
      const visibleEdge = 48;
      const maxX = Math.max(0, (imageWidth + bounds.width) / 2 - visibleEdge);
      const maxY = Math.max(0, (imageHeight + bounds.height) / 2 - visibleEdge);
      const nextPan = {
        x: Math.max(-maxX, Math.min(maxX, panRef.current.x + deltaX)),
        y: Math.max(-maxY, Math.min(maxY, panRef.current.y + deltaY)),
      };
      updatePan(nextPan);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const totalDeltaX = event.clientX - drag.startX;
    setDragOffsetX(Math.max(-bounds.width, Math.min(bounds.width, totalDeltaX)));
  };

  const stepZoomFromClick = () => {
    if (zoomLevel >= 3) setZoomLevel(2);
    else if (zoomLevel >= 2) setZoomLevel(3);
    else if (zoomLevel >= 1.5) setZoomLevel(2);
    else setZoomLevel(1.5);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.mode === "pan") {
      setIsPanning(false);
      if (!drag.moved && drag.startedOnImage) stepZoomFromClick();
      return;
    }

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 45) {
      slideDirectionRef.current = deltaX < 0 ? 1 : -1;
      setIsSliding(true);
      const finalOffset =
        deltaX < 0 ? -event.currentTarget.clientWidth : event.currentTarget.clientWidth;
      slideFrameRef.current = requestAnimationFrame(() => {
        setDragOffsetX(finalOffset);
        slideFrameRef.current = null;
      });
    } else {
      setDragOffsetX(0);
      if (!drag.moved && drag.startedOnImage) stepZoomFromClick();
    }
  };

  const handleCarouselTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !isSliding) return;
    changeSelectedImage(slideDirectionRef.current);
    setDragOffsetX(0);
    setIsSliding(false);
  };

  useEffect(() => {
    if (!isZoomOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeZoom();
      if (event.key === "ArrowLeft") changeSelectedImage(-1);
      if (event.key === "ArrowRight") changeSelectedImage(1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isZoomOpen, changeSelectedImage, closeZoom]);

  return (
    <DarkRoseNoirBackground className="flex min-h-screen w-full flex-col justify-between relative overflow-x-hidden">
      <Navbar />

      <main className="w-full max-w-5xl mx-auto px-4 pt-32 pb-16 relative z-10 flex-1">
        {loading && <p className="text-white text-center">Se încarcă produsul...</p>}
        {error && <p className="text-rose-400 text-center">{error}</p>}

        {product && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start bg-[#120B0E]/80 border border-white/10 p-6 rounded-[24px] backdrop-blur-xl shadow-2xl">
            
            {/* Zona de Galerie Foto */}
            <div className="flex flex-col gap-4">
              {/* Poză Principală Mare */}
              <div className="w-full h-[350px] rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden relative shadow-inner">
                {selectedImage ? (
                  <button
                    type="button"
                    onClick={() => {
                      resetZoom();
                      setIsZoomOpen(true);
                    }}
                    aria-label="Deschide galeria imaginii"
                    className="h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500"
                  >
                    <img
                      src={selectedImage}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <span className="text-neutral-500 text-xs">Fără imagine</span>
                )}
              </div>

              {/* Miniaturi (Thumbnails) jos */}
              {productImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {productImages.map((img, index) => (
                    <button
                      key={img}
                      onClick={() => selectImage(img)}
                      aria-label={`Vezi imaginea ${index + 1}`}
                      aria-pressed={selectedImage === img}
                      className={`h-20 rounded-xl overflow-hidden border transition-all bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                        selectedImage === img
                          ? "border-rose-500 ring-2 ring-rose-500/40"
                          : "border-white/10 opacity-70 hover:opacity-100 hover:border-rose-500/60"
                      }`}
                    >
                      <img src={img} alt={`${product.name} — imagine ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Detalii produs */}
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-rose-400">
                Categorie: {product.category}
              </span>
              <h1 className="text-3xl font-black text-white">{product.name}</h1>
              <p className="text-neutral-300 text-sm leading-relaxed">{product.description}</p>
              
              <div className="text-2xl font-black text-rose-300 pt-2">
                {product.price.toFixed(2)} Lei
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-4">
                <QuantityStepperButton value={quantity} min={1} onChange={setQuantity} aria-label="Cantitatea produsului" />
                <AddToCartButton
                  label="Adaugă în coș"
                  loadingLabel="Se adaugă…"
                  addedLabel="Adăugat în coș"
                  errorLabel="Nu s-a putut adăuga"
                  onClick={() => addToCart(product.id, quantity)}
                  className="h-11 min-w-0 rounded-xl bg-gradient-to-r from-rose-900 to-rose-950 px-6 text-xs font-bold uppercase shadow-lg"
                />
                <button 
                  onClick={() => alert("Adăugat la favorite!")}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all"
                >
                  ❤️ Favorit
                </button>
              </div>
            </div>

          </div>
        )}
      </main>

      {isZoomOpen && selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie foto: ${product?.name}`}
          onClick={closeZoom}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative flex h-[min(78vh,680px)] w-[min(94vw,1050px)] overflow-hidden rounded-2xl border border-white/10 bg-[#120B0E] text-white shadow-2xl"
          >
            <aside className="w-20 shrink-0 overflow-y-auto border-r border-white/10 bg-black/20 p-2 sm:w-32 sm:p-3">
              <div className="grid grid-cols-1 gap-2">
                {productImages.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => selectImage(image)}
                    aria-label={`Vezi imaginea ${index + 1}`}
                    aria-pressed={selectedImage === image}
                    className={`aspect-square w-full overflow-hidden rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      selectedImage === image
                        ? "border-rose-500 ring-2 ring-rose-500/30"
                        : "border-white/10 hover:border-rose-400/60"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product?.name ?? "Produs"} — imagine ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <span className="truncate pr-4 text-sm text-white/70">{product?.name}</span>
                <button
                  type="button"
                  onClick={closeZoom}
                  aria-label="Închide galeria"
                  className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/15">
                {productImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => changeSelectedImage(-1)}
                      aria-label="Imaginea precedentă"
                      className="absolute left-3 z-20 rounded-full border border-white/15 bg-black/50 p-2 text-white/80 transition hover:bg-black/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeSelectedImage(1)}
                      aria-label="Imaginea următoare"
                      className="absolute right-3 z-20 rounded-full border border-white/15 bg-black/50 p-2 text-white/80 transition hover:bg-black/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}

                <div
                  onWheel={handleImageWheel}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={`absolute inset-0 touch-none overflow-hidden ${
                    isPanning
                      ? "cursor-grabbing"
                      : zoomLevel >= 3
                        ? "cursor-zoom-out"
                        : "cursor-zoom-in"
                  }`}
                >
                  <div
                    onTransitionEnd={handleCarouselTransitionEnd}
                    style={{
                      transform: `translateX(calc(-33.333333% + ${dragOffsetX}px))`,
                      transition: isSliding ? "transform 260ms ease-out" : "none",
                    }}
                    className="flex h-full w-[300%]"
                  >
                    {[
                      productImages[
                        (productImages.indexOf(selectedImage) - 1 + productImages.length) %
                          productImages.length
                      ],
                      selectedImage,
                      productImages[
                        (productImages.indexOf(selectedImage) + 1) % productImages.length
                      ],
                    ].map((image, index) => (
                      <div
                        key={`${image}-${index}`}
                        className="flex h-full w-1/3 shrink-0 items-center justify-center overflow-hidden p-3 sm:p-8"
                      >
                        <img
                          src={image}
                          alt={product?.name ?? "Imagine produs"}
                          draggable={false}
                          data-current-image={index === 1 ? "true" : undefined}
                          style={
                            index === 1
                              ? {
                                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                                }
                              : undefined
                          }
                          className={`max-h-full max-w-full select-none object-contain ${
                            index === 1 ? "transition-transform duration-150 ease-out" : ""
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex h-14 shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-black/20">
                <button
                  type="button"
                  onClick={() => setWheelZoom(1)}
                  disabled={zoomLevel >= 3}
                  aria-label="Mărește zoom-ul"
                  className="rounded-full border border-white/15 p-2 text-white/75 transition hover:bg-white/10 disabled:opacity-35"
                >
                  <Plus size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setWheelZoom(-1)}
                  disabled={zoomLevel <= 1}
                  aria-label="Micșorează zoom-ul"
                  className="rounded-full border border-rose-400/60 p-2 text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-35"
                >
                  <Minus size={17} />
                </button>
                <button
                  type="button"
                  onClick={resetZoom}
                  aria-label="Resetează zoom-ul"
                  className="rounded-full border border-white/15 p-2 text-white/75 transition hover:bg-white/10"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </DarkRoseNoirBackground>
  );
}