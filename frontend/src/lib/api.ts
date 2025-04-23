import axios from 'axios';
import Cookies from 'js-cookie';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Keep track of if we're already redirecting to prevent loops
let isRedirecting = false;

// Add request interceptor to add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401 && !isRedirecting) {
      isRedirecting = true;
      // Clear auth state
      Cookies.remove('token');
      
      // Only redirect if we're in the browser
      if (typeof window !== 'undefined') {
        // Small delay to avoid potential loops
        setTimeout(() => {
          window.location.href = '/auth/login';
          isRedirecting = false;
        }, 100);
      }
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  register: async (
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
  ) => {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
      role,
      charity_name: charityName,
      charity_description: charityDescription,
      company_name: corporateData?.companyName,
      company_description: corporateData?.companyDescription,
      company_website: corporateData?.companyWebsite
    });
    return response.data;
  },
  verifyWorldcoin: async (userId: string, proof: any) => {
    const response = await api.post('/auth/verify-worldcoin', {
      user_id: userId,
      proof,
    });
    return response.data;
  },
  getWorldcoinUrl: async () => {
    const response = await api.get('/auth/worldcoin-url');
    return response.data;
  },
  verifyOnfido: async () => {
    const response = await api.post('/auth/onfido-verify');
    return response.data;
  },
  completeOnfidoVerification: async () => {
    const response = await api.post('/auth/onfido-callback');
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Charity API
export const charityApi = {
  getCharityDetails: async (id: string) => {
    const response = await api.get(`/charities/${id}`);
    return response.data;
  },
  getUserCharity: async () => {
    try {
      const response = await api.get('/auth/my-charity');
      // Ensure we return the data in a consistent format
      if (response.data && response.data.success) {
        return {
          success: true,
          data: {
            charity: response.data.data
          }
        };
      }
      return response.data;
    } catch (error: unknown) {
      console.error("Error fetching user's charity:", error);
      return {
        success: false,
        error: { 
          message: error instanceof Error 
            ? error.message 
            : "Failed to fetch user's charity",
          code: "FETCH_ERROR"
        }
      };
    }
  },
  createCharity: async (charityData: any) => {
    const response = await api.post('/charities', charityData);
    return response.data;
  },
  updateCharity: async (id: string, charityData: any) => {
    const response = await api.put(`/charities/${id}`, charityData);
    return response.data;
  },
  getVerificationStatus: async (id: string) => {
    const response = await api.get(`/charities/${id}/verification`);
    return response.data;
  },
  uploadDocument: async (id: string, formData: FormData) => {
    const response = await api.post(`/charities/${id}/documentation`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Projects API
export const projectsApi = {
  getAllProjects: async (page = 1, limit = 10, filters = {}) => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });
    const response = await api.get(`/projects?${queryParams}`);
    return response.data;
  },
  getProject: async (id: string) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },
  getCharityProjects: async (charityId?: string) => {
    try {
      console.log("=== getCharityProjects START ===");
      console.log("Initial charityId:", charityId);
      
      // If charityId not provided, we need to find the user's charity
      if (!charityId) {
        console.log("No charityId provided, trying to determine it");
        
        // First get the user profile to get the user ID
        console.log("Fetching user profile...");
        const userResponse = await api.get('/auth/me');
        console.log("User API response:", userResponse.data);
        
        if (!userResponse.data.success || !userResponse.data.data) {
          console.error("Failed to get user profile");
          return {
            success: false,
            error: { message: "Failed to get user profile" }
          };
        }
        
        const userData = userResponse.data.data;
        console.log("User profile data:", JSON.stringify(userData));
        
        // Option 1: The user has a charity_id property
        if (userData.user && userData.user.charity_id) {
          charityId = userData.user.charity_id.toString();
          console.log("Found charity_id in user profile:", charityId);
        } 
        // Option 2: Need to find charity where user is admin
        else {
          console.log("No charity_id in user profile, trying to find charity where user is admin");
          const userId = userData.user ? userData.user.id : undefined;
          console.log("User ID:", userId);
          
          // Get list of charities
          try {
            console.log("Fetching charities list...");
            const charitiesResponse = await api.get('/charities');
            console.log("Charities API response:", charitiesResponse.data);
            
            if (charitiesResponse.data.success) {
              // Get charities array
              const charitiesList = charitiesResponse.data.data?.charities || [];
              console.log("Charities list:", JSON.stringify(charitiesList));
              
              if (Array.isArray(charitiesList)) {
                console.log("Looking for charity where admin_id =", userId);
                
                // Find charity where user is admin
                const userCharity = charitiesList.find(
                  (charity) => {
                    console.log("Checking charity:", charity.id, "admin_id:", charity.admin_id);
                    return charity.admin_id === userId;
                  }
                );
                
                if (userCharity) {
                  charityId = userCharity.id.toString();
                  console.log("Found charity where user is admin:", charityId);
                } else {
                  console.log("No charity found where user is admin");
                }
              } else {
                console.error("Charities list is not an array");
              }
            } else {
              console.error("Charities API response was not successful");
            }
          } catch (err: unknown) {
            console.error("Error fetching charities:", err);
          }
        }
        
        if (!charityId) {
          console.error("User is not associated with a charity");
          return {
            success: false,
            error: { message: "User is not associated with a charity" }
          };
        }
      }
      
      console.log("Fetching projects for charity ID:", charityId);
      const response = await api.get(`/projects/charity/${charityId}`);
      console.log("Projects API response:", response.data);
      console.log("=== getCharityProjects END ===");
      
      return response.data;
    } catch (error: unknown) {
      console.error("Error in getCharityProjects:", error);
      return {
        success: false,
        data: { projects: [] },
        error: { 
          message: error instanceof Error 
            ? error.message
            : "Failed to fetch charity projects",
          code: "FETCH_ERROR"
        }
      };
    }
  },
  createProject: async (projectData: any) => {
    const response = await api.post('/projects', projectData);
    return response.data;
  },
  updateProject: async (id: string, projectData: any) => {
    const response = await api.put(`/projects/${id}`, projectData);
    return response.data;
  },
  updateMilestones: async (id: string, milestones: any[]) => {
    const response = await api.put(`/projects/${id}/milestones`, { milestones });
    return response.data;
  },
  getVerificationStatus: async (id: string) => {
    const response = await api.get(`/projects/${id}/verification`);
    return response.data;
  },
  verifyProject: async (id: string, verified: boolean, notes: string) => {
    const response = await api.put(`/projects/${id}/verify`, { 
      verified, 
      verification_notes: notes 
    });
    return response.data;
  },
  // Get projects pending verification vote for the current donor
  getProjectsToVote: async () => {
    const response = await api.get('/projects/to-vote');
    return response.data;
  },
  // Cast a vote on a project's verification
  voteProject: async (projectId: number, vote: boolean, comment?: string) => {
    const response = await api.post(`/projects/${projectId}/vote`, { vote, comment });
    return response.data;
  },
  // Fetch verification votes for a project
  getProjectVotes: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/votes`);
    return response.data;
  },
  aiEvaluateProject: async (id: string) => {
    const response = await api.post(`/projects/${id}/ai-evaluate`);
    return response.data;
  },
  getProjectById: async (id: string) => {
    try {
      const response = await api.get(`/projects/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching project details:', error);
      return {
        success: false,
        error: { message: 'Failed to fetch project details', code: 'FETCH_ERROR' }
      };
    }
  },
};

// Donations API
export const donationsApi = {
  makeDonation: async (
    projectId: string,
    amount: number,
    message?: string
  ) => {
    const response = await api.post('/donations', {
      project_id: projectId,
      amount,
      message,
    });
    return response.data;
  },
  getUserDonations: async () => {
    const response = await api.get('/donations/user');
    return response.data;
  },
  getProjectDonations: async (projectId: string, page = 1, limit = 10) => {
    try {
      console.log(`Fetching donations for project ${projectId}, page ${page}, limit ${limit}`);
      const response = await api.get(`/donations/by-project/${projectId}?page=${page}&limit=${limit}`);
      console.log('Project donations API response:', response.data);
      
      // Check if the response has the expected structure
      if (response.data.success && response.data.data && Array.isArray(response.data.data.donations)) {
        console.log(`Found ${response.data.data.donations.length} donations for project ${projectId}`);
        
        // Log the first donation for debugging
        if (response.data.data.donations.length > 0) {
          console.log('Sample donation data:', response.data.data.donations[0]);
        }
        
        return response.data;
      } else {
        console.warn('Unexpected API response format:', response.data);
        // Return a structured response even if the format is unexpected
        return {
          success: true,
          data: {
            donations: response.data.data?.donations || response.data.donations || [],
            total: response.data.data?.total || response.data.total || 0,
            page: response.data.data?.page || response.data.page || page,
            limit: response.data.data?.limit || response.data.limit || limit,
            total_raised: response.data.data?.total_raised || response.data.total_raised || 0
          }
        };
      }
    } catch (error) {
      console.error('Error fetching project donations:', error);
      // Return a structured error response
      return {
        success: false,
        data: {
          donations: [],
          total: 0,
          page: page,
          limit: limit,
          total_raised: 0
        },
        error: {
          message: 'Failed to fetch donations',
          code: 'FETCH_ERROR'
        }
      };
    }
  },
  getDonationStats: async () => {
    const response = await api.get('/donations/stats');
    return response.data;
  },
};

// Bank Accounts API
export const bankAccountsApi = {
  registerBankAccount: async (bankAccountData: any) => {
    const response = await api.post('/bank-accounts', bankAccountData);
    return response.data;
  },
  listBankAccounts: async () => {
    const response = await api.get('/bank-accounts');
    return response.data;
  },
  getProjectBankAccounts: async (projectId: string) => {
    const response = await api.get(`/bank-accounts/project/${projectId}`);
    return response.data;
  },
  verifyBankAccount: async (id: string, verified: boolean, notes?: string) => {
    const response = await api.put(`/bank-accounts/${id}/verify`, {
      verified,
      verification_notes: notes,
    });
    return response.data;
  },
};

// Proposals API
export const proposalsApi = {
  createProposal: async (proposalData: any) => {
    const response = await api.post('/proposals', proposalData);
    return response.data;
  },
  getProjectProposals: async (projectId: string) => {
    const response = await api.get(`/proposals/project/${projectId}`);
    return response.data;
  },
  getProposalStatus: async (id: string) => {
    const response = await api.get(`/proposals/${id}/status`);
    return response.data;
  },
  getProposalDetails: async (id: string) => {
    const response = await api.get(`/proposals/${id}`);
    return response.data;
  },
  verifyProposal: async (id: string) => {
    const response = await api.post(`/proposals/${id}/verify`);
    return response.data;
  },
  aiEvaluateProposal: async (id: string) => {
    const response = await api.post(`/proposals/${id}/ai-evaluate`);
    return response.data;
  },
  createProposalWithTransferType: async (data: {
    project_id: number;
    description: string;
    evidence_ipfs_hash: string;
    amount: number;
    bank_account_id?: number;
    crypto_address?: string;
    transfer_type: 'bank' | 'crypto';
    milestone_index?: number;
  }) => {
    try {
      // Prepare the payload based on transfer type
      const payload = {
        project_id: data.project_id,
        description: data.description,
        evidence_ipfs_hash: data.evidence_ipfs_hash,
        amount: data.amount,
        milestone_index: data.milestone_index,
        transfer_type: data.transfer_type,
        // Include relevant info based on transfer type
        ...(data.transfer_type === 'bank' ? { bank_account_id: data.bank_account_id } : {}),
        ...(data.transfer_type === 'crypto' ? { crypto_address: data.crypto_address } : {}),
      };

      const response = await api.post('/proposals/create', payload);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          message: error.message || 'An error occurred while creating the proposal'
        }
      };
    }
  },
  executeBlockchainTransfer: async (
    proposalId: number,
    projectId: number,
    amount: number,
    transferType: 'bank' | 'crypto',
    recipientAddress?: string
  ) => {
    try {
      // Make a direct call to the backend API to execute the transfer
      // The backend handles all blockchain interactions with ERC-4337 wallet
      const response = await api.post(`/proposals/${proposalId}/execute`, {
        project_id: projectId,
        amount: amount,
        transfer_type: transferType,
        recipient_address: recipientAddress
      });
      
      return {
        success: true,
        data: response.data.data,
        txHash: response.data.data?.transaction_hash
      };
    } catch (error: any) {
      console.error('Error executing blockchain transfer:', error);
      return {
        success: false,
        error: {
          message: error.response?.data?.error?.message || error.message || 'An error occurred during blockchain transaction'
        }
      };
    }
  },
  getAllProposals: async () => {
    try {
      const response = await api.get(`/proposals`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error("Error getting all proposals:", error);
      return {
        success: false,
        error: handleApiError(error)
      };
    }
  },
};

// Bank Transfers API
export const bankTransfersApi = {
  getTransferStatus: async (reference: string) => {
    const response = await api.get(`/bank-transfers/${reference}`);
    return response.data;
  },
  listProjectTransfers: async (projectId: string) => {
    const response = await api.get(`/bank-transfers/project/${projectId}`);
    return response.data;
  },
};

// Wallet API
export const walletApi = {
  getWalletBalance: async () => {
    try {
      const response = await api.get('/wallet/balance');
      return response.data;
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return {
        success: true,
        data: {
          wallet_address: null,
          balance: '0.00',
          currency: 'ETH',
          status: 'error'
        }
      };
    }
  },
  
  getWalletDataFromScrollScan: async (walletAddress: string, network: string = 'sepolia') => {
    try {
      console.log(`Fetching wallet data for: ${walletAddress} on network: ${network}`);
      const response = await api.get(`/wallet/scrollscan-data`, {
        params: { walletAddress, network }
      });
      
      console.log('ScrollScan API response:', response.data);
      
      if (response.data.success) {
        // Format transactions to ensure consistent structure
        if (response.data.data && response.data.data.transactions) {
          const formattedTransactions = response.data.data.transactions.map((tx: any) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            timestamp: tx.timestamp,
            // Ensure all required fields are present
            ...tx
          }));
          
          response.data.data.transactions = formattedTransactions;
          
          // Log the first transaction for debugging
          if (formattedTransactions.length > 0) {
            console.log('Sample transaction:', formattedTransactions[0]);
          }
        }
        
        return response.data;
      } else {
        console.error('Error fetching wallet data:', response.data);
        return {
          success: false,
          error: response.data.error || 'Failed to fetch wallet data'
        };
      }
    } catch (error) {
      console.error('Error in getWalletDataFromScrollScan:', error);
      return {
        success: false,
        error: 'Failed to fetch wallet data'
      };
    }
  },
  
  fundWallet: async (amount: number, currency: string, paymentMethod: string) => {
    const response = await api.post('/wallet/fund', {
      amount,
      currency,
      payment_method: paymentMethod
    });
    return response.data;
  },
  
  // Record Transak transaction
  recordTransakTransaction: async (transactionData: {
    orderId: string;
    amount: number;
    cryptoCurrency: string;
    fiatCurrency: string;
    status: string;
    transactionHash?: string;
  }) => {
    try {
      const response = await api.post('/wallet/transak-transaction', transactionData);
      return response.data;
    } catch (error) {
      console.error('Error recording Transak transaction:', error);
      return {
        success: false,
        error: 'Failed to record transaction'
      };
    }
  },
  
  getTransactions: async () => {
    try {
      console.log('Fetching transactions from API...');
      const response = await api.get('/wallet/transactions');
      console.log('Raw API response:', response);
      
      // Check if we have a successful response with data
      if (response.data && response.data.success) {
        console.log('API response indicates success');
        
        // If we have transaction data, return it
        if (response.data.data && Array.isArray(response.data.data)) {
          console.log(`Found ${response.data.data.length} transactions in response.data.data`);
          
          // Log the first transaction if available
          if (response.data.data.length > 0) {
            console.log('First transaction:', response.data.data[0]);
          }
          
          return {
            success: true,
            data: response.data.data,
            network: response.data.network,
            debug: response.data.debug
          };
        } else {
          console.warn('Response has success=true but data is not an array:', response.data.data);
        }
      } else {
        console.warn('Response does not have success=true:', response.data);
      }
      
      // If we don't have the expected data structure, log it and return empty array
      console.warn('Unexpected API response format:', response.data);
      return {
        success: true,
        data: [],
        network: null,
        debug: null
      };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  },
};

export const quadraticFundingApi = {
  // Get funding pool balance
  getPoolBalance: async () => {
    try {
      const response = await api.get('/quadratic/pool-balance');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get projects eligible for quadratic funding
  getProjects: async () => {
    try {
      const response = await api.get('/quadratic/projects');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Distribute quadratic funding (admin only)
  distributeQuadraticFunding: async (poolId: number, forceDistribution: boolean = false) => {
    try {
      // Send pool_id in the request body
      const response = await api.post('/quadratic/distribute', { 
        pool_id: poolId,
        force_distribution: forceDistribution
      });
      return response.data;
    } catch (error) {
      // Log the error for better debugging
      console.error('Error in distributeQuadraticFunding API call:', error);
      // Re-throw or return a structured error
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Failed to distribute funds',
          code: 'DISTRIBUTION_API_ERROR'
        }
      };
    }
  },

  // Record external contribution to funding pool (admin only)
  recordExternalContribution: async (contributionData: {
    transaction_hash: string;
    amount: string; // Keep as string, backend parses
    pool_id: number; // Changed from round_id
    contributor_address?: string;
    contributor_name?: string;
    // REMOVED: round_id
  }) => {
    try {
      // Ensure the payload matches the expected structure
      const response = await api.post('/quadratic/external-contribution', contributionData);
      return response.data;
    } catch (error) {
      // Log the error for better debugging
      console.error('Error in recordExternalContribution API call:', error);
       // Re-throw or return a structured error
       return { 
         success: false, 
         error: { 
           message: error instanceof Error ? error.message : 'Failed to record contribution',
           code: 'CONTRIBUTION_API_ERROR'
         }
       };
    }
  },

  // Get all funding pools
  getPools: async (page = 1, limit = 100, filters = {}) => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters,
      });
      const response = await api.get(`/pools?${queryParams}`);
      
      // Log the API response structure for debugging
      console.log('API response from getPools:', response.data);
      
      // Return the data as-is to allow components to handle the structure
      return response.data;
    } catch (error) {
      console.error('Error fetching pools:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch pools',
          code: 'FETCH_ERROR'
        },
        data: { pools: [] } // Provide empty pools array for consistency
      };
    }
  },

  // Get funding pool by ID
  getPool: async (id: string | number) => {
    try {
      const response = await api.get(`/pools/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create a new funding pool (admin/sponsor only)
  createPool: async (poolData: {
    name: string;
    description: string;
    theme: string;
    round_duration?: number;
  }) => {
    try {
      const response = await api.post('/pools', poolData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update a funding pool (admin/sponsor only)
  updatePool: async (id: string | number, poolData: {
    name?: string;
    description?: string;
    theme?: string;
    is_active?: boolean;
  }) => {
    try {
      const response = await api.put(`/pools/${id}`, poolData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get projects in a specific pool
  getPoolProjects: async (poolId: string | number) => {
    try {
      const response = await api.get(`/pools/${poolId}/projects`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Donate to a funding pool
  donateToPool: async (poolId: string | number, amount: number) => {
    try {
      const response = await api.post(`/pools/${poolId}/donate`, { amount });
      return response.data;
    } catch (error) {
      console.error('Error donating to pool:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to process donation'
        }
      };
    }
  },
  
  // Add a project to a pool
  addProjectToPool: async (poolId: string | number, projectId: string | number) => {
    try {
      const response = await api.post(`/pools/${poolId}/projects`, { project_id: projectId });
      return response.data;
    } catch (error) {
      console.error('Error adding project to pool:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to add project to pool'
        }
      };
    }
  },
  
  // Distribute funds for a specific pool
  distributePoolFunds: async (poolId: string | number, createNewRound: boolean = false) => {
    try {
      const response = await api.post(`/pools/${poolId}/distribute`, { create_new_round: createNewRound });
      return response.data;
    } catch (error) {
      console.error('Error distributing pool funds:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to distribute pool funds'
        }
      };
    }
  }
};

// Company API
export const companyApi = {
  // Get the current user's company
  getMyCompany: async () => {
    try {
      const response = await api.get('/companies/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching company data:', error);
      throw error;
    }
  },

  // Get company by ID
  getCompany: async (id: string | number) => {
    try {
      const response = await api.get(`/companies/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching company ${id}:`, error);
      throw error;
    }
  },

  // Create a new company
  createCompany: async (companyData: {
    name: string;
    description?: string;
    website?: string;
    logo_url?: string;
  }) => {
    try {
      const response = await api.post('/companies', companyData);
      return response.data;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  },

  // Update company
  updateCompany: async (companyData: {
    name?: string;
    description?: string;
    website?: string;
    logo_url?: string;
  }) => {
    try {
      const response = await api.put('/companies/me', companyData);
      return response.data;
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }
};

// User role checking API
export const userRoleApi = {
  // Check if user is a corporate user
  checkCorporateRole: async () => {
    try {
      // Check if the user has an associated company
      const response = await api.get('/companies/me');
      
      console.log('Company check response:', response.data);
      
      // If the user has a company, they are a corporate user
      if (response.data.success && response.data.data) {
        return {
          success: true,
          data: {
            isCorporate: true,
            companyDetails: response.data.data
          }
        };
      }
      
      return {
        success: true,
        data: {
          isCorporate: false
        }
      };
    } catch (error) {
      console.error('Error checking corporate role:', error);
      
      // If we get a 404, it means the user doesn't have a company
      if (error.response && error.response.status === 404) {
        return {
          success: true,
          data: {
            isCorporate: false
          }
        };
      }
      
      return {
        success: false,
        error: 'Failed to check corporate role'
      };
    }
  }
};

// Default export for backward compatibility
export default projectsApi; 