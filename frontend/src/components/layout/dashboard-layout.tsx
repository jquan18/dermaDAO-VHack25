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
        {/* Main content */}
        <main className="flex-1 bg-gray-50">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
} 