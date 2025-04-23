"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorldcoinVerification } from "./WorldcoinVerification";
import { OnfidoVerification } from "./OnfidoVerification";
import { useAuthStore } from "@/store/auth-store";

interface VerificationOptionsProps {
  className?: string;
}

export function VerificationOptions({ className = "" }: VerificationOptionsProps) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>("worldcoin");
  
  const isWorldcoinVerified = user?.is_worldcoin_verified === true;
  const isOnfidoVerified = user?.is_onfido_verified === true;
  const isVerified = isWorldcoinVerified || isOnfidoVerified;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Verify Your Identity</CardTitle>
        <CardDescription>
          Verification is required for participating in quadratic funding rounds.
          Choose one of the verification methods below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isVerified ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
            <p className="font-medium">Your identity is verified!</p>
            {/* <p className="text-sm mt-1">
              {isWorldcoinVerified && "✓ Verified with Worldcoin"}
              {isWorldcoinVerified && isOnfidoVerified && " and "}
              {isOnfidoVerified && "✓ Verified with Onfido"}
            </p> */}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="worldcoin">Worldcoin</TabsTrigger>
              <TabsTrigger value="onfido">Onfido</TabsTrigger>
            </TabsList>
            <TabsContent value="worldcoin" className="space-y-4">
              <div className="text-sm mb-4">
                <p>Verify with Worldcoin for enhanced privacy and Sybil-resistance.</p>
                <p className="mt-2 text-muted-foreground">
                  Requires a Worldcoin account and World ID.
                </p>
              </div>
              <WorldcoinVerification className="w-full" size="lg" />
            </TabsContent>
            <TabsContent value="onfido" className="space-y-4">
              <div className="text-sm mb-4">
                <p>Verify with Onfido using your government-issued ID and a selfie.</p>
                <p className="mt-2 text-muted-foreground">
                  Requires a valid ID document (passport, driver's license, etc.) and camera access.
                </p>
              </div>
              <OnfidoVerification className="w-full" size="lg" />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
} 