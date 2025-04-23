"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, User, LogOut, Settings, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout, loadUser, isLoading } = useAuthStore();
  
  // Check if we're on the landing page
  const isLandingPage = pathname === "/";

  // Handle scroll event to change navbar opacity
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    if (isLandingPage) {
      window.addEventListener("scroll", handleScroll);
    } else {
      setScrolled(true); // Always solid for non-landing pages
    }
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isLandingPage]);

  useEffect(() => {
    // Only load user data if we're not authenticated, not loading, and don't have user data
    if (!isAuthenticated && !isLoading && !user) {
      loadUser();
    }
  }, [loadUser, isAuthenticated, isLoading, user]);

  const handleLogout = () => {
    logout();
    router.push("/");
    setIsUserMenuOpen(false);
  };

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  const navItems = isAuthenticated ? [] : [
    { name: "Home", href: "/" },
  ];

  // Add additional nav items for specific roles
  const roleNavItems = isAuthenticated
    ? user?.role === "charity_admin"
      ? [
          { name: "Dashboard", href: "/dashboard/charity" },
          { name: "Projects", href: "/dashboard/charity/projects" },
          { name: "Funding Pools", href: "/dashboard/pools" },
          { name: "Proposals", href: "/dashboard/charity/proposals" },
          { name: "Bank Accounts", href: "/dashboard/charity/bank-accounts" },
        ]
      : user?.role === "admin"
      ? [
          { name: "Dashboard", href: "/dashboard/admin" },
          { name: "Charities", href: "/dashboard/admin/charities" },
          { name: "Projects", href: "/dashboard/admin/projects" },
          { name: "Funding Pools", href: "/dashboard/pools" },
          { name: "Verifications", href: "/dashboard/admin/verifications" },
          { name: "Users", href: "/dashboard/admin/users" },
        ]
      : user?.role === "corporate"
      ? [
          { name: "Dashboard", href: "/dashboard/corporate" },
          { name: "Funding Pools", href: "/dashboard/corporate/pools" },
        ]
      : [
          { name: "My Donations", href: "/dashboard/donations" },
          { name: "Funding Pools", href: "/dashboard/pools" },
          { name: "Project Voting", href: "/dashboard/donations/projects-to-vote" },
        ]
    : [];

  // Redirect regular users to My Donations page after login
  useEffect(() => {
    if (isAuthenticated && user && !user.role) {
      if (pathname === "/dashboard") {
        router.push("/dashboard/donations");
      }
    }
  }, [isAuthenticated, user, pathname, router]);

  const allNavItems = [...navItems, ...roleNavItems];

  return (
    <nav 
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 border-b",
        isLandingPage && !scrolled 
          ? "bg-transparent border-transparent" 
          : "bg-purple-950/95 backdrop-blur-sm border-gray-800"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" onClick={closeMenus}>
              <span className="text-xl font-bold text-white">DermaDAO</span>
            </Link>
          </div>

          {/* Desktop Navigation - All items aligned to right */}
          <div className="hidden md:flex md:items-center md:justify-end md:flex-1 md:space-x-6">
            {allNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200",
                  pathname === item.href || pathname?.startsWith(item.href + '/')
                    ? isLandingPage && !scrolled 
                      ? "bg-white/20 backdrop-blur-sm text-white font-semibold" 
                      : "bg-purple-800 text-white font-semibold"
                    : "text-white hover:text-white hover:bg-white/10"
                )}
              >
                {item.name}
              </Link>
            ))}
            
            {isAuthenticated ? (
              <div className="relative">
                <button
                  className="flex items-center space-x-2 text-sm focus:outline-none text-white"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user?.profile_image || "https://github.com/shadcn.png"}
                      alt={user?.name || "User"}
                    />
                    <AvatarFallback>
                      {user?.name
                        ? user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user?.name}</span>
                  <ChevronDown size={16} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-950 border border-gray-800 rounded-md shadow-lg py-1 z-10">
                    <div className="px-4 py-2 border-b border-gray-800">
                      <p className="text-sm font-medium text-white">{user?.email}</p>
                      {user?.wallet_address && (
                        <p className="text-xs text-gray-400 mt-1">
                          Wallet: {truncateAddress(user.wallet_address)}
                        </p>
                      )}
                    </div>
                    <Link
                      href="/dashboard/profile"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-900 flex items-center"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <User size={16} className="mr-2" />
                      Profile
                    </Link>
                    <Link
                      href="/dashboard/wallet"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-900 flex items-center"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Wallet size={16} className="mr-2" />
                      Wallet
                    </Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-900 flex items-center"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} className="mr-2" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">Sign In</Button>
                </Link>
                <Link href="/auth/register">
                  <Button className="bg-white text-purple-950 hover:bg-gray-200">Sign Up</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            {isAuthenticated && (
              <div className="flex items-center mr-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={user?.profile_image || "https://github.com/shadcn.png"}
                    alt={user?.name || "User"}
                  />
                  <AvatarFallback>
                    {user?.name
                      ? user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                      : "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:text-white hover:bg-white/10 focus:outline-none"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-gray-950">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {allNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "block px-3 py-3 rounded-md text-base font-medium",
                  pathname === item.href || pathname?.startsWith(item.href + '/')
                    ? "bg-purple-800 text-white font-semibold"
                    : "text-gray-300 hover:text-white hover:bg-purple-900"
                )}
                onClick={closeMenus}
              >
                {item.name}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard/profile"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-purple-900"
                  onClick={closeMenus}
                >
                  Profile
                </Link>
                <Link
                  href="/dashboard/wallet"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-purple-900"
                  onClick={closeMenus}
                >
                  Wallet
                </Link>
                <button
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-400 hover:bg-purple-900"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col space-y-2 px-3 py-2">
                <Link href="/auth/login" onClick={closeMenus}>
                  <Button variant="outline" className="w-full text-white border-gray-700 hover:bg-purple-900">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/register" onClick={closeMenus}>
                  <Button className="w-full bg-white text-purple-950 hover:bg-gray-200">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}