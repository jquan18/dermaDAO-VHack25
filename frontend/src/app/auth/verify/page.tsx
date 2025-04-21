"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Fingerprint } from "lucide-react";

export default function WorldcoinVerifyPage() {
  const router = useRouter();
  const { user, isAuthenticated, verifyWorldcoin, isLoading, isWorldcoinVerified } = useAuthStore();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  // Check if user is authenticated and redirect if not
  if (!isAuthenticated && typeof window !== "undefined") {
    router.push("/auth/login");
  }

  const handleVerify = async () => {
    setIsVerifying(true);

    try {
      // The mock implementation is now much simpler
      await verifyWorldcoin();

      toast({
        title: "Verification Successful",
        description: "Your account has been verified successfully!",
        variant: "default",
      });

      // Redirect to dashboard after verification
      setTimeout(() => {
        router.push("/dashboard/charity");
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "There was an error verifying your account.",
        variant: "destructive",
      });
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-3xl font-bold text-primary">DermaDAO</h1>
          </Link>
          <p className="text-gray-600 mt-2">
            Transparent charity funding on blockchain
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">One-Click Verification</CardTitle>
            <CardDescription className="text-center">
              Verify your account to access all features
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isWorldcoinVerified ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold text-green-600">Verification Complete!</h3>
                <p className="text-gray-600">
                  Your account has been successfully verified. You can now create projects and
                  receive donations.
                </p>
                <Button
                  onClick={() => router.push("/dashboard/charity")}
                  className="w-full mt-4"
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-blue-700 font-medium">
                    Verification is mocked for demonstration purposes. 
                    Just click the button below to verify your account.
                  </p>
                </div>

                <div className="border rounded-lg p-6 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="bg-primary/10 p-4 rounded-full">
                      <Fingerprint className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Mock Worldcoin Verification</h3>
                  <p className="text-gray-600 mb-6">
                    In a real implementation, this would connect to the Worldcoin protocol
                    for biometric verification.
                  </p>
                  
                  <Button
                    onClick={handleVerify}
                    className="w-full"
                    size="lg"
                    disabled={isLoading || isVerifying}
                  >
                    {isVerifying ? "Verifying..." : "Verify Now (One Click)"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 