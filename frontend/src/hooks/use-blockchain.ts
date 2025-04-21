"use client";

import { useState, useEffect } from "react";
import { blockchain } from "@/lib/blockchain";

interface BlockchainState {
  isWalletConnected: boolean;
  account: string | null;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
  blockchain: typeof blockchain;
}

export function useBlockchain(): BlockchainState {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already connected
    const checkConnection = async () => {
      if (typeof window === 'undefined' || !window.ethereum) {
        setIsLoading(false);
        return;
      }
      
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsWalletConnected(true);
          
          // Connect blockchain service
          await blockchain.connectWallet(window.ethereum);
          
          // Check if connected account is platform owner
          const ownerCheck = await blockchain.isOwner();
          setIsOwner(ownerCheck);
        }
      } catch (error) {
        console.error("Failed to check existing connection", error);
        setError("Failed to check wallet connection");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkConnection();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        setAccount(null);
        setIsWalletConnected(false);
        setIsOwner(false);
      } else {
        // User switched accounts
        setAccount(accounts[0]);
        setIsWalletConnected(true);
        
        // Re-check owner status
        blockchain.isOwner().then(setIsOwner);
      }
    };
    
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, []);

  return {
    isWalletConnected,
    account,
    isOwner,
    isLoading,
    error,
    blockchain
  };
} 