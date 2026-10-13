"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from "react";

import { cn } from "@/lib/utils";
import { Check, Loader2, ShoppingBag } from "lucide-react";

type Phase = "idle" | "loading" | "added" | "error";

export type AddToCartButtonProps = Readonly<
  {
    label?: string;
    loadingLabel?: string;
    addedLabel?: string;
    errorLabel?: string;
    resetMs?: number;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  } & Omit<ComponentPropsWithoutRef<"button">, "onClick">
>;

// Icons stack in one fixed slot and fade with the same rhythm as the labels.
const ICON_LAYER =
  "absolute inset-0 grid place-items-center transition-opacity ease-out motion-reduce:transition-none";

// Labels stack in one grid cell; outgoing fades out, incoming fades in after.
const LABEL_LAYER =
  "col-start-1 row-start-1 text-center transition-opacity ease-out motion-reduce:transition-none";

// Add-to-cart — raised dark key that sinks while adding, then settles into a
// green added state; icon morphs bag → spinner → check in place.
export const AddToCartButton = forwardRef<
  HTMLButtonElement,
  AddToCartButtonProps
>(
  (
    {
      className,
      label = "Add to cart",
      loadingLabel = "Se adaugă…",
      addedLabel = "Adăugat în coș",
      errorLabel = "Nu s-a putut adăuga",
      resetMs = 1600,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [phase, setPhase] = useState<Phase>("idle");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
      if (timer.current) globalThis.clearTimeout(timer.current);
    }, []);

    const idle = phase === "idle";
    const loading = phase === "loading";
    const added = phase === "added";
    const failed = phase === "error";

    const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
      if (!idle) return;
      setPhase("loading");
      try {
        await onClick?.(event);
        setPhase("added");
        timer.current = globalThis.setTimeout(() => setPhase("idle"), resetMs);
      } catch {
        setPhase("error");
        timer.current = globalThis.setTimeout(() => setPhase("idle"), resetMs);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        data-slot="add-to-cart-button"
        data-phase={phase}
        aria-busy={loading || undefined}
        aria-disabled={!idle || undefined}
        title={failed ? errorLabel : undefined}
        onClick={handleClick}
        className={cn(
          "inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-xl px-5 font-sans text-sm font-semibold outline-none select-none",
          "transition-[background-color,box-shadow,color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
          // Raised dark key: soft blurred top sheen, deep lift + bottom recess.
          idle &&
            "cursor-pointer bg-neutral-800 text-white shadow-[0_1px_1px_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.28),0_8px_16px_rgba(0,0,0,0.22),inset_0_1px_2px_rgba(255,255,255,0.14),inset_0_-3px_6px_rgba(0,0,0,0.55)]",
          idle &&
            "hover:bg-neutral-700 active:bg-neutral-900 active:shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_2px_6px_rgba(0,0,0,0.55),inset_0_-1px_1px_rgba(255,255,255,0.06)]",
          // Adding: stays sunken while it works.
          loading &&
            "cursor-default bg-neutral-900 text-neutral-300 shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_2px_6px_rgba(0,0,0,0.55),inset_0_-1px_1px_rgba(255,255,255,0.06)]",
          // Added: pops back up as a solid emerald key.
          added &&
            "cursor-default bg-emerald-600 text-white shadow-[0_1px_1px_rgba(0,0,0,0.2),0_3px_6px_rgba(0,0,0,0.18),0_8px_16px_rgba(0,0,0,0.14),inset_0_1px_2px_rgba(255,255,255,0.2),inset_0_-3px_6px_rgba(0,0,0,0.35)]",
          failed && "cursor-default bg-rose-900 text-rose-100",
          className,
        )}
        {...props}
      >
        <span className="sr-only" aria-live="polite">
          {loading ? loadingLabel : added ? addedLabel : failed ? errorLabel : ""}
        </span>

        {/* Fixed icon slot keeps the icon and label aligned in every phase. */}
        <span className="relative size-4 shrink-0">
          <span
            aria-hidden
            className={cn(
              ICON_LAYER,
              idle || failed
                ? "opacity-100 delay-200 duration-300"
                : "opacity-0 duration-200",
            )}
          >
            <ShoppingBag size={15} strokeWidth={2} />
          </span>
          <span
            aria-hidden
            className={cn(
              ICON_LAYER,
              loading
                ? "opacity-100 delay-200 duration-300"
                : "opacity-0 duration-200",
            )}
          >
            <Loader2
              size={15}
              strokeWidth={2.5}
              className="animate-spin motion-reduce:animate-none"
            />
          </span>
          <span
            aria-hidden
            className={cn(
              ICON_LAYER,
              added
                ? "opacity-100 delay-200 duration-300"
                : "opacity-0 duration-200",
            )}
          >
            <Check size={16} strokeWidth={2.5} />
          </span>
        </span>

        <span className="grid">
          <span
            aria-hidden={!idle}
            className={cn(
              LABEL_LAYER,
              idle
                ? "opacity-100 delay-200 duration-300"
                : "opacity-0 duration-200",
            )}
          >
            {label}
          </span>
          <span
            aria-hidden={!loading}
            className={cn(
              LABEL_LAYER,
              loading
                ? "opacity-100 delay-200 duration-300"
                : "opacity-0 duration-200",
            )}
          >
            {loadingLabel}
          </span>
          <span
            aria-hidden={!added}
            className={cn(
              LABEL_LAYER,
              added
                ? "opacity-100 delay-200 duration-300"
                : "opacity-0 duration-200",
            )}
          >
            {addedLabel}
          </span>
          <span
            aria-hidden={!failed}
            className={cn(
              LABEL_LAYER,
              failed ? "opacity-100 delay-200 duration-300" : "opacity-0 duration-200",
            )}
          >
            {errorLabel}
          </span>
        </span>
      </button>
    );
  },
);

AddToCartButton.displayName = "AddToCartButton";