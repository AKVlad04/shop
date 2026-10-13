"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type UserMenuItem = {
  id?: string;
  label: string;
  href?: string;
  icon: typeof UserRound;
  danger?: boolean;
  onClick?: () => void;
};

export type UserMenuDropdownProps = {
  userName: string;
  userEmail: string;
  isOwner?: boolean;
  onLogout: () => Promise<void>;
  items?: readonly UserMenuItem[];
  onItemClick?: (item: UserMenuItem) => void;
};

const defaultItems: readonly UserMenuItem[] = [
  { id: "profile", label: "Profilul meu", icon: UserRound },
  { id: "orders", label: "Comenzile mele", icon: Package },
  { id: "favorites", label: "Favorite", icon: Heart },
  { id: "settings", label: "Setări cont", icon: Settings },
  { id: "sign-out", label: "Deconectare", icon: LogOut, danger: true },
];

type UserMenuItemRowProps = {
  item: UserMenuItem;
  onSelect: (item: UserMenuItem) => void;
};

function UserMenuItemRow({ item, onSelect }: UserMenuItemRowProps) {
  const Icon = item.icon;
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
    item.danger
      ? "text-rose-300 hover:bg-rose-950/60"
      : "text-neutral-200 hover:bg-white/[0.07]",
  );
  const content = (
    <>
      <Icon size={16} className={item.danger ? "text-rose-400" : "text-neutral-400"} />
      <span>{item.label}</span>
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} role="menuitem" className={className} onClick={() => onSelect(item)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" role="menuitem" onClick={() => onSelect(item)} className={className}>
      {content}
    </button>
  );
}

export function UserMenuDropdown({
  userName,
  userEmail,
  isOwner = false,
  onLogout,
  items = defaultItems,
  onItemClick,
}: UserMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const visibleItems = isOwner
    ? [{ id: "dashboard", label: "Dashboard", href: "/atelier-privat-n3x-7k4p9x", icon: LayoutDashboard }, ...items]
    : items;

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleItemSelect = async (item: UserMenuItem) => {
    setActionError("");
    try {
      if (item.id === "sign-out") await onLogout();
      item.onClick?.();
      onItemClick?.(item);
      setOpen(false);
    } catch (error) {
      console.error("Eroare la deconectare:", error);
      setActionError(error instanceof Error ? error.message : "Deconectarea nu a reușit.");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Meniul utilizatorului ${userName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="group flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-neutral-200 transition hover:border-rose-500/30 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-rose-950/70 text-xs font-bold text-rose-200">
          {userName.trim().charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate text-xs font-medium sm:inline">{userName}</span>
        <ChevronDown size={14} className={cn("text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Meniul ${userName}`}
          className="absolute right-0 top-[calc(100%+10px)] z-[60] w-64 origin-top-right rounded-2xl border border-white/10 bg-[#160d11]/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        >
          <div className="border-b border-white/10 px-3 py-3">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="mt-1 truncate text-xs text-neutral-400">{userEmail}</p>
          </div>
          <div className="pt-2">
            {visibleItems.map((item) => (
              <UserMenuItemRow
                key={item.id ?? item.label}
                item={item}
                onSelect={handleItemSelect}
              />
            ))}
          </div>
          {actionError && <p role="alert" className="px-3 pt-2 text-xs text-red-300">{actionError}</p>}
        </div>
      )}
    </div>
  );
}