"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart } from "lucide-react";
import { UserMenuDropdown } from "@/components/dropdowns/user-menu-dropdown";
import { NonuserMenuDropdown } from "@/components/dropdowns/nonuser-menu-dropdown";
import { API_BASE_URL } from "@/lib/productImages";
import { cartCount as countCartItems, readCart, subscribeToCart } from "@/lib/cart";

interface AuthUser {
  id: number;
  firstName: string;
  email: string;
  role?: string | null;
}

export function Navbar() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const refreshCartCount = () => setCartCount(countCartItems(readCart()));
    refreshCartCount();
    return subscribeToCart(refreshCartCount);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const refreshSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
        if (!response.ok) throw new Error("Sesiunea nu a putut fi verificată.");
        const result: { user: AuthUser | null } = await response.json();
        let user = result.user;
        if (user && !user.role) {
          try {
            const ownerCheck = await fetch(`${API_BASE_URL}/api/admin/overview`, {
              credentials: "include",
              cache: "no-store",
            });
            if (ownerCheck.ok) user = { ...user, role: "owner" };
          } catch (error) {
            console.error("Eroare la verificarea accesului owner:", error);
          }
        }
        if (isCurrent) setAuthUser(user);
      } catch (error) {
        console.error("Eroare la verificarea sesiunii utilizatorului:", error);
        if (isCurrent) setAuthUser(null);
      } finally {
        if (isCurrent) setAuthChecked(true);
      }
    };
    const handleAuthChange = () => {
      void refreshSession();
    };

    void refreshSession();
    window.addEventListener("shop-auth-changed", handleAuthChange);
    return () => {
      isCurrent = false;
      window.removeEventListener("shop-auth-changed", handleAuthChange);
    };
  }, []);

  const logout = async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Deconectarea nu a reușit.");
    setAuthUser(null);
    window.dispatchEvent(new Event("shop-auth-changed"));
    router.replace("/");
    router.refresh();
  };
  const isOwner = authUser?.role?.trim().toLowerCase() === "owner";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-6 pointer-events-none">
      <nav className="w-full max-w-6xl grid grid-cols-3 items-center px-8 py-4 bg-[#120B0E]/70 border border-white/10 backdrop-blur-2xl rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.6)] pointer-events-auto transition-all duration-300 ">
        
        {/* COLOANA 1: STANGA (SHOP) */}
        <div className="flex items-center justify-start">
          <Link 
            href="/" 
            className="text-base font-extrabold tracking-[0.3em] text-white uppercase hover:text-rose-300 transition-colors"
          >
            SHOP
          </Link>
        </div>

        {/* COLOANA 2: CENTRU (Butoanele de navigare mărite) */}
        <div className="hidden md:flex items-center justify-center gap-2 px-2 py-1 justify-self-center">
          <Link 
            href="/produse" 
            className="px-5 py-2 text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            Produse
          </Link>
          <Link 
            href="/materiale" 
            className="px-5 py-2 text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            Materiale
          </Link>
          <Link 
            href="/estimator" 
            className="px-5 py-2 text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            Estimator
          </Link>
        </div>

        {/* COLOANA 3: DREAPTA (Cont, Favorite, Coș mărite) */}
        <div className="flex items-center justify-end gap-2.5 sm:gap-3">
          
          {authChecked ? (
            authUser ? (
              <UserMenuDropdown
                userName={authUser.firstName}
                userEmail={authUser.email}
                isOwner={isOwner}
                onLogout={logout}
              />
            ) : (
              <NonuserMenuDropdown />
            )
          ) : (
            <span aria-hidden className="h-10 w-16 animate-pulse rounded-full border border-white/10 bg-white/[0.04]" />
          )}

          {/* Favorite */}
          <Link 
            href="/favorite" 
            className="flex items-center gap-2.5 px-4 py-2 rounded-full hover:bg-white/10 text-neutral-200 hover:text-white transition-all text-sm font-medium group"
          >
            <Heart size={18} className="text-neutral-400 group-hover:text-rose-400 transition-colors" />
            <span className="hidden lg:inline">Favorite</span>
          </Link>

          {/* Coșul meu */}
          <Link 
            href="/cart" 
            className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-rose-950/50 border border-rose-500/30 hover:bg-rose-900/50 text-rose-200 transition-all text-sm font-semibold group shadow-[0_0_20px_rgba(225,29,72,0.2)]"
          >
            <ShoppingCart size={18} className="text-rose-400 group-hover:scale-110 transition-transform" />
            <span>Coș</span>
            {cartCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{cartCount > 99 ? "99+" : cartCount}</span>}
          </Link>

        </div>
      </nav>
    </header>
  );
}