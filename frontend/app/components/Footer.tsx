"use client";

import Link from "next/link";
import { ShieldCheck, Mail, Phone, MapPin, ExternalLink, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-[#0A0608] text-neutral-400 text-sm relative z-10 pt-16 pb-12">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
        
        {/* Coloana 1: Despre Brand */}
        <div className="space-y-4 md:col-span-1">
          <Link href="/" className="text-sm font-extrabold tracking-[0.25em] text-white uppercase">
            3D SHOP
          </Link>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Printuri 3D de calitate industrială, obiecte unicat, accesorii și piese custom realizate cu precizie pentru tine.
          </p>
          <div className="flex items-center gap-2 text-xs text-rose-400 font-medium">
            <ShieldCheck size={16} />
            <span>Plăți 100% Securizate & Garanție</span>
          </div>
        </div>

        {/* Coloana 2: Link-uri Rapide */}
        <div className="space-y-3">
          <h4 className="text-white text-xs font-bold uppercase tracking-wider">Navigare</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/produse" className="hover:text-white transition-colors">Toate Produsele</Link>
            </li>
            <li>
              <Link href="/materiale" className="hover:text-white transition-colors">Materiale & Culori</Link>
            </li>
            <li>
              <Link href="/estimator" className="hover:text-white transition-colors">Estimator Model STL</Link>
            </li>
            <li>
              <Link href="/favorite" className="hover:text-white transition-colors">Produse Favorite</Link>
            </li>
          </ul>
        </div>

        {/* Coloana 3: Informații Legale (Obligatorii ANPC / UE) */}
        <div className="space-y-3">
          <h4 className="text-white text-xs font-bold uppercase tracking-wider">Legal & Protecția Consumatorului</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/termeni-si-conditii" className="hover:text-white transition-colors">Termeni și Condiții</Link>
            </li>
            <li>
              <Link href="/politica-de-retur" className="hover:text-white transition-colors">Politică de Retur (14 zile)</Link>
            </li>
            <li>
              <Link href="/politica-confidentialitate" className="hover:text-white transition-colors">Politica de Confidențialitate (GDPR)</Link>
            </li>
            <li>
              <a 
                href="https://reclamatiisal.anpc.ro/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1 hover:text-rose-400 transition-colors"
              >
                <span>ANPC - SAL</span> <ExternalLink size={12} />
              </a>
            </li>
            <li>
            </li>
          </ul>
        </div>

        {/* Coloana 4: Date de Contact */}
        <div className="space-y-3">
          <h4 className="text-white text-xs font-bold uppercase tracking-wider">Contact</h4>
          <ul className="space-y-2.5 text-xs">
            <li className="flex items-center gap-2">
              <Mail size={15} className="text-rose-400 shrink-0" />
              <span>contact@3dshop.ro</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone size={15} className="text-rose-400 shrink-0" />
              <span>+40 (700) 000 000</span>
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={15} className="text-rose-400 shrink-0" />
              <span>România</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Partea de Jos: Copyright, Plăți și Sigle */}
      <div className="max-w-6xl mx-auto px-4 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        
        {/* Copyright */}
        <p className="text-neutral-500">
          © {new Date().getFullYear()} 3D Shop. Toate drepturile rezervate.
        </p>

        {/* Procesatori de Plăți / Carduri acceptate */}
        <div className="flex items-center gap-3 text-neutral-400 font-semibold tracking-wider">
          <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[10px]">Netopia Payments</span>
          <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[10px]">Stripe</span>
          <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[10px]">Visa / Mastercard</span>
        </div>

      </div>
    </footer>
  );
}