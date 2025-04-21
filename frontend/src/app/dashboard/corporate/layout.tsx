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
          <div className="border-b bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <h1 className="text-lg font-medium">
                  {pathname.includes("/dashboard/wallet")
                    ? "Wallet Dashboard"
                    : pathname.includes("/dashboard/corporate/pools")
                    ? "Funding Pools"
                    : "Corporate Dashboard"}
                </h1>
                <div className="flex space-x-4">
                  <Link 
                    href="/dashboard/corporate/pools" 
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                      pathname.includes("/dashboard/corporate/pools") 
                        ? "bg-primary/10 text-primary" 
                        : "text-gray-600 hover:text-primary hover:bg-primary/5"
                    )}
                  >
                    <CircleDollarSign className="h-4 w-4 mr-2" />
                    Pools
                  </Link>
                  <Link 
                    href="/dashboard/wallet" 
                    className={cn(
                      "flex items-center px-4 py-2 text-sm font-bold border rounded-md",
                      pathname.includes("/dashboard/wallet") 
                        ? "bg-primary text-white border-primary" 
                        : "text-primary border-primary hover:bg-primary hover:text-white transition-colors"
                    )}
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    My Wallet
                  </Link>
                </div>
              </div>
            </div>
          </div>
          
          {/* Prominent Wallet Box - Visible on all dashboard pages */}
          <div className="bg-white border-b">
            <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center p-2 bg-primary/10 rounded-full">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-700">Wallet Access</h2>
                    <p className="text-xs text-gray-500">Manage your tokens and transactions</p>
                  </div>
                </div>
                <Link 
                  href="/dashboard/wallet"
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Access Wallet
                </Link>
              </div>
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
} 