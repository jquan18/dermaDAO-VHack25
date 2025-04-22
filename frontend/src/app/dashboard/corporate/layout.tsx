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
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex md:flex-col md:w-64 border-r bg-white">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">
              Corporate Dashboard
            </h2>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {sidebarNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-md text-gray-600 hover:bg-primary/5 hover:text-primary transition-colors",
                  pathname === item.href && "bg-primary/10 text-primary font-medium"
                )}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t">
            <div className="text-sm text-gray-500">
              Logged in as <span className="font-medium">{user?.name}</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-gray-50">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
} 