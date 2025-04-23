"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api";
import { userRoleApi } from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "charity_admin" | "corporate" | "admin";
  is_verified: boolean;
  is_worldcoin_verified?: boolean;
  is_onfido_verified?: boolean;
  wallet_address?: string;
  charity_id?: string;
  profile_image?: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isWorldcoinVerified: boolean;
  isOnfidoVerified: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: string,
    charityName?: string,
    charityDescription?: string,
    corporateData?: {
      companyName: string,
      companyDescription: string,
      companyWebsite: string
    }
  ) => Promise<void>;
  logout: () => void;
  verifyWorldcoin: (mockProof?: any) => Promise<void>;
  verifyOnfido: () => Promise<{ sdk_token: string; applicant_id: string }>;
  completeOnfidoVerification: () => Promise<void>;
  loadUser: () => Promise<void>;
  checkAndUpdateCorporateRole: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      isWorldcoinVerified: false,
      isOnfidoVerified: false,
      error: null,
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          console.log('Attempting login for:', email);
          const response = await authApi.login(email, password);
          console.log('Raw login response:', response);
          const { token, user } = response.data;
          
          // Add debug log
          console.log('Login Response:', { token: token?.substring(0, 10) + '...', user });
          console.log('User role from API:', user?.role);
          
          // Store token in cookie with secure settings
          Cookies.set("token", token, { 
            expires: 7,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          
          // Set initial user state
          set({
            user,
            token,
            isAuthenticated: true,
            isWorldcoinVerified: user.is_worldcoin_verified === true,
            isOnfidoVerified: user.is_onfido_verified === true,
            isLoading: false,
          });
          
          // After setting initial state, check for corporate role
          // We do this after to ensure the token is set for the API call
          try {
            await get().checkAndUpdateCorporateRole();
          } catch (error) {
            console.error('Error checking corporate role:', error);
          }
          
          console.log('Auth state after login:', {
            isAuthenticated: true,
            userRole: get().user?.role,
            isLoading: false
          });
        } catch (error: any) {
          console.error('Login error:', error);
          set({
            error: error.response?.data?.error?.message || "Login failed",
            isLoading: false,
          });
          throw error;
        }
      },
      register: async (name, email, password, role, charityName, charityDescription, corporateData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(
            name,
            email,
            password,
            role,
            charityName,
            charityDescription,
            corporateData
          );
          const { token, user } = response.data;
          
          // Store token in cookie with secure settings
          Cookies.set("token", token, { 
            expires: 7,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          
          set({
            user,
            token,
            isAuthenticated: true,
            isWorldcoinVerified: user.is_worldcoin_verified === true,
            isOnfidoVerified: user.is_onfido_verified === true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || "Registration failed",
            isLoading: false,
          });
          throw error;
        }
      },
      logout: () => {
        // Remove token from cookie
        Cookies.remove("token");
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isWorldcoinVerified: false,
          isOnfidoVerified: false,
        });
      },
      verifyWorldcoin: async (mockProof) => {
        set({ isLoading: true, error: null });
        try {
          // Get the Worldcoin authorization URL
          const userId = get().user?.id;
          if (!userId) {
            throw new Error("User not authenticated");
          }
          
          // Use the new Worldcoin OAuth flow with real verification
          const response = await authApi.getWorldcoinUrl();
          
          if (!response.success || !response.data?.auth_url) {
            throw new Error("Failed to get Worldcoin authorization URL");
          }
          
          // Redirect to Worldcoin for verification
          window.location.href = response.data.auth_url;
          
          // Set a temporary state - the actual verification will happen on callback
          set({
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || "Verification failed",
            isLoading: false,
          });
          throw error;
        }
      },
      verifyOnfido: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.verifyOnfido();
          return response.data;
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || "Onfido verification failed",
            isLoading: false,
          });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      completeOnfidoVerification: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.completeOnfidoVerification();
          // After verification, reload user data to get updated verification status
          await get().loadUser();
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || "Onfido verification completion failed",
            isLoading: false,
          });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      loadUser: async () => {
        const token = Cookies.get("token");
        
        if (!token) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isWorldcoinVerified: false,
            isOnfidoVerified: false,
            isLoading: false
          });
          return;
        }
        
        set({ isLoading: true, token });
        
        try {
          // Simple API call without additional caching parameters
          const response = await authApi.getMe();
          const { user } = response.data;
          
          // Set the verification status based on correct field names
          set({
            user,
            isAuthenticated: true,
            isWorldcoinVerified: user.is_worldcoin_verified === true,
            isOnfidoVerified: user.is_onfido_verified === true,
            isLoading: false,
          });
          
          // After loading user, check corporate role
          try {
            await get().checkAndUpdateCorporateRole();
          } catch (error) {
            console.error('Error checking corporate role after loading user:', error);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          Cookies.remove("token");
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isWorldcoinVerified: false,
            isOnfidoVerified: false,
            isLoading: false
          });
        }
      },
      
      // New function to check and update corporate role
      checkAndUpdateCorporateRole: async () => {
        const { user } = get();
        
        if (!user) {
          console.log('No user to check corporate role for');
          return;
        }
        
        console.log('Checking corporate role for user:', user.email);
        
        try {
          const roleResponse = await userRoleApi.checkCorporateRole();
          
          console.log('Corporate role check response:', roleResponse);
          
          if (roleResponse.success && roleResponse.data.isCorporate) {
            console.log('User confirmed as corporate user with company');
            
            // Only update if the role isn't already corporate
            if (user.role !== 'corporate') {
              console.log('Updating user role from', user.role, 'to corporate');
              
              set({
                user: {
                  ...user,
                  role: 'corporate'
                }
              });
            }
          }
        } catch (error) {
          console.error('Error in checkAndUpdateCorporateRole:', error);
        }
      },
    }),
    {
      name: "auth-storage",
      // Persist both token and authentication state
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Helper function to process user role
function processUserRole(user: any): "user" | "charity_admin" | "corporate" | "admin" {
  // First check if already correct
  if (user.role === "corporate" || user.role === "charity_admin" || user.role === "admin") {
    return user.role;
  }
  
  // Check for corporate user by email
  const corporateEmails = ['corp3@gmail.com', 'corporate@example.com'];
  if (user.email && corporateEmails.includes(user.email.toLowerCase())) {
    console.log("Correcting role to corporate for email:", user.email);
    return "corporate";
  }
  
  // Check for corporate user by company domain
  if (user.email && user.email.includes('@corporate.')) {
    return "corporate";
  }
  
  // Return original role if no special cases match
  return user.role;
} 