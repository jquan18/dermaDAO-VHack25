"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, AlertTriangle, Check } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { truncateAddress } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { useWalletContext } from "@/context/wallet-context";

// Add ethereum property to Window interface
declare global {
  interface Window {
    ethereum?: any;
  }
}

interface ConnectWalletProps {
  onConnect?: () => void;
}

export function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { 
    isConnecting, 
    address, 
    isConnected, 
    connectWithBackendWallet,
    isBackendWallet 
  } = useWalletContext();

  const handleConnect = async () => {
    try {
      // Only use the backend ERC4337 wallet
      await connectWithBackendWallet();
      
      toast({
        title: "Wallet connected",
        description: "Your account wallet has been successfully connected.",
      });
      
      // Call the onConnect callback if provided
      if (onConnect) {
        onConnect();
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast({
        title: "Connection failed",
        description: "There was an error connecting your wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Only authenticated users can see this component
  if (!user) {
    return null;
  }

  if (isConnected && address) {
    // User's wallet is connected
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <Check className="h-4 w-4 mr-2 text-green-600" />
            Account Wallet Connected
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          <p className="text-xs text-muted-foreground">
            Connected to your built-in ERC4337 wallet: {truncateAddress(address)}
          </p>
        </CardContent>
        <CardFooter className="pt-2">
          <p className="text-xs text-green-600">
            You can now perform operations on the blockchain.
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Connect Account Wallet</CardTitle>
        <CardDescription>Required for blockchain operations</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-xs text-muted-foreground">
          Connect to your secure ERC4337 account wallet that was created when you signed up.
        </p>
      </CardContent>
      <CardFooter className="pt-2">
        <Button 
          className="w-full"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting..." : (
            <>
              <Wallet className="h-4 w-4 mr-2" />
              Connect Account Wallet
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 