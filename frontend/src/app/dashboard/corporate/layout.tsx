"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  CircleDollarSign, 
  Wallet,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Navbar } from "@/components/layout/navbar";
import Iridescence from "@/components/ui/iridescence";

interface CorporateLayoutProps {
  children: ReactNode;
}

export default function CorporateLayout({ children }: CorporateLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  // Redirect to pools if on the corporate dashboard root
  useEffect(() => {
    if (pathname === "/dashboard/corporate") {
      router.replace("/dashboard/corporate/pools");
    }
  }, [pathname, router]);

  const sidebarNavItems = [
    {
      name: "Dashboard",
      href: "/dashboard/corporate/pools",
      icon: Home,
    },
    {
      name: "Funding Pools",
      href: "/dashboard/corporate/pools",
      icon: CircleDollarSign,
    },
    {
      name: "Wallet",
      href: "/dashboard/wallet",
      icon: Wallet,
    }
  ];

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="fixed inset-0 z-0 backdrop-blur-md bg-white/30">
        <Iridescence color={[1, 1, 1]} mouseReact={true} amplitude={0.6} speed={0.8} />
      </div>
      <Navbar />
      <div className="flex flex-1">
        {/* Main content */}
        <main className="flex-1 relative z-10">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}