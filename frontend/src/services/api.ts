import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor for auth headers
axiosInstance.interceptors.request.use(
  (config) => {
    // Use client-side only localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => {
    // Normalize the response to always return { success: true, data: ... } format
    if (response.data && typeof response.data === 'object') {
      // If response already has success and data properties, return it
      if (typeof response.data.success === 'boolean' && 'data' in response.data) {
        return response.data;
      }
      
      // Otherwise, wrap the data in our standard format
      return { success: true, data: response.data };
    }
    
    // Handle primitive data responses
    return { success: true, data: response };
  },
  (error) => {
    console.error('API Error:', error);
    
    // Handle specific error cases
    if (error.response) {
      // If the error response already has our format
      if (error.response.data && typeof error.response.data.success === 'boolean') {
        return Promise.reject(error.response.data);
      }
      
      // Format standard HTTP errors
      return Promise.reject({
        success: false,
        error: {
          message: error.response.data?.message || `Error: ${error.response.status} ${error.response.statusText}`,
          code: error.response.data?.code || `HTTP_${error.response.status}`
        }
      });
    }
    
    // Format network errors
    if (error.request) {
      return Promise.reject({
        success: false,
        error: {
          message: 'Network error. Please check your connection.',
          code: 'NETWORK_ERROR'
        }
      });
    }
    
    // Other errors
    return Promise.reject({
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        code: 'UNKNOWN_ERROR'
      }
    });
  }
);

// Define explicit interfaces for API responses
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    code: string;
  };
}

// Type for Pool object
interface Pool {
  id: string;
  name: string;
  description: string;
  theme: string;
  sponsor_id?: number;
  admin_id?: number;
  company_id?: number;
  contract_pool_id?: number;
  round_duration: number;
  total_funds: number;
  allocated_funds: number;
  is_active: boolean;
  logo_image?: string;
  banner_image?: string;
  matching_ratio?: number;
  start_date?: string | null;
  end_date?: string | null;
  is_distributed?: boolean;
  distributed_at?: string | null;
  distribution_tx_hash?: string | null;
  created_at: string;
  updated_at: string;
  project_count?: number;
  currency?: string;
}

// Type for Project object
interface Project {
  id: string;
  charity_id: number;
  pool_id: number;
  name: string;
  description: string;
  image_url?: string;
  ipfs_hash?: string;
  funding_goal: number;
  duration_days?: number;
  is_active: boolean;
  wallet_address: string;
  verification_score?: number;
  verification_notes?: string;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  charity_name?: string;
  category?: string;
  tags?: string[];
  funding_progress?: {
    raised: number;
  };
  contributions_count?: number;
}

// Type for Distribution object
interface Distribution {
  id: string;
  pool_id: number;
  round_number: number;
  start_time: string;
  end_time: string;
  matching_amount: number;
  is_distributed: boolean;
  transaction_hash?: string;
  project_count: number;
  created_at: string;
}

// Type for Donation object
interface Donation {
  id: string;
  user_id: number;
  project_id?: number | null;
  pool_id?: number | null;
  amount: number;
  transaction_hash: string;
  donation_type?: string;
  quadratic_eligible: boolean;
  created_at: string;
  project?: {
    id: string;
    name: string;
    image_url?: string;
  };
}

export const api = {
  // Auth methods
  login: (email: string, password: string) => 
    axiosInstance.post<ApiResponse<{ token: string; user_id: number; }>>('/auth/login', { email, password }),
  
  register: (userData: any) => 
    axiosInstance.post<ApiResponse<{ token: string; user_id: number; }>>('/auth/register', userData),
  
  forgotPassword: (email: string) => 
    axiosInstance.post<ApiResponse<{ message: string; }>>('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) => 
    axiosInstance.post<ApiResponse<{ message: string; }>>('/auth/reset-password', { token, password }),
  
  // User methods
  getCurrentUser: () => 
    axiosInstance.get<ApiResponse<any>>('/users/me'),
  
  updateProfile: (userData: any) => 
    axiosInstance.put<ApiResponse<any>>('/users/me', userData),
  
  // Wallet methods
  getWalletBalance: () => 
    axiosInstance.get<ApiResponse<{ balance: number; }>>('/wallet/balance'),
  
  getWalletTransactions: () => 
    axiosInstance.get<ApiResponse<any[]>>('/wallet/transactions'),
  
  // Project methods
  getProjects: (params?: any) => 
    axiosInstance.get<ApiResponse<Project[]>>('/projects', { params }),
  
  getProject: (id: string) => 
    axiosInstance.get<ApiResponse<Project>>(`/projects/${id}`),
  
  createProject: (projectData: any) => 
    axiosInstance.post<ApiResponse<Project>>('/projects', projectData),
  
  updateProject: (id: string, projectData: any) => 
    axiosInstance.put<ApiResponse<Project>>(`/projects/${id}`, projectData),
  
  deleteProject: (id: string) => 
    axiosInstance.delete<ApiResponse<{ message: string; }>>(`/projects/${id}`),
  
  // Pool methods
  getPools: (params?: any) => 
    axiosInstance.get<ApiResponse<Pool[]>>('/pools', { params }),
  
  getPool: (id: string) => 
    axiosInstance.get<ApiResponse<Pool>>(`/pools/${id}`),
  
  createPool: (poolData: any) => 
    axiosInstance.post<ApiResponse<Pool>>('/pools', poolData),
  
  updatePool: (id: string, poolData: any) => 
    axiosInstance.put<ApiResponse<Pool>>(`/pools/${id}`, poolData),
  
  deletePool: (id: string) => 
    axiosInstance.delete<ApiResponse<{ message: string; }>>(`/pools/${id}`),
  
  distributePoolFunds: (id: string, createNewRound: boolean = false) => 
    axiosInstance.post<ApiResponse<any>>(`/pools/${id}/distribute`, { create_new_round: createNewRound }),
  
  // Donation methods
  getDonations: (params?: any) => 
    axiosInstance.get<ApiResponse<Donation[]>>('/donations', { params }),
  
  createDonation: (donationData: any) => 
    axiosInstance.post<ApiResponse<Donation>>('/donations', donationData),
  
  // Projects within a pool
  getPoolProjects: (poolId: string, params?: any) => 
    axiosInstance.get<ApiResponse<Project[]>>(`/pools/${poolId}/projects`, { params }),
  
  // User donations within a pool
  getUserPoolDonations: (poolId: string) => 
    axiosInstance.get<ApiResponse<Donation[]>>(`/pools/${poolId}/user-donations`),
  
  // Pool statistics and metrics
  getPoolStats: (poolId: string) => 
    axiosInstance.get<ApiResponse<any>>(`/pools/${poolId}/statistics`),
  
  // Pool distributions/rounds history
  getPoolDistributions: (poolId: string) => 
    axiosInstance.get<ApiResponse<Distribution[]>>(`/pools/${poolId}/distributions`),
  
  // Match calculation preview
  calculateMatchPreview: (poolId: string, donationAmount: number, projectId: string) => 
    axiosInstance.post<ApiResponse<{ matching_amount: number; }>>(`/pools/${poolId}/calculate-match`, { 
      donationAmount, 
      projectId 
    }),
  
  // Direct project donation
  donateToProject: (projectId: string, amount: number, transaction_hash?: string) => 
    axiosInstance.post<ApiResponse<Donation>>(`/projects/${projectId}/donate`, {
      amount,
      transaction_hash
    }),
  
  // Pool donation
  donateToPool: (poolId: string, amount: number, transaction_hash?: string) => 
    axiosInstance.post<ApiResponse<{ message: string; }>>(
      `/pools/${poolId}/donate`, 
      { amount, transaction_hash }
    ),
};

export default api;

// Re-export APIs from the lib directory
import { quadraticFundingApi } from "@/lib/api";

export { quadraticFundingApi }; 