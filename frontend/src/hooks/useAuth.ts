"use client";

import { useEffect } from "react";
import { useAuthStore, User } from "@/store/auth-store";

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: string,
    charityName?: string,
    charityDescription?: string
  ) => Promise<void>;
  logout: () => void;
  verifyWorldcoin: (mockProof?: any) => Promise<void>;
  loadUser: () => Promise<void>;
  isWorldcoinVerified: boolean;
}

export function useAuth(): UseAuthReturn {
  const authStore = useAuthStore();
  
  // Load user data on first mount if not already loaded
  useEffect(() => {
    if (!authStore.isAuthenticated && !authStore.isLoading && authStore.token) {
      authStore.loadUser();
    }
  }, []);
  
  return {
    user: authStore.user,
    isAuthenticated: authStore.isAuthenticated,
    isLoading: authStore.isLoading,
    error: authStore.error,
    login: authStore.login,
    register: authStore.register,
    logout: authStore.logout,
    verifyWorldcoin: authStore.verifyWorldcoin,
    loadUser: authStore.loadUser,
    isWorldcoinVerified: authStore.isWorldcoinVerified
  };
} 