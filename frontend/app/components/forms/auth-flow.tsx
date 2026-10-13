"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "@/lib/productImages";

type AuthStep = "email" | "login" | "signup";

export function AuthFlow() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const continueWithEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Emailul nu a putut fi verificat.");
      }

      setEmail(result.email);
      setStep(result.accountExists ? "login" : "signup");
    } catch (requestError) {
      console.error("Eroare la verificarea emailului:", requestError);
      setError(requestError instanceof Error ? requestError.message : "Emailul nu a putut fi verificat.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (step === "signup" && password !== confirmPassword) {
      setError("Parolele nu se potrivesc.");
      return;
    }
    if (step === "signup" && (!/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password))) {
      setError("Parola trebuie să conțină o cifră și un simbol.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${step === "login" ? "login" : "register"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          step === "login"
            ? { email, password }
            : { email, name, phone, password, acceptedTerms },
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Autentificarea nu a reușit.");
      }

      setNotice(step === "login" ? "Te-ai conectat cu succes." : "Contul a fost creat cu succes.");
      window.dispatchEvent(new Event("shop-auth-changed"));
      window.setTimeout(() => router.replace("/"), 700);
    } catch (requestError) {
      console.error("Eroare la autentificare:", requestError);
      setError(requestError instanceof Error ? requestError.message : "Autentificarea nu a reușit momentan.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const changeEmail = () => {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setAcceptedTerms(false);
    setError("");
    setNotice("");
  };

  return (
    <main className="relative z-10 flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-28">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#120B0E]/85 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
        <div className="mb-7 flex size-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-950/60 text-rose-300">
          {step === "email" ? <Mail size={21} /> : <ShieldCheck size={21} />}
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white">
          {step === "email" && "Intră în contul tău"}
          {step === "login" && "Bine ai revenit"}
          {step === "signup" && "Creează-ți contul"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          {step === "email" && "Introdu emailul și te ajutăm să continui."}
          {step === "login" && "Am găsit un cont asociat acestui email. Introdu parola pentru a continua."}
          {step === "signup" && "Nu am găsit un cont asociat. Completează datele pentru a crea unul."}
        </p>

        {step !== "email" && (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
            <span className="truncate text-sm text-neutral-200">{email}</span>
            <button
              type="button"
              onClick={changeEmail}
              className="ml-3 shrink-0 text-xs font-semibold text-rose-300 hover:text-rose-200"
            >
              Schimbă
            </button>
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={continueWithEmail} className="mt-6 space-y-4">
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-neutral-200">
                Email
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nume@exemplu.ro"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-rose-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/70 px-4 text-sm font-bold text-rose-100 transition hover:border-rose-400/50 hover:bg-rose-900/70 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? <LoaderCircle size={17} className="animate-spin" /> : <>Continuă <ArrowRight size={16} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
            {step === "signup" && (
              <div>
                <label htmlFor="auth-name" className="mb-1.5 block text-sm font-medium text-neutral-200">
                  Nume complet
                </label>
                <input
                  id="auth-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Numele tău"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-rose-500/50"
                />
              </div>
            )}
            {step === "signup" && (
              <div>
                <label htmlFor="auth-phone" className="mb-1.5 block text-sm font-medium text-neutral-200">
                  Număr de telefon <span className="text-neutral-500">(opțional)</span>
                </label>
                <input
                  id="auth-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+40 7xx xxx xxx"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-rose-500/50"
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-neutral-200">
                Parolă
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={step === "login" ? "current-password" : "new-password"}
                  required
                  minLength={step === "signup" ? 8 : undefined}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={step === "signup" ? "Min. 8 caractere, o cifră și un simbol" : "Introdu parola"}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 pr-12 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-rose-500/50"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {step === "signup" && (
                <p className="mt-1.5 text-xs text-neutral-500">Folosește maximum 128 de caractere.</p>
              )}
            </div>
            {step === "signup" && (
              <>
                <div>
                  <label htmlFor="auth-confirm-password" className="mb-1.5 block text-sm font-medium text-neutral-200">
                    Confirmă parola
                  </label>
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-rose-500/50"
                  />
                </div>
                <label className="flex items-start gap-2.5 text-xs leading-5 text-neutral-400">
                  <input
                    type="checkbox"
                    required
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-1 accent-rose-500"
                  />
                  <span>Sunt de acord cu termenii și condițiile și politica de confidențialitate.</span>
                </label>
              </>
            )}
            <button
              type="submit"
              disabled={authSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/70 px-4 text-sm font-bold text-rose-100 transition hover:border-rose-400/50 hover:bg-rose-900/70 disabled:cursor-wait disabled:opacity-60"
            >
              {authSubmitting ? <LoaderCircle size={17} className="animate-spin" /> : step === "login" ? "Conectează-te" : "Creează cont"}
              {!authSubmitting && <ArrowRight size={16} />}
            </button>
            {notice && <p role="status" className="text-sm text-amber-200">{notice}</p>}
          </form>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        {step !== "email" && (
          <button
            type="button"
            onClick={changeEmail}
            className="mt-5 flex items-center gap-2 text-xs text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft size={14} />
            Înapoi la email
          </button>
        )}
      </section>
    </main>
  );
}
