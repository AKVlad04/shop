export type CartEntry = {
  productId: number;
  quantity: number;
};

const CART_STORAGE_KEY = "shop-cart-v1";
const CART_UPDATED_EVENT = "shop-cart-updated";

export function readCart(): CartEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((entry): entry is CartEntry => (
      entry !== null
      && typeof entry === "object"
      && Number.isInteger(entry.productId)
      && entry.productId > 0
      && Number.isInteger(entry.quantity)
      && entry.quantity > 0
      && entry.quantity <= 99
    ));
  } catch {
    return [];
  }
}

export function writeCart(entries: CartEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function addToCart(productId: number, quantity = 1) {
  if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new Error("Produsul sau cantitatea nu sunt valide.");
  }
  const cart = readCart();
  const existing = cart.find((entry) => entry.productId === productId);
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + quantity);
  } else {
    cart.push({ productId, quantity });
  }
  writeCart(cart);
}

export function cartCount(entries: CartEntry[]) {
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

export function subscribeToCart(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CART_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function getCartSnapshot() {
  return JSON.stringify(readCart());
}
