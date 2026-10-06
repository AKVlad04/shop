import { DarkRoseNoirBackground } from "@/components/DarkRoseNoirBackground";
import { Navbar } from "@/components/Navbar";
import { SearchInput } from "@/components/inputs/SearchInput";
import { FeaturedProducts } from "@/components/FeaturedProducts";
import { WhyUs } from "@/components/WhyUs";
import { EstimatorCTA } from "@/components/EstimatorCTA";
import { CategoriesGrid } from "@/components/CategoriesGrid";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <DarkRoseNoirBackground className="flex min-h-screen w-full flex-col items-center justify-center relative overflow-hidden">
      {/* Navbar-ul plutitor sus */}
      <Navbar />

      {/* Conținutul Hero din mijloc */}
      <main className="flex flex-col items-center text-center px-4 max-w-4xl mx-auto pt-36 mt-20">
        
        {/* Badge mic sus */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-950/30 border border-rose-500/20 text-rose-300 text-xs font-semibold tracking-wide uppercase mb-8 backdrop-blur-md shadow-[0_0_15px_rgba(225,29,72,0.1)]">
          <Sparkles size={13} className="text-rose-400 animate-pulse" />
          <span>Inovație & Print 3D</span>
        </div>

        {/* Titlu Principal Masiv (Stil tipografia din poză) */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase leading-[1.1] mb-6">
          MATERIALIZEAZĂ <br />
          <span className="bg-gradient-to-r from-white via-neutral-300 to-rose-400 bg-clip-text text-transparent">
            IDEILE TALE ÎN 3D.
          </span>
        </h1>

        {/* Descriere generală (gama largă, nu doar gaming) */}
        <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto mb-10 leading-relaxed font-normal">
          De la obiecte decorative și accesorii practice pentru casă, până la piese tehnice și proiecte custom. Calitate industrială livrată direct la tine.
        </p>

        {/* Bara de Căutare pe care tocmai ai adus-o + Butoane de Acțiune */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mb-12">
          <SearchInput containerClassName="w-full" />
        </div>

        {/* Butoanele principale de navigare (Exact ca în stilul din poză) */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/produse"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-rose-900 to-rose-950 text-white font-semibold text-sm tracking-wide border border-rose-500/30 shadow-[0_0_25px_rgba(225,29,72,0.3)] hover:shadow-[0_0_35px_rgba(225,29,72,0.5)] hover:scale-105 transition-all duration-300"
          >
            <span>Explorează Magazinul</span>
            <ArrowRight size={16} />
          </Link>

          <Link
            href="/materiale"
            className="px-7 py-3.5 rounded-full bg-white/[0.03] border border-white/10 text-neutral-300 hover:text-white hover:bg-white/[0.08] hover:border-white/20 font-semibold text-sm tracking-wide transition-all duration-300"
          >
            Detalii Materiale & Culori
          </Link>
        </div>

      </main>

     
      {/* Secțiunea de Produse Recomandate (Featured) */}
      <FeaturedProducts />

      {/* Secțiunea de Categorii Rapide (Grid Vizual - Nou adăugată) */}
      <CategoriesGrid />

      {/* Secțiunea de Beneficii / USP cu efect de text adnotat */}
      <WhyUs />

      {/* Secțiunea Estimator CTA (Noua secțiune adăugată) */}
      <EstimatorCTA />

      {/* Footer-ul Modern Legal */}
      <Footer />

    </DarkRoseNoirBackground>
    
  );
}