import { AuthFlow } from "@/components/forms/auth-flow";
import { DarkRoseNoirBackground } from "@/components/DarkRoseNoirBackground";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function AuthPage() {
  return (
    <DarkRoseNoirBackground className="flex min-h-screen w-full flex-col justify-between overflow-x-hidden">
      <Navbar />
      <AuthFlow />
      <Footer />
    </DarkRoseNoirBackground>
  );
}
