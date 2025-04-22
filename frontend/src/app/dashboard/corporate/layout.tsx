"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  CircleDollarSign, 
  Wallet,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

interface CorporateLayoutProps {
  children: ReactNode;
}

export default function CorporateLayout({ children }: CorporateLayoutProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const sidebarNavItems = [
    {
      name: "Dashboard",
      href: "/dashboard/corporate",
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
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        {/* Main content */}
        <main className="flex-1 bg-gray-50">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
} 