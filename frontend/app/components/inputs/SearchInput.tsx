"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
} from "react";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchInputProps = Readonly<
  {
    label?: string;
    hint?: string;
    error?: boolean;
    errorMessage?: string;
    clearLabel?: string;
    containerClassName?: string;
    onClear?: () => void;
  } & Omit<ComponentPropsWithoutRef<"input">, "size" | "type" | "onChange">
> & {
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      className,
      containerClassName,
      id,
      label = "Search",
      hint,
      error = false,
      errorMessage = "Enter a valid search term.",
      clearLabel = "Clear search",
      disabled,
      value,
      defaultValue = "",
      placeholder = "Caută piese, suporturi, decorațiuni 3D...",
      onChange,
      onClear,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const localRef = useRef<HTMLInputElement | null>(null);

    const isControlled = value !== undefined;
    const [internal, setInternal] = useState(String(defaultValue));
    const current = isControlled ? String(value) : internal;
    const hasValue = current.length > 0;

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        if (!isControlled) setInternal(next);
        onChange?.(next, event);
      },
      [isControlled, onChange],
    );

    const handleClear = useCallback(() => {
      if (!isControlled) setInternal("");
      onClear?.();
      localRef.current?.focus();
    }, [isControlled, onClear]);

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        localRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
      },
      [ref],
    );

    useEffect(() => {
      if (isControlled) return;
      const form = localRef.current?.form;
      if (!form) return;
      const handleReset = () => setInternal(String(defaultValue));
      form.addEventListener("reset", handleReset);
      return () => form.removeEventListener("reset", handleReset);
    }, [defaultValue, isControlled]);

    return (
      <div
        data-slot="search-input"
        data-error={error || undefined}
        className={cn("w-full max-w-md font-sans", containerClassName)}
      >
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>

        <div className="relative group">
          <Search
            size={18}
            strokeWidth={2}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-neutral-400 group-focus-within:text-rose-400 transition-colors"
          />

          <input
            ref={setRefs}
            id={inputId}
            type="search"
            role="searchbox"
            disabled={disabled}
            value={current}
            placeholder={placeholder}
            aria-invalid={error || undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            onChange={handleChange}
            className={cn(
              "h-12 w-full rounded-full border bg-[#120B0E]/80 py-2 pr-12 pl-12 font-sans text-sm text-neutral-100 transition-all duration-300 outline-none backdrop-blur-xl placeholder:text-neutral-500 shadow-inner",
              "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
              error
                ? "border-rose-500 focus:border-rose-400"
                : "border-white/10 focus:border-rose-500/50 focus:bg-[#120B0E] focus:shadow-[0_0_20px_rgba(225,29,72,0.15)]",
              className,
            )}
            {...props}
          />

          {hasValue && !disabled ? (
            <button
              type="button"
              aria-label={clearLabel}
              onClick={handleClear}
              className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={15} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-rose-500 px-4">
            {errorMessage}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1.5 text-xs text-neutral-400 px-4">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";