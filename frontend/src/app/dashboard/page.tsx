"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export default function DashboardRedirect() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // Only redirect after auth state is loaded
    if (!isLoading) {
      console.log("Dashboard redirect state:", { isAuthenticated, userRole: user?.role });
      
      if (!isAuthenticated) {
        console.log("Not authenticated, redirecting to login");
        router.push("/auth/login");
        return;
      }

      // Redirect based on user role
      if (user?.role === "charity_admin") {
        console.log("Redirecting to charity dashboard");
        router.push("/dashboard/charity");
      } else if (user?.role === "admin") {
        console.log("Redirecting to admin dashboard");
        router.push("/dashboard/admin");
      } else if (user?.role === "corporate") {
        console.log("Redirecting to corporate dashboard");
        router.push("/dashboard/corporate");
      } else {
        // For regular users, redirect to pools page as the main entry point
        console.log("Redirecting to pools dashboard");
        router.push("/dashboard/pools");
      }
    }
  }, [isAuthenticated, isLoading, router, user?.role]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-center">
        <div className="bg-primary/10 p-5 rounded-full inline-flex mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/30"></div>
        </div>
        <h2 className="text-xl font-medium text-gray-700">Loading your dashboard...</h2>
      </div>
    </div>
  );
} 