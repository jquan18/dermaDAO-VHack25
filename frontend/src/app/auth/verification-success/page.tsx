"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function VerificationSuccessPage() {
  const router = useRouter();
  const { loadUser, user, isWorldcoinVerified, isOnfidoVerified } = useAuthStore();
  const [userLoaded, setUserLoaded] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [verificationMethod, setVerificationMethod] = useState<string>("");

  // First useEffect to load user data only once
  useEffect(() => {
    const updateUserData = async () => {
      if (!userLoaded) {
        console.log("Loading user data after verification...");
        
        try {
          // Force fresh data with timestamp
          const timestamp = new Date().getTime();
          await loadUser();
          setUserLoaded(true);
          
          console.log("User data reloaded:");
          console.log("Worldcoin verification:", user?.is_worldcoin_verified);
          console.log("Onfido verification:", user?.is_onfido_verified);
          console.log("Store worldcoin status:", isWorldcoinVerified);
          console.log("Store onfido status:", isOnfidoVerified);
          
          // Determine which verification method was used
          if (user?.is_worldcoin_verified) {
            setVerificationMethod("Worldcoin");
          } else if (user?.is_onfido_verified) {
            setVerificationMethod("Onfido");
          } else {
            setVerificationMethod("identity provider");
          }
          
          // If we have a user, but their verification status doesn't match what's in the store
          // after 3 attempts, force a hard reload to clear all states
          if (user && attempts > 2 && 
              (user.is_worldcoin_verified !== isWorldcoinVerified || 
               user.is_onfido_verified !== isOnfidoVerified)) {
            console.log("Status mismatch detected after multiple attempts, forcing page reload...");
            window.location.reload();
          } else if (attempts < 3) {
            setAttempts(prev => prev + 1);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
        }
      }
    };
    
    updateUserData();
  }, [loadUser, userLoaded, attempts, user, isWorldcoinVerified, isOnfidoVerified]);
  
  // Second useEffect to handle redirection after user data is loaded
  useEffect(() => {
    if (userLoaded && user) {
      const timer = setTimeout(() => {
        const redirectPath = user?.role === 'charity_admin' 
          ? '/dashboard/charity' 
          : '/dashboard';
        
        console.log("Redirecting to dashboard:", redirectPath);
        router.push(redirectPath);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [router, user, userLoaded]);

  const handleContinue = () => {
    const redirectPath = user?.role === 'charity_admin' 
      ? '/dashboard/charity' 
      : '/dashboard';
    
    router.push(redirectPath);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center text-center">
          <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
          <CardTitle className="text-2xl font-bold">Verification Successful!</CardTitle>
        </CardHeader>
        <CardContent className="text-center px-6">
          <p className="mb-4">
            Your account has been successfully verified with {verificationMethod}. You can now participate in quadratic funding.
          </p>
          <p className="text-sm text-gray-500">
            You will be automatically redirected to your dashboard in a few seconds.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleContinue} 
            className="w-full"
          >
            Continue to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 