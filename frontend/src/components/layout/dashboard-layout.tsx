"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import {
  LayoutDashboard,
  HeartHandshake,
  FileText,
  CreditCard,
  Wallet,
  Settings,
  User,
  Building,
  Users,
  ShieldCheck,
  CircleDollarSign,
} from "lucide-react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    // Only load user data if we're not authenticated, not loading, and don't have user data
    if (!isAuthenticated && !isLoading && !user) {
      loadUser();
    }
  }, [isAuthenticated, isLoading, loadUser, user]);

  useEffect(() => {
    // Redirect if not authenticated after loading
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Define navigation items based on user role
  const getNavItems = () => {
    if (!user) return [];

    if (user.role === "charity_admin") {
      return [
        {
          name: "Dashboard",
          href: "/dashboard/charity",
          icon: LayoutDashboard,
        },
        {
          name: "Projects",
          href: "/dashboard/charity/projects",
          icon: HeartHandshake,
        },
        {
          name: "Funding Pools",
          href: "/dashboard/pools",
          icon: CircleDollarSign,
        },
        {
          name: "Proposals",
          href: "/dashboard/charity/proposals",
          icon: FileText,
        },
        {
          name: "Bank Accounts",
          href: "/dashboard/charity/bank-accounts",
          icon: CreditCard,
        },
        {
          name: "Transfers",
          href: "/dashboard/charity/transfers",
          icon: Wallet,
        },
        {
          name: "Wallet",
          href: "/dashboard/wallet",
          icon: Wallet,
        },
        {
          name: "Debug",
          href: "/dashboard/charity/debug",
          icon: ShieldCheck,
        },
      ];
    } else if (user.role === "corporate") {
      return [
        {
          name: "Dashboard",
          href: "/dashboard/corporate",
          icon: LayoutDashboard,
        },
        {
          name: "My Funding Pools",
          href: "/dashboard/corporate/pools",
          icon: CircleDollarSign,
        },
        {
          name: "Create Pool",
          href: "/dashboard/corporate/pools/create",
          icon: CircleDollarSign,
        },
        {
          name: "Impact Reports",
          href: "/dashboard/corporate/impact",
          icon: FileText,
        },
        {
          name: "Wallet",
          href: "/dashboard/wallet",
          icon: Wallet,
        },
        {
          name: "Profile",
          href: "/dashboard/profile",
          icon: User,
        },
      ];
    } else if (user.role === "admin") {
      return [
        {
          name: "Dashboard",
          href: "/dashboard/admin",
          icon: LayoutDashboard,
        },
        {
          name: "Charities",
          href: "/dashboard/admin/charities",
          icon: Building,
        },
        {
          name: "Projects",
          href: "/dashboard/admin/projects",
          icon: HeartHandshake,
        },
        {
          name: "Funding Pools",
          href: "/dashboard/pools",
          icon: CircleDollarSign,
        },
        {
          name: "Quadratic Funding",
          href: "/dashboard/admin/quadratic-funding",
          icon: CircleDollarSign,
        },
        {
          name: "Users",
          href: "/dashboard/admin/users",
          icon: Users,
        },
        {
          name: "Verifications",
          href: "/dashboard/admin/verifications",
          icon: ShieldCheck,
        },
        {
          name: "Transfers",
          href: "/dashboard/admin/transfers",
          icon: Wallet,
        },
        {
          name: "Wallet",
          href: "/dashboard/wallet",
          icon: Wallet,
        },
      ];
    } else {
      // Regular user
      return [
        {
          name: "Funding Pools",
          href: "/dashboard/pools",
          icon: CircleDollarSign,
        },
        {
          name: "My Donations",
          href: "/dashboard/donations",
          icon: HeartHandshake,
        },
        {
          name: "Proposal Voting",
          href: "/dashboard/donations/proposals",
          icon: FileText,
        },
        {
          name: "Wallet",
          href: "/dashboard/wallet",
          icon: Wallet,
        },
        {
          name: "Profile",
          href: "/dashboard/profile",
          icon: User,
        },
      ];
    }
  };

  const navItems = [...getNavItems()];

  // If still loading or not authenticated, show loading
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="bg-primary/10 p-5 rounded-full inline-flex mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/30"></div>
          </div>
          <h2 className="text-xl font-medium text-gray-700">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex md:flex-col md:w-64 border-r bg-white">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">
              {user?.role === "charity_admin"
                ? "Charity Dashboard"
                : user?.role === "admin"
                ? "Admin Dashboard"
                : user?.role === "corporate"
                ? "Corporate Dashboard"
                : "Dashboard"}
            </h2>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
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
                    : pathname.includes("/dashboard/profile")
                    ? "User Profile"
                    : pathname.includes("/dashboard/pools")
                    ? "Funding Pools"
                    : pathname.includes("/dashboard/donations")
                    ? "My Donations"
                    : pathname.includes("/dashboard/charity")
                    ? "Charity Dashboard"
                    : pathname.includes("/dashboard/admin")
                    ? "Admin Dashboard"
                    : pathname.includes("/dashboard/corporate")
                    ? "Corporate Dashboard"
                    : "Dashboard"}
                </h1>
                <div className="flex space-x-4">
                  <Link 
                    href="/dashboard/pools" 
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                      pathname.includes("/dashboard/pools") 
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
                  <Link 
                    href="/dashboard/profile" 
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                      pathname.includes("/dashboard/profile") 
                        ? "bg-primary/10 text-primary" 
                        : "text-gray-600 hover:text-primary hover:bg-primary/5"
                    )}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile
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