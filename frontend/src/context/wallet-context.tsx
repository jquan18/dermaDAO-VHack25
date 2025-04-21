"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import api from "@/services/api";

interface WalletContextType {
  address: string | null;
  balance: number | null;
  isConnecting: boolean;
  isConnected: boolean;
  connectWithBackendWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  balance: null,
  isConnecting: false,
  isConnected: false,
  connectWithBackendWallet: async () => {},
  disconnectWallet: () => {},
});

export const useWalletContext = () => useContext(WalletContext);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to connect with backend wallet
        await connectWithBackendWallet();
      } catch (error) {
        console.error("Error checking wallet connection:", error);
      }
    };
    
    checkConnection();
  }, []);

  const connectWithBackendWallet = async () => {
    try {
      // Check if user is logged in first
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("No token found, user needs to login first");
        return;
      }

      setIsConnecting(true);
      
      // Fetch user wallet from backend
      const response = await api.getCurrentUser();
      
      if (response.data && response.data.data && response.data.data.wallet_address) {
        const backendWalletAddress = response.data.data.wallet_address;
        setAddress(backendWalletAddress);
        setIsConnected(true);
        
        // Fetch balance from backend
        try {
          const balanceResponse = await api.getWalletBalance();
          if (balanceResponse.data && balanceResponse.data.data) {
            setBalance(parseFloat(balanceResponse.data.data.balance));
          }
        } catch (error) {
          console.error("Error fetching wallet balance:", error);
          setBalance(0);
        }
        
        console.log("Connected with ERC4337 account wallet:", backendWalletAddress);
      } else {
        console.warn("User doesn't have a wallet address in the backend");
      }
    } catch (error) {
      console.error("Error connecting with ERC4337 wallet:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setBalance(null);
    setIsConnected(false);
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        isConnecting,
        isConnected,
        connectWithBackendWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

// Types for global ethereum object
declare global {
  interface Window {
    ethereum: any;
  }
} 