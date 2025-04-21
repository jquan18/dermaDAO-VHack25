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
  const { user, isAuthenticated, logout, loadUser, isLoading } = useAuthStore();

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

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Funding Pools", href: "/pools" },
    { name: "Projects", href: "/projects" },
    { name: "How It Works", href: "/how-it-works" },
    { name: "About", href: "/about" },
  ];

  // Add additional nav items for specific roles
  const roleNavItems = isAuthenticated
    ? user?.role === "charity_admin"
      ? [
          { name: "Dashboard", href: "/dashboard/charity" },
          { name: "Wallet", href: "/dashboard/wallet" }
        ]
      : user?.role === "admin"
      ? [
          { name: "Admin Panel", href: "/dashboard/admin" },
          { name: "Wallet", href: "/dashboard/wallet" }
        ]
      : [
          { name: "My Donations", href: "/dashboard/donations" },
          { name: "Wallet", href: "/dashboard/wallet" }
        ]
    : [];

  const allNavItems = [...navItems, ...roleNavItems];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" onClick={closeMenus}>
              <span className="text-xl font-bold text-primary">DermaDAO</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
            {allNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium",
                  pathname === item.href
                    ? "text-primary font-semibold"
                    : "text-gray-700 hover:text-primary hover:bg-gray-50"
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Authentication Section - Desktop */}
          <div className="hidden md:flex md:items-center md:space-x-2">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  className="flex items-center space-x-2 text-sm focus:outline-none"
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
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium">{user?.email}</p>
                      {user?.wallet_address && (
                        <p className="text-xs text-gray-500 mt-1">
                          Wallet: {truncateAddress(user.wallet_address)}
                        </p>
                      )}
                    </div>
                    <Link
                      href="/dashboard/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <User size={16} className="mr-2" />
                      Profile
                    </Link>
                    <Link
                      href="/dashboard/wallet"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Wallet size={16} className="mr-2" />
                      Wallet
                    </Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
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
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/auth/register">
                  <Button>Sign Up</Button>
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
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-800 hover:text-primary hover:bg-gray-100 focus:outline-none"
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
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {allNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "block px-3 py-2 rounded-md text-base font-medium",
                  pathname === item.href
                    ? "text-primary font-semibold"
                    : "text-gray-700 hover:text-primary hover:bg-gray-50"
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
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50"
                  onClick={closeMenus}
                >
                  Profile
                </Link>
                <Link
                  href="/dashboard/wallet"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50"
                  onClick={closeMenus}
                >
                  Wallet
                </Link>
                <button
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-gray-50"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col space-y-2 px-3 py-2">
                <Link href="/auth/login" onClick={closeMenus}>
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/register" onClick={closeMenus}>
                  <Button className="w-full">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
} 