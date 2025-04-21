"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";

interface WorldcoinVerificationProps {
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export function WorldcoinVerification({ 
  className = "", 
  size = "default",
  variant = "default"
}: WorldcoinVerificationProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check for is_worldcoin_verified which is the correct field name in the database
  const isVerified = user?.is_worldcoin_verified === true;

  const handleVerification = async () => {
    if (!isAuthenticated || !user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to verify your account with Worldcoin.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Get Worldcoin authorization URL
      const response = await authApi.getWorldcoinUrl();
      
      if (response.success && response.data?.auth_url) {
        // Redirect to Worldcoin for verification
        window.location.href = response.data.auth_url;
      } else {
        throw new Error('Failed to get verification URL');
      }
    } catch (error) {
      console.error('Error starting Worldcoin verification:', error);
      toast({
        title: "Verification Error",
        description: "Unable to start verification process. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // If user is already verified, show verified status
  if (isVerified) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
            Verified with Worldcoin
          </CardTitle>
          <CardDescription>
            Your account is verified for quadratic funding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Verified
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // If not verified, show verification button
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Worldcoin Verification</CardTitle>
        <CardDescription>
          Verify your account with Worldcoin to participate in quadratic funding
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-4">
          Worldcoin verification is required to ensure each person only contributes once to the
          quadratic funding pool, making the system fair and resistant to manipulation.
        </p>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleVerification} 
          disabled={isLoading} 
          size={size}
          variant={variant}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting to Worldcoin...
            </>
          ) : (
            <>
              Verify with Worldcoin
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 