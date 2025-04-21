"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function VerificationErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState<string>("Unknown error occurred during verification");

  useEffect(() => {
    // Get error message from URL parameters
    const message = searchParams.get("message");
    if (message) {
      setErrorMessage(decodeURIComponent(message));
    }
  }, [searchParams]);

  const handleTryAgain = () => {
    // Redirect to profile page to try verification again
    router.push("/dashboard/profile");
  };

  const handleGoBack = () => {
    // Redirect back to dashboard
    const redirectPath = user?.role === 'charity_admin' 
      ? '/dashboard/charity' 
      : '/dashboard';
    
    router.push(redirectPath);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center text-center">
          <AlertCircle className="h-20 w-20 text-red-500 mb-4" />
          <CardTitle className="text-2xl font-bold">Verification Failed</CardTitle>
        </CardHeader>
        <CardContent className="text-center px-6">
          <p className="mb-4">
            We encountered an issue while verifying your account with Worldcoin.
          </p>
          <p className="text-sm text-gray-700 p-3 bg-red-50 rounded-md border border-red-100">
            Error: {errorMessage}
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button 
            onClick={handleTryAgain} 
            className="w-full"
          >
            Try Again
          </Button>
          <Button 
            onClick={handleGoBack} 
            variant="outline"
            className="w-full"
          >
            Return to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 