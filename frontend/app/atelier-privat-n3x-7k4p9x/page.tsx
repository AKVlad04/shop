import type { Metadata } from "next";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Administrare | Atelier",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
