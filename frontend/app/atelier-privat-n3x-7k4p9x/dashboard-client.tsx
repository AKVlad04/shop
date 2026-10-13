"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Ticket,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { API_BASE_URL } from "@/lib/productImages";
import { getProductImageUrl } from "@/lib/productImages";

type Section = "overview" | "products" | "orders" | "users" | "coupons";
type Category = { id: number; name: string; imageUrl?: string | null };
type Coupon = {
  id: number;
  code: string;
  name: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};
type Product = {
  id: number;
  name: string;
  slug: string;
  price: number;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  imageUrl: string | null;
  images: string[];
  tags: string[];
  isFeatured: boolean;
};

type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "user" | "owner";
  createdAt: string;
  orderCount: number;
};
type Order = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  totalPrice: number;
  status: "pending" | "processing" | "fulfilled" | "cancelled";
  createdAt: string;
  items: { productName: string; color: string | null; infill: number | null; quantity: number; price: number }[];
};
type DashboardOrder = Pick<Order, "id" | "firstName" | "lastName" | "totalPrice" | "status" | "createdAt">
  & Partial<Pick<Order, "email" | "phone" | "shippingAddress" | "items">>;
type Overview = {
  stats: { orderCount: number; pendingOrders: number; productCount: number; userCount: number; orderValue: number; completedValue: number };
  recentOrders: Pick<Order, "id" | "firstName" | "lastName" | "totalPrice" | "status" | "createdAt">[];
};
type ProductForm = {
  name: string;
  slug: string;
  price: string;
  description: string;
  categoryId: string;
  imageUrl: string;
  images: string;
  tags: string;
  isFeatured: boolean;
};

const emptyProductForm: ProductForm = {
  name: "",
  slug: "",
  price: "",
  description: "",
  categoryId: "",
  imageUrl: "",
  images: "",
  tags: "",
  isFeatured: false,
};

const statusLabels: Record<Order["status"], string> = {
  pending: "În așteptare",
  processing: "În lucru",
  fulfilled: "Finalizată",
  cancelled: "Anulată",
};

const fieldClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-rose-500/50";
const cardClass = "rounded-2xl border border-white/[0.08] bg-[#180f13]/85 shadow-[0_18px_50px_rgba(0,0,0,0.18)]";

function money(value: number) {
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 2 }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || "Cererea nu a putut fi completată."), { status: response.status });
  return result as T;
}

export default function DashboardPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState<number | "new" | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [uploadingCategoryImage, setUploadingCategoryImage] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [couponSearch, setCouponSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [editingCoupon, setEditingCoupon] = useState<number | "new" | null>(null);
  const [couponForm, setCouponForm] = useState({ code: "", name: "", discountType: "percent" as "fixed" | "percent", discountValue: "", expiresAt: "", isActive: true });
  const [savingCoupon, setSavingCoupon] = useState(false);

  const uploadImages = async (files: FileList | null, useAsMain = false) => {
    if (!files?.length) return;
    setUploadingImages(true);
    setError("");
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("images", file));
      const response = await fetch(`${API_BASE_URL}/api/admin/products/images`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json().catch(() => ({})) as { images?: string[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Imaginile nu au putut fi încărcate.");
      const uploaded = result.images ?? [];
      if (useAsMain && uploaded[0]) {
        setProductForm((current) => ({ ...current, imageUrl: uploaded[0] }));
      } else {
        setProductForm((current) => ({
          ...current,
          images: [...new Set([...current.images.split("\n").map((image) => image.trim()).filter(Boolean), ...uploaded])].join("\n"),
        }));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Imaginile nu au putut fi încărcate.");
    } finally {
      setUploadingImages(false);
    }
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    setError("");
    try {
      await apiRequest(editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : "/api/admin/categories", {
        method: editingCategoryId ? "PATCH" : "POST",
        body: JSON.stringify({ name, imageUrl: categoryImageUrl }),
      });
      setCategoryName("");
      setCategoryImageUrl("");
      setEditingCategoryId(null);
      setCreatingCategory(false);
      await loadSection("products");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Categoria nu a putut fi creată.");
    } finally {
      setSavingCategory(false);
    }
  };

  const uploadCategoryImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadingCategoryImage(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(`${API_BASE_URL}/api/admin/categories/images`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json() as { imageUrl?: string; error?: string };
      if (!response.ok || !result.imageUrl) throw new Error(result.error || "Imaginea categoriei nu a putut fi încărcată.");
      setCategoryImageUrl(result.imageUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Imaginea categoriei nu a putut fi încărcată.");
    } finally {
      setUploadingCategoryImage(false);
    }
  };

  const beginCategoryForm = (category?: Category) => {
    setEditingCategoryId(category?.id ?? null);
    setCategoryName(category?.name ?? "");
    setCategoryImageUrl(category?.imageUrl ?? "");
    setCreatingCategory(true);
    setError("");
  };

  const beginCouponForm = (coupon?: Coupon) => {
    setEditingCoupon(coupon?.id ?? "new");
    setCouponForm(coupon ? {
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : "",
      isActive: coupon.isActive,
    } : { code: "", name: "", discountType: "percent", discountValue: "", expiresAt: "", isActive: true });
  };

  const submitCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingCoupon(true);
    setError("");
    try {
      const payload = {
        ...couponForm,
        discountValue: Number(couponForm.discountValue),
        expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
      };
      const isNew = editingCoupon === "new";
      await apiRequest(isNew ? "/api/admin/coupons" : `/api/admin/coupons/${editingCoupon}`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      setEditingCoupon(null);
      await loadSection("coupons");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Cuponul nu a putut fi salvat.");
    } finally {
      setSavingCoupon(false);
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Ștergi cuponul „${coupon.code}”?`)) return;
    try {
      await apiRequest(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
      await loadSection("coupons");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Cuponul nu a putut fi șters.");
    }
  };

  const loadOverview = useCallback(async () => {
    const result = await apiRequest<Overview>("/api/admin/overview");
    setOverview(result);
  }, []);

  const loadSection = useCallback(async (nextSection: Section) => {
    setLoading(true);
    setError("");
    try {
      if (nextSection === "overview") {
        await loadOverview();
      } else if (nextSection === "products") {
        const result = await apiRequest<{ products: Product[]; categories: Category[] }>("/api/admin/products");
        setProducts(result.products);
        setCategories(result.categories);
      } else if (nextSection === "orders") {
        setOrders(await apiRequest<Order[]>("/api/admin/orders"));
      } else if (nextSection === "users") {
        setUsers(await apiRequest<User[]>("/api/admin/users"));
      } else {
        setCoupons(await apiRequest<Coupon[]>("/api/admin/coupons"));
      }
    } catch (requestError) {
      const failure = requestError as Error & { status?: number };
      if (failure.status === 401) {
        router.replace("/auth");
        return;
      }
      if (failure.status === 403) {
        router.replace("/pagina-indisponibila");
        return;
      }
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [loadOverview, router]);

  useEffect(() => {
    let active = true;
    const verifyOwner = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error("Sesiunea nu a putut fi verificată.");
        const result = await response.json() as { user: { role?: string } | null };
        if (!result.user) {
          router.replace("/auth");
          return;
        }
        if (result.user.role?.trim().toLowerCase() !== "owner") {
          router.replace("/pagina-indisponibila");
          return;
        }
        if (!active) return;
        setAuthResolved(true);
        void loadSection("overview");
      } catch (requestError) {
        console.error("Eroare la verificarea accesului la dashboard:", requestError);
        if (!active) return;
        setAuthUnavailable(true);
        setAuthResolved(true);
        setLoading(false);
      }
    };
    void verifyOwner();
    return () => {
      active = false;
    };
  }, [loadSection, router]);

  const navigate = (next: Section) => {
    setSection(next);
    setEditingProduct(null);
    setEditingCoupon(null);
    void loadSection(next);
  };

  const filteredProducts = products.filter((product) => {
    const matchesText = `${product.name} ${product.slug} ${product.categoryName ?? ""} ${product.tags.join(" ")}`.toLowerCase().includes(productSearch.trim().toLowerCase());
    const matchesCategory = !productCategoryFilter || String(product.categoryId ?? "") === productCategoryFilter;
    return matchesText && matchesCategory;
  });
  const filteredOrders = orders.filter((order) => {
    const matchesText = `${order.id} ${order.firstName} ${order.lastName} ${order.email} ${order.phone} ${order.shippingAddress} ${order.status}`.toLowerCase().includes(orderSearch.trim().toLowerCase());
    return matchesText && (!orderStatusFilter || order.status === orderStatusFilter);
  });
  const filteredUsers = users.filter((user) => {
    const matchesText = `${user.firstName} ${user.lastName} ${user.email} ${user.phone ?? ""}`.toLowerCase().includes(userSearch.trim().toLowerCase());
    return matchesText && (!userRoleFilter || user.role === userRoleFilter);
  });
  const filteredCoupons = coupons.filter((coupon) => `${coupon.code} ${coupon.name}`.toLowerCase().includes(couponSearch.trim().toLowerCase()));

  const beginProductForm = (product?: Product) => {
    setEditingProduct(product?.id ?? "new");
    setProductForm(product ? {
      name: product.name,
      slug: product.slug,
      price: String(product.price),
      description: product.description ?? "",
      categoryId: product.categoryId === null ? "" : String(product.categoryId),
      imageUrl: product.imageUrl ?? "",
      images: product.images.join("\n"),
      tags: product.tags.join("."),
      isFeatured: product.isFeatured,
    } : emptyProductForm);
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProduct(true);
    setError("");
    try {
      const payload = {
        ...productForm,
        price: Number(productForm.price),
        categoryId: productForm.categoryId || null,
        images: productForm.images.split("\n").map((image) => image.trim()).filter(Boolean),
        tags: productForm.tags.split(".").map((tag) => tag.trim()).filter(Boolean),
      };
      const isNew = editingProduct === "new";
      await apiRequest(isNew ? "/api/admin/products" : `/api/admin/products/${editingProduct}`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      setEditingProduct(null);
      await loadSection("products");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Produsul nu a putut fi salvat.");
    } finally {
      setSavingProduct(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Ștergi produsul „${product.name}”?`)) return;
    try {
      await apiRequest(`/api/admin/products/${product.id}`, { method: "DELETE" });
      await loadSection("products");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Produsul nu a putut fi șters.");
    }
  };

  const updateUserRole = async (userId: number, role: User["role"]) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      await loadSection("users");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Rolul utilizatorului nu a putut fi actualizat.");
    }
  };

  const deleteUser = async (user: User) => {
    if (!window.confirm(`Ștergi contul lui ${user.firstName} ${user.lastName}?`)) return;
    try {
      await apiRequest(`/api/admin/users/${user.id}`, { method: "DELETE" });
      await loadSection("users");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Utilizatorul nu a putut fi șters.");
    }
  };

  const updateOrderStatus = async (orderId: number, status: Order["status"]) => {
    try {
      await apiRequest(`/api/admin/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
      await loadOverview();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Statusul comenzii nu a putut fi actualizat.");
    }
  };

  const navigation: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Privire generală", icon: LayoutDashboard },
    { id: "products", label: "Produse", icon: Package },
    { id: "orders", label: "Comenzi", icon: ShoppingBag },
    { id: "users", label: "Utilizatori", icon: Users },
    { id: "coupons", label: "Cupoane", icon: Ticket },
  ];

  if (!authResolved) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10090c] text-sm text-neutral-400">
        <div className="flex items-center gap-3"><LoaderCircle className="animate-spin" size={18} />Se verifică accesul owner…</div>
      </main>
    );
  }

  if (authUnavailable) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10090c] px-5 text-white">
        <section className="max-w-md rounded-2xl border border-white/10 bg-[#180f13] p-7 text-center">
          <h1 className="text-xl font-bold">Dashboard indisponibil</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-400">Nu s-a putut verifica accesul. Reîncarcă pagina sau încearcă din nou mai târziu.</p>
          <Link href="/" className="mt-5 inline-flex rounded-full bg-rose-800 px-5 py-2.5 text-sm font-semibold hover:bg-rose-700">Înapoi la magazin</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#10090c] text-white">
      <Navbar />
      <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-rose-400">Administrare magazin</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-sm text-neutral-400">Produse, comenzi, clienți și cupoane, într-un singur loc.</p>
          </div>
          <span className="rounded-full border border-rose-500/20 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-200">Acces owner</span>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className={`${cardClass} p-3`}>
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Magazin</p>
            <nav aria-label="Navigare dashboard" className="space-y-1">
              {navigation.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => navigate(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${section === id ? "bg-rose-950/55 text-rose-200 ring-1 ring-rose-500/20" : "text-neutral-400 hover:bg-white/[0.05] hover:text-white"}`}>
                  <Icon size={17} />{label}
                </button>
              ))}
            </nav>
            <div className="mt-4 border-t border-white/[0.08] pt-3">
              <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-400 transition hover:bg-white/[0.05] hover:text-white"><LogOut size={17} />Înapoi la magazin</Link>
            </div>
          </aside>

          <section className="min-w-0">
            {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</p>}
            {loading ? (
              <div className={`${cardClass} flex min-h-64 items-center justify-center gap-3 text-sm text-neutral-400`}><LoaderCircle className="animate-spin" size={18} />Se încarcă datele…</div>
            ) : (
              <>
                {section === "overview" && overview && (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard label="Valoare comenzi" value={money(overview.stats.orderValue)} caption={`${overview.stats.orderCount} comenzi înregistrate`} icon={BarChart3} />
                      <StatCard label="Finalizate" value={money(overview.stats.completedValue)} caption="Valoarea comenzilor finalizate" icon={ArrowUpRight} />
                      <StatCard label="În așteptare" value={String(overview.stats.pendingOrders)} caption="Necesită procesare" icon={ArrowDownRight} />
                      <StatCard label="Produse / clienți" value={`${overview.stats.productCount} / ${overview.stats.userCount}`} caption="În baza de date" icon={Boxes} />
                    </div>
                    <div className={cardClass}>
                      <PanelHeading title="Comenzi recente" subtitle="Cele mai noi comenzi din magazin" action={<button type="button" onClick={() => navigate("orders")} className="text-xs font-semibold text-rose-300 hover:text-rose-200">Vezi toate</button>} />
                      <OrdersTable orders={overview.recentOrders.map((order) => ({ ...order, email: "", phone: "", shippingAddress: "", items: [] }))} compact />
                    </div>
                    <p className="text-xs leading-5 text-neutral-500">Valoarea comenzilor este estimativă, calculată din cererile înregistrate. Nu există plată online activată.</p>
                  </div>
                )}
                {section === "products" && (
                  <div className={cardClass}>
                    <PanelHeading
                      title="Produse"
                      subtitle={`${products.length} produse · ${categories.length} categorii`}
                      action={
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => creatingCategory ? setCreatingCategory(false) : beginCategoryForm()} className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-900/50">
                            <Plus size={14} />Categorie nouă
                          </button>
                          <button type="button" onClick={() => beginProductForm()} className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-600"><Plus size={14} />Adaugă produs</button>
                        </div>
                      }
                    />
                    {creatingCategory && (
                      <form onSubmit={(event) => void submitCategory(event)} className="m-4 flex flex-wrap items-end gap-3 rounded-xl border border-rose-500/20 bg-rose-950/15 p-4">
                        <label className="min-w-56 flex-1 text-xs font-medium text-neutral-300">
                          Numele categoriei
                          <input autoFocus required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={100} placeholder="De exemplu: Decorațiuni" className={fieldClass} />
                        </label>
                        <div className="w-full">
                          <p className="text-xs font-medium text-neutral-300">Imagine categorie</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {categoryImageUrl && <Image src={getProductImageUrl(categoryImageUrl)} alt="Imagine categorie" width={72} height={72} unoptimized className="size-[72px] rounded-xl border border-white/10 object-cover" />}
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-neutral-200 transition hover:border-rose-400/30 hover:bg-rose-950/30">
                              {uploadingCategoryImage ? <LoaderCircle size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                              {uploadingCategoryImage ? "Se încarcă…" : "Alege imagine"}
                              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploadingCategoryImage} onChange={(event) => { void uploadCategoryImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                            </label>
                            <span className="text-xs text-neutral-500">JPG, PNG, WebP sau AVIF · max. 8 MB</span>
                          </div>
                        </div>
                        <p className="w-full text-xs text-neutral-500">Slug-ul se generează automat la creare; imaginea va fi afișată în magazin.</p>
                        <div className="ml-auto flex gap-2">
                          <button type="button" onClick={() => { setCreatingCategory(false); setCategoryName(""); setCategoryImageUrl(""); setEditingCategoryId(null); }} className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/5">Anulează</button>
                          <button type="submit" disabled={savingCategory || uploadingCategoryImage || !categoryName.trim()} className="rounded-full bg-rose-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-600 disabled:cursor-wait disabled:opacity-50">{savingCategory ? "Se salvează…" : editingCategoryId ? "Salvează categoria" : "Creează categoria"}</button>
                        </div>
                      </form>
                    )}
                    <div className="grid gap-3 border-b border-white/[0.07] p-4 sm:grid-cols-2 xl:grid-cols-3">
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3">
                          {category.imageUrl ? <Image src={getProductImageUrl(category.imageUrl)} alt="" width={48} height={48} unoptimized className="size-12 rounded-lg object-cover" /> : <div className="grid size-12 place-items-center rounded-lg bg-rose-950/30 text-rose-300"><Package size={17} /></div>}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-200">{category.name}</span>
                          <button type="button" onClick={() => beginCategoryForm(category)} aria-label={`Editează categoria ${category.name}`} className="rounded-lg p-2 text-neutral-400 hover:bg-rose-950/50 hover:text-rose-200"><Pencil size={14} /></button>
                        </div>
                      ))}
                    </div>
                    {editingProduct !== null && (
                      <form onSubmit={submitProduct} className="m-4 grid gap-3 rounded-xl border border-rose-500/20 bg-rose-950/15 p-4 sm:grid-cols-2">
                        <div className="flex items-center justify-between sm:col-span-2">
                          <h3 className="font-bold">{editingProduct === "new" ? "Produs nou" : "Editează produs"}</h3>
                          <button type="button" onClick={() => setEditingProduct(null)} aria-label="Închide formularul" className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
                        </div>
                        <label className="text-xs text-neutral-300">Nume<input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} maxLength={160} className={fieldClass} /></label>
                        <label className="text-xs text-neutral-300">Slug<input value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })} placeholder="Se generează din nume dacă este gol" className={fieldClass} /></label>
                        <label className="text-xs text-neutral-300">Preț (Lei)<input required type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} className={fieldClass} /></label>
                        <CategoryPicker categories={categories} value={productForm.categoryId} onChange={(categoryId) => setProductForm({ ...productForm, categoryId })} />
                        <label className="text-xs text-neutral-300 sm:col-span-2">Descriere<textarea rows={3} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className={fieldClass} /></label>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-medium text-neutral-300">Imagine principală</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {productForm.imageUrl && <Image src={getProductImageUrl(productForm.imageUrl)} alt="Imagine principală produs" width={72} height={72} unoptimized className="size-[72px] rounded-xl border border-white/10 object-cover" />}
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-neutral-200 transition hover:border-rose-400/30 hover:bg-rose-950/30">
                              <ImagePlus size={15} />Alege din calculator
                              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploadingImages} onChange={(event) => { void uploadImages(event.target.files, true); event.currentTarget.value = ""; }} />
                            </label>
                            <span className="text-xs text-neutral-500">JPG, PNG, WebP sau AVIF · max. 8 MB</span>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-medium text-neutral-300">Galerie produs</p>
                          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-neutral-200 transition hover:border-rose-400/30 hover:bg-rose-950/30">
                            {uploadingImages ? <LoaderCircle size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                            {uploadingImages ? "Se încarcă imaginile…" : "Adaugă imagini din calculator"}
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" disabled={uploadingImages} onChange={(event) => { void uploadImages(event.target.files); event.currentTarget.value = ""; }} />
                          </label>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {productForm.images.split("\n").map((image) => image.trim()).filter(Boolean).map((image) => (
                              <div key={image} className="group relative">
                                <Image src={getProductImageUrl(image)} alt="Imagine galerie" width={80} height={80} unoptimized className="size-20 rounded-xl border border-white/10 object-cover" />
                                <button type="button" title="Setează ca imagine principală" aria-label="Setează ca imagine principală" onClick={() => setProductForm((current) => ({ ...current, imageUrl: image }))} className="absolute bottom-1 left-1 rounded-md border border-white/10 bg-black/75 p-1 text-neutral-300 opacity-0 transition hover:text-emerald-300 group-hover:opacity-100"><Check size={14} /></button>
                                <button type="button" title="Elimină din galerie" aria-label="Elimină imaginea din galerie" onClick={() => setProductForm((current) => ({ ...current, images: current.images.split("\n").filter((value) => value.trim() !== image).join("\n") }))} className="absolute right-1 top-1 rounded-md border border-white/10 bg-black/75 px-1.5 py-0.5 text-xs text-white opacity-0 transition hover:bg-red-950 group-hover:opacity-100">×</button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <label className="text-xs text-neutral-300 sm:col-span-2">Etichete (separate prin punct)<input value={productForm.tags} onChange={(e) => setProductForm({ ...productForm, tags: e.target.value })} placeholder="masina.birou.casa" className={fieldClass} /></label>
                        <label className="flex items-center gap-2 text-sm text-neutral-300 sm:col-span-2"><input type="checkbox" checked={productForm.isFeatured} onChange={(e) => setProductForm({ ...productForm, isFeatured: e.target.checked })} className="accent-rose-500" />Produs recomandat</label>
                        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setEditingProduct(null)} className="rounded-full border border-white/10 px-4 py-2 text-xs text-neutral-300 hover:bg-white/5">Anulează</button><button disabled={savingProduct} className="rounded-full bg-rose-700 px-4 py-2 text-xs font-bold disabled:opacity-50">{savingProduct ? "Se salvează…" : "Salvează produsul"}</button></div>
                      </form>
                    )}
                    <div className="flex flex-wrap gap-3 border-b border-white/[0.07] p-4">
                      <label className="relative min-w-56 flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Caută după nume, slug sau etichetă…" className={`${fieldClass} mt-0 pl-9`} />
                      </label>
                      <select aria-label="Filtrează produsele după categorie" value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#21151a] px-3 py-2.5 text-sm text-neutral-200">
                        <option value="">Toate categoriile</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      <span className="self-center text-xs text-neutral-500">{filteredProducts.length} din {products.length}</span>
                    </div>
                    <ProductsTable products={filteredProducts} onEdit={beginProductForm} onDelete={(product) => void deleteProduct(product)} />
                  </div>
                )}
                {section === "orders" && (
                  <div className={`${cardClass} overflow-hidden`}>
                    <PanelHeading title="Toate comenzile" subtitle={`${filteredOrders.length} din ${orders.length} comenzi · sortate de la cea mai recentă`} />
                    <div className="flex flex-wrap gap-3 border-b border-white/[0.07] p-4">
                      <label className="relative min-w-56 flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Caută client, email, adresă sau număr…" className={`${fieldClass} mt-0 pl-9`} />
                      </label>
                      <select aria-label="Filtrează comenzile după status" value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#21151a] px-3 py-2.5 text-sm text-neutral-200">
                        <option value="">Toate statusurile</option>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <OrdersTable orders={filteredOrders} onStatusChange={(id, status) => void updateOrderStatus(id, status)} />
                  </div>
                )}
                {section === "users" && (
                  <div className={`${cardClass} overflow-hidden`}>
                    <PanelHeading title="Utilizatori" subtitle={`${filteredUsers.length} din ${users.length} conturi înregistrate`} />
                    <div className="flex flex-wrap gap-3 border-b border-white/[0.07] p-4">
                      <label className="relative min-w-56 flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Caută după nume, email sau telefon…" className={`${fieldClass} mt-0 pl-9`} />
                      </label>
                      <select aria-label="Filtrează utilizatorii după rol" value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#21151a] px-3 py-2.5 text-sm text-neutral-200">
                        <option value="">Toate rolurile</option><option value="user">Utilizator</option><option value="owner">Owner</option>
                      </select>
                    </div>
                    <UsersTable users={filteredUsers} onRoleChange={(id, role) => void updateUserRole(id, role)} onDelete={(user) => void deleteUser(user)} />
                  </div>
                )}
                {section === "coupons" && (
                  <div className={`${cardClass} overflow-hidden`}>
                    <PanelHeading
                      title="Cupoane"
                      subtitle={`${filteredCoupons.length} din ${coupons.length} cupoane · reduceri fixe sau procentuale`}
                      action={<button type="button" onClick={() => beginCouponForm()} className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-600"><Plus size={14} />Cupon nou</button>}
                    />
                    {editingCoupon !== null && (
                      <form onSubmit={submitCoupon} className="m-4 grid gap-3 rounded-xl border border-rose-500/20 bg-rose-950/15 p-4 sm:grid-cols-2">
                        <div className="flex items-center justify-between sm:col-span-2">
                          <h3 className="font-bold">{editingCoupon === "new" ? "Cupon nou" : "Editează cuponul"}</h3>
                          <button type="button" onClick={() => setEditingCoupon(null)} aria-label="Închide formularul" className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
                        </div>
                        <label className="text-xs text-neutral-300">Cod<input required value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })} maxLength={40} placeholder="EX: BINEAI-VENIT" className={fieldClass} /></label>
                        <label className="text-xs text-neutral-300">Nume cupon<input required value={couponForm.name} onChange={(event) => setCouponForm({ ...couponForm, name: event.target.value })} maxLength={100} placeholder="Reducere de bun venit" className={fieldClass} /></label>
                        <label className="text-xs text-neutral-300">Tip reducere<select value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value as "fixed" | "percent" })} className={fieldClass}><option value="percent">Procent (%)</option><option value="fixed">Sumă fixă (Lei)</option></select></label>
                        <label className="text-xs text-neutral-300">Valoare<input required type="number" min="0.01" max={couponForm.discountType === "percent" ? "100" : "1000000"} step="0.01" value={couponForm.discountValue} onChange={(event) => setCouponForm({ ...couponForm, discountValue: event.target.value })} className={fieldClass} /></label>
                        <label className="text-xs text-neutral-300">Expiră la (opțional)<input type="datetime-local" value={couponForm.expiresAt} onChange={(event) => setCouponForm({ ...couponForm, expiresAt: event.target.value })} className={fieldClass} /></label>
                        <label className="flex items-center gap-2 self-end pb-2 text-sm text-neutral-300"><input type="checkbox" checked={couponForm.isActive} onChange={(event) => setCouponForm({ ...couponForm, isActive: event.target.checked })} className="accent-rose-500" />Cupon activ</label>
                        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setEditingCoupon(null)} className="rounded-full border border-white/10 px-4 py-2 text-xs text-neutral-300 hover:bg-white/5">Anulează</button><button disabled={savingCoupon} className="rounded-full bg-rose-700 px-4 py-2 text-xs font-bold disabled:opacity-50">{savingCoupon ? "Se salvează…" : "Salvează cuponul"}</button></div>
                      </form>
                    )}
                    <div className="border-b border-white/[0.07] p-4">
                      <label className="relative block max-w-lg">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input value={couponSearch} onChange={(event) => setCouponSearch(event.target.value)} placeholder="Caută după cod sau nume…" className={`${fieldClass} mt-0 pl-9`} />
                      </label>
                    </div>
                    <CouponsTable coupons={filteredCoupons} onEdit={beginCouponForm} onDelete={(coupon) => void deleteCoupon(coupon)} />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, caption, icon: Icon }: { label: string; value: string; caption: string; icon: typeof BarChart3 }) {
  return <div className={`${cardClass} p-4`}><div className="flex items-center justify-between"><span className="text-xs font-medium text-neutral-400">{label}</span><span className="rounded-lg border border-rose-500/15 bg-rose-950/35 p-2 text-rose-300"><Icon size={16} /></span></div><p className="mt-4 text-xl font-black tabular-nums text-white">{value}</p><p className="mt-1 text-[11px] text-neutral-500">{caption}</p></div>;
}

function CategoryPicker({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((category) => String(category.id) === value);

  return (
    <div className="relative text-xs text-neutral-300">
      <span className="block">Categorie</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="mt-1.5 flex h-[42px] w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1a1115] px-3.5 text-left text-sm text-white outline-none transition hover:border-white/20 focus:border-rose-500/50"
      >
        <span className={selected ? "truncate" : "truncate text-neutral-500"}>{selected?.name ?? "Alege o categorie"}</span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Închide lista de categorii" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div role="listbox" aria-label="Categorii" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#21151a] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
            <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(""); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${!value ? "bg-rose-950/50 text-rose-200" : "text-neutral-300 hover:bg-white/[0.06] hover:text-white"}`}>
              Fără categorie{!value && <Check size={14} />}
            </button>
            {categories.map((category) => {
              const isSelected = String(category.id) === value;
              return (
                <button key={category.id} type="button" role="option" aria-selected={isSelected} onClick={() => { onChange(String(category.id)); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${isSelected ? "bg-rose-950/50 text-rose-200" : "text-neutral-300 hover:bg-white/[0.06] hover:text-white"}`}>
                  {category.name}{isSelected && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PanelHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-5"><div><h2 className="text-sm font-bold text-white">{title}</h2><p className="mt-1 text-xs text-neutral-500">{subtitle}</p></div>{action}</div>;
}

function OrdersTable({ orders, onStatusChange, compact = false }: { orders: DashboardOrder[]; onStatusChange?: (id: number, status: Order["status"]) => void; compact?: boolean }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
    <thead className="bg-white/[0.025] text-[10px] font-bold uppercase tracking-wider text-neutral-500"><tr><th className="px-4 py-3">Comandă</th><th className="px-4 py-3">Client</th>{!compact && <><th className="px-4 py-3">Contact / adresă</th><th className="px-4 py-3">Detalii</th></>}<th className="px-4 py-3">Data</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th></tr></thead>
    <tbody>{orders.map((order) => <tr key={order.id} className="border-t border-white/[0.06] align-top hover:bg-white/[0.02]">
      <td className="px-4 py-3 font-semibold text-white">#{order.id}</td>
      <td className="px-4 py-3"><p className="font-medium text-neutral-200">{order.firstName} {order.lastName}</p>{order.email && <p className="mt-1 text-xs text-neutral-500">{order.email}</p>}</td>
      {!compact && <><td className="max-w-64 px-4 py-3 text-xs leading-5 text-neutral-400">{order.phone}<br />{order.shippingAddress}</td><td className="max-w-56 px-4 py-3 text-xs leading-5 text-neutral-400">{order.items?.map((item, index) => <p key={`${order.id}-${index}`}>{item.productName}{item.color ? ` · ${item.color}` : ""} × {item.quantity}</p>)}</td></>}
      <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-400">{date(order.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-white">{money(order.totalPrice)}</td>
      <td className="px-4 py-3">{onStatusChange ? <select aria-label={`Status comandă ${order.id}`} value={order.status} onChange={(event) => onStatusChange(order.id, event.target.value as Order["status"])} className="rounded-lg border border-white/10 bg-[#21151a] px-2 py-1.5 text-xs text-neutral-200">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <span className="rounded-full border border-rose-500/15 bg-rose-950/25 px-2.5 py-1 text-[10px] font-semibold text-rose-200">{statusLabels[order.status]}</span>}</td>
    </tr>)}</tbody>
  </table>{orders.length === 0 && <EmptyState message="Nu există încă nicio comandă înregistrată." />}</div>;
}

function ProductsTable({ products, onEdit, onDelete }: { products: Product[]; onEdit: (product: Product) => void; onDelete: (product: Product) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
    <thead className="bg-white/[0.025] text-[10px] font-bold uppercase tracking-wider text-neutral-500"><tr><th className="px-4 py-3">Produs</th><th className="px-4 py-3">Categorie</th><th className="px-4 py-3">Preț</th><th className="px-4 py-3">Etichete</th><th className="px-4 py-3">Recomandat</th><th className="px-4 py-3 text-right">Acțiuni</th></tr></thead>
    <tbody>{products.map((product) => <tr key={product.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]"><td className="px-4 py-3"><p className="font-semibold text-white">{product.name}</p><p className="mt-1 text-xs text-neutral-500">/{product.slug}</p></td><td className="px-4 py-3 text-neutral-400">{product.categoryName ?? "—"}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-white">{money(product.price)}</td><td className="max-w-48 px-4 py-3 text-xs text-neutral-400">{product.tags.join(", ") || "—"}</td><td className="px-4 py-3 text-xs text-neutral-400">{product.isFeatured ? "Da" : "Nu"}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => onEdit(product)} aria-label={`Editează ${product.name}`} className="rounded-lg p-2 text-neutral-400 hover:bg-rose-950/50 hover:text-rose-200"><Pencil size={15} /></button><button type="button" onClick={() => onDelete(product)} aria-label={`Șterge ${product.name}`} className="rounded-lg p-2 text-neutral-400 hover:bg-red-950/50 hover:text-red-300"><Trash2 size={15} /></button></div></td></tr>)}</tbody>
  </table>{products.length === 0 && <EmptyState message="Nu există produse încă." />}</div>;
}

function UsersTable({ users, onRoleChange, onDelete }: { users: User[]; onRoleChange: (id: number, role: User["role"]) => void; onDelete: (user: User) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
    <thead className="bg-white/[0.025] text-[10px] font-bold uppercase tracking-wider text-neutral-500"><tr><th className="px-4 py-3">Nume</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Telefon</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Comenzi</th><th className="px-4 py-3">Înregistrat</th><th className="px-4 py-3 text-right">Acțiuni</th></tr></thead>
    <tbody>{users.map((user) => <tr key={user.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]"><td className="whitespace-nowrap px-4 py-3 font-medium text-white">{user.firstName} {user.lastName}</td><td className="px-4 py-3 text-neutral-400">{user.email}</td><td className="px-4 py-3 text-neutral-400">{user.phone || "—"}</td><td className="px-4 py-3"><select aria-label={`Rol pentru ${user.email}`} value={user.role} onChange={(event) => onRoleChange(user.id, event.target.value as User["role"])} className="rounded-lg border border-white/10 bg-[#21151a] px-2 py-1.5 text-xs text-neutral-200"><option value="user">Utilizator</option><option value="owner">Owner</option></select></td><td className="px-4 py-3 text-neutral-300">{user.orderCount}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-400">{date(user.createdAt)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => onDelete(user)} aria-label={`Șterge ${user.email}`} className="rounded-lg p-2 text-neutral-400 hover:bg-red-950/50 hover:text-red-300"><Trash2 size={15} /></button></td></tr>)}</tbody>
  </table>{users.length === 0 && <EmptyState message="Nu există utilizatori înregistrați." />}</div>;
}

function CouponsTable({ coupons, onEdit, onDelete }: { coupons: Coupon[]; onEdit: (coupon: Coupon) => void; onDelete: (coupon: Coupon) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
    <thead className="bg-white/[0.025] text-[10px] font-bold uppercase tracking-wider text-neutral-500"><tr><th className="px-4 py-3">Cod / cupon</th><th className="px-4 py-3">Reducere</th><th className="px-4 py-3">Creat</th><th className="px-4 py-3">Expiră</th><th className="px-4 py-3">Stare</th><th className="px-4 py-3 text-right">Acțiuni</th></tr></thead>
    <tbody>{coupons.map((coupon) => <tr key={coupon.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
      <td className="px-4 py-3"><p className="font-mono font-bold tracking-wide text-white">{coupon.code}</p><p className="mt-1 text-xs text-neutral-500">{coupon.name} · ID {coupon.id}</p></td>
      <td className="px-4 py-3 font-semibold text-rose-200">{coupon.discountType === "percent" ? `${coupon.discountValue}%` : money(coupon.discountValue)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-400">{date(coupon.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-400">{coupon.expiresAt ? date(coupon.expiresAt) : "Fără expirare"}</td>
      <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${coupon.isActive ? "border-emerald-500/20 bg-emerald-950/25 text-emerald-200" : "border-white/10 bg-white/[0.04] text-neutral-400"}`}>{coupon.isActive ? "Activ" : "Inactiv"}</span></td>
      <td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => onEdit(coupon)} aria-label={`Editează cuponul ${coupon.code}`} className="rounded-lg p-2 text-neutral-400 hover:bg-rose-950/50 hover:text-rose-200"><Pencil size={15} /></button><button type="button" onClick={() => onDelete(coupon)} aria-label={`Șterge cuponul ${coupon.code}`} className="rounded-lg p-2 text-neutral-400 hover:bg-red-950/50 hover:text-red-300"><Trash2 size={15} /></button></div></td>
    </tr>)}</tbody>
  </table>{coupons.length === 0 && <EmptyState message="Nu există cupoane pentru această căutare." />}</div>;
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-5 py-10 text-center text-sm text-neutral-500">{message}</p>;
}
