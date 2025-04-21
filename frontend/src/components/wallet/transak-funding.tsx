"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/hooks/use-toast";
import { walletApi } from "@/lib/api";
import { TransakConfig, Transak } from '@transak/transak-sdk';

interface TransakFundingProps {
  onSuccess?: (orderData: any) => void;
}

export function TransakFunding({ onSuccess }: TransakFundingProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [transakInstance, setTransakInstance] = useState<Transak | null>(null);

  useEffect(() => {
    // Cleanup when component unmounts
    return () => {
      if (transakInstance) {
        transakInstance.close();
      }
    };
  }, [transakInstance]);

  // Set up event listeners when component mounts
  useEffect(() => {
    // Set up event listeners
    const handleWidgetClose = () => {
      console.log('Transak widget closed');
      setIsOpen(false);
      if (transakInstance) {
        transakInstance.close();
      }
    };

    const handleOrderCreated = (orderData: any) => {
      console.log('Order created:', orderData);
      toast({
        title: "Order Created",
        description: "Your funding order has been created successfully.",
      });
    };

    const handleOrderSuccess = async (orderData: any) => {
      console.log('Order successful:', orderData);
      
      // Record the transaction in our system
      try {
        await walletApi.recordTransakTransaction({
          orderId: orderData.orderId,
          amount: orderData.cryptoAmount,
          cryptoCurrency: orderData.cryptoCurrency,
          fiatCurrency: orderData.fiatCurrency,
          status: 'completed',
          transactionHash: orderData.transactionHash
        });
      } catch (error) {
        console.error('Error recording transaction:', error);
      }
      
      toast({
        title: "Funding Successful",
        description: "Your wallet has been funded successfully.",
        variant: "default",
      });
      
      if (onSuccess) {
        onSuccess(orderData);
      }
      
      if (transakInstance) {
        transakInstance.close();
      }
    };

    // Register event handlers
    Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, handleWidgetClose);
    Transak.on(Transak.EVENTS.TRANSAK_ORDER_CREATED, handleOrderCreated);
    Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, handleOrderSuccess);

    // Note: The Transak SDK doesn't provide a way to remove event listeners
    // according to the TypeScript definitions, so we can't clean them up properly.
    // This could potentially lead to memory leaks if this component is mounted/unmounted frequently.
  }, [toast, onSuccess, transakInstance]);

  const openTransakWidget = () => {
    if (!user?.wallet_address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect a wallet before trying to fund it.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Transak configuration
      const transakConfig: TransakConfig = {
        apiKey: process.env.NEXT_PUBLIC_TRANSAK_API_KEY || '', // Replace with your API key
        environment: process.env.NODE_ENV === 'production' 
          ? Transak.ENVIRONMENTS.PRODUCTION 
          : Transak.ENVIRONMENTS.STAGING,
        defaultCryptoCurrency: 'ETH',
        walletAddress: user.wallet_address,
        themeColor: '#7b3fe4', // Color should match your app's primary color
        email: user.email,
        widgetHeight: '650px',
        widgetWidth: '100%',
        network: 'ethereum',
        hideMenu: true,
      };

      // Initialize Transak
      const transak = new Transak(transakConfig);
      setTransakInstance(transak);
      setIsOpen(true);

      // Open the widget
      transak.init();
    } catch (error) {
      console.error('Error initializing Transak:', error);
      toast({
        title: "Error",
        description: "Failed to initialize payment widget. Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button 
      className="flex-1" 
      onClick={openTransakWidget}
      disabled={!user?.wallet_address}
    >
      Fund Wallet
    </Button>
  );
} 