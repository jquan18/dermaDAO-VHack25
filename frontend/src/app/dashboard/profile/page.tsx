"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  User,
  Mail,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Fingerprint,
  ExternalLink,
} from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { VerificationOptions } from "@/components/auth/VerificationOptions";

export default function UserProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isWorldcoinVerified, isOnfidoVerified } = useAuthStore();
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);
  
  const isVerified = isWorldcoinVerified || isOnfidoVerified;
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-64 bg-gray-200 rounded w-full"></div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">User Profile</h1>
        <p className="text-gray-600">
          Manage your account information and verification
        </p>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your personal details and wallet information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={user?.name || ""} disabled />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ""} disabled />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="wallet">Wallet Address</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="wallet" 
                  value={user?.wallet_address ? truncateAddress(user.wallet_address) : "No wallet connected"} 
                  disabled 
                />
                {user?.wallet_address && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`https://sepolia.scrollscan.dev/address/${user.wallet_address}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Verification Status:</span>
                <div className="flex items-center">
                  {isVerified ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-200 text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Not Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Verification Options */}
        <VerificationOptions className="h-full" />
      </div>
    </DashboardLayout>
  );
} 