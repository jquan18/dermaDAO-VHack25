"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function VerificationSuccessRedirect() {
  const router = useRouter();
  const { loadUser, user, isWorldcoinVerified, isOnfidoVerified } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // First load the user data to ensure verification status is up-to-date
    const updateUserData = async () => {
      console.log("Reloading user data before redirecting to success page...");
      
      try {
        // Force fresh data with timestamp
        const timestamp = new Date().getTime();
        await loadUser();
        
        console.log("User data loaded:", user);
        console.log("Current Worldcoin verification status:", isWorldcoinVerified);
        console.log("Current Onfido verification status:", isOnfidoVerified);
        console.log("User worldcoin field:", user?.is_worldcoin_verified);
        console.log("User onfido field:", user?.is_onfido_verified);
        
        // If verification statuses mismatch, force a hard reload to reset everything
        if (user && 
            (Boolean(user.is_worldcoin_verified) !== isWorldcoinVerified || 
             Boolean(user.is_onfido_verified) !== isOnfidoVerified)) {
          console.log("Verification status mismatch! Forcing reload...");
          window.location.reload();
          return;
        }
        
        // Then redirect to the actual verification success page
        router.push('/auth/verification-success');
      } catch (error) {
        console.error("Error reloading user data:", error);
        // Still redirect even if there's an error
        router.push('/auth/verification-success');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Clear browser cache before loading user data
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Add a small delay to ensure cache operations complete
    setTimeout(() => {
      updateUserData();
    }, 300);
    
  }, [router, loadUser, user, isWorldcoinVerified, isOnfidoVerified]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center text-center">
          <Loader2 className="h-20 w-20 text-blue-500 mb-4 animate-spin" />
          <h2 className="text-2xl font-bold">Redirecting...</h2>
        </CardHeader>
        <CardContent className="text-center px-6">
          <p>Please wait while we verify your account status...</p>
          {isLoading && (
            <p className="text-sm text-gray-500 mt-3">
              This may take a few moments to update all systems.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 