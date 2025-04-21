const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Load environment variables
require('dotenv').config();

// Check environment
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  logger.info('Running in PRODUCTION mode');
} else {
  logger.info('Running in DEVELOPMENT mode');
}

// Parse chain ID from environment
const chainId = parseInt(process.env.CHAIN_ID || '534351', 10);
logger.info(`Using Chain ID: ${chainId}`);

// Load ABIs
const loadAbi = (name) => {
  try {
    const abiPath = path.join(__dirname, '../../../blockchain/abi', `${name}.json`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  } catch (error) {
    logger.error(`Failed to load ABI for ${name}:`, error.message);
    throw error;
  }
};

// Create ethers provider with better error handling
let provider;
try {
  // Get RPC URLs from environment (can be comma-separated)
  const envRpcUrls = process.env.SCROLL_RPC_URL 
    ? process.env.SCROLL_RPC_URL.split(',').map(url => url.trim()).filter(url => url !== '')
    : [];
  
  // Default fallback RPC URLs in case environment URLs fail
  const fallbackRpcUrls = [
    'https://sepolia-rpc.scroll.io/',
    'https://scroll-sepolia-rpc.publicnode.com',
    'https://1rpc.io/scroll/sepolia'
  ];
  
  // Combine environment URLs with fallbacks, prioritizing environment URLs
  const allRpcUrls = [...new Set([...envRpcUrls, ...fallbackRpcUrls])];
  
  if (allRpcUrls.length === 0) {
    throw new Error('No RPC URLs available');
  }
  
  // Log which RPC we're trying first
  logger.info(`Attempting connection to primary RPC URL: ${allRpcUrls[0]}`);
  
  // Create provider with the first URL - ethers v6 format
  provider = new ethers.JsonRpcProvider(allRpcUrls[0], chainId);
  
  // Set polling interval
  provider.pollingInterval = 5000;
  
  // Try to connect and set up fallback mechanism
  provider.getNetwork().then(network => {
    logger.info(`Connected to network: ${network.name} (${network.chainId})`);
  }).catch(async error => {
    logger.warn(`Primary RPC connection failed: ${error.message}`);
    
    // Try alternate URLs
    for (let i = 1; i < allRpcUrls.length; i++) {
      try {
        logger.info(`Trying alternate RPC URL: ${allRpcUrls[i]}`);
        
        // Create alternate provider with current URL
        const altProvider = new ethers.JsonRpcProvider(allRpcUrls[i], chainId);
        altProvider.pollingInterval = 5000;
        
        // Test the connection
        const network = await altProvider.getNetwork();
        
        // If we get here, connection successful
        logger.info(`Successfully connected to alternate RPC: ${allRpcUrls[i]} network ${network.name}`);
        provider = altProvider; // Replace the provider with the working one
        break;
      } catch (altError) {
        logger.warn(`Alternate RPC connection failed: ${altError.message}`);
      }
    }
    
    logger.info('Application will continue with limited blockchain functionality');
  });
} catch (error) {
  logger.error('Failed to initialize blockchain provider:', error);
  // Create a mock provider that fails gracefully
  provider = new Proxy({}, {
    get: function(target, prop) {
      if (prop === 'getNetwork' || prop === 'getBalance') {
        return async function() {
          throw new Error('Blockchain provider not initialized');
        };
      }
      return function() {
        throw new Error('Blockchain provider not initialized');
      };
    }
  });
}

// Create contract instances with error handling
const createContract = (address, abi) => {
  try {
    if (!address) {
      logger.warn(`Contract address not provided, returning mock contract`);
      return createMockContract();
    }
    return new ethers.Contract(address, abi, provider);
  } catch (error) {
    logger.error(`Failed to create contract: ${error.message}`);
    return createMockContract();
  }
};

// Create a mock contract that fails gracefully
const createMockContract = () => {
  return new Proxy({}, {
    get: function(target, prop) {
      if (prop === 'connect') {
        return function() { return createMockContract(); };
      }
      return async function() {
        throw new Error('Contract not initialized');
      };
    }
  });
};

// Admin wallet for transactions that require signing
const getAdminWallet = () => {
  try {
    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('Admin private key not found in environment variables');
    }

    // Check if the private key is a valid format
    return new ethers.Wallet(privateKey, provider);
  } catch (error) {
    logger.error('Failed to initialize admin wallet:', error.message);
    throw new Error('Failed to initialize admin wallet');
  }
};

// Derive the admin wallet address from the private key for fallback use
const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
const ADMIN_WALLET_ADDRESS = adminWallet.address;

// Load contract ABIs
let platformAbi, quadraticFundingAbi, baseContractAbi;
try {
  platformAbi = loadAbi('Platform');
  
  // If ABI loading fails, use fallback minimal ABI
  if (!platformAbi || platformAbi.length === 0) {
    logger.warn('Using fallback Platform ABI');
    platformAbi = [
      'function getUserAccount(string memory hashedEmail) external view returns (address)',
      'function createProject(uint256 charityId, uint256 poolId, string memory name, string memory description, string memory ipfsHash) external returns (uint256)',
      'function distributeQuadraticFunding(uint256 poolId) external returns (uint256[] memory)',
      'function createPool(string calldata name, string calldata description, address sponsor, uint256 duration) external returns (uint256)',
      'function endPoolEarly(uint256 poolId) external',
      'function getPoolCount() external view returns (uint256)',
      'function getPoolInfo(uint256 poolId) external view returns (string memory name, string memory description, address sponsor, uint256 startTime, uint256 endTime, uint256 totalFunds, bool distributed)',
      'function getProjectAllocations(uint256 poolId, uint256[] calldata projectIds) external view returns (uint256[] memory)',
      'function getProjectsInPool(uint256 poolId) external view returns (uint256[] memory)',
      'function owner() external view returns (address)'
    ];
  }
  
  quadraticFundingAbi = loadAbi('QuadraticFunding');
  
  // If QuadraticFunding ABI loading fails, use fallback minimal ABI
  if (!quadraticFundingAbi || quadraticFundingAbi.length === 0) {
    logger.warn('Using fallback QuadraticFunding ABI');
    quadraticFundingAbi = [
      'function createPool(string calldata name, string calldata description, address sponsor, uint256 duration) external returns (uint256)',
      'function donateToPool(uint256 poolId) external payable',
      'function recordDonation(address donor, uint256 projectId, uint256 poolId, uint256 amount) external',
      'function distributeQuadraticFunding(uint256 poolId, uint256[] calldata projectIds, address payable[] calldata destinations) external returns (uint256[] memory)',
      'function getPoolInfo(uint256 poolId) external view returns (string memory name, string memory description, address sponsor, uint256 startTime, uint256 endTime, uint256 totalFunds, bool distributed)',
      'function getPoolCount() external view returns (uint256)',
      'function endPoolEarly(uint256 poolId) external',
      'function getProjectAllocation(uint256 poolId, uint256 projectId) external view returns (uint256)',
      'function getPoolAllocations(uint256 poolId, uint256[] calldata projectIds) external view returns (uint256[] memory)'
    ];
  }
  
  baseContractAbi = loadAbi('BaseContract');
} catch (error) {
  logger.error('Failed to load contract ABIs:', error);
  // Create empty ABIs as fallback
  platformAbi = [
    'function getUserAccount(string memory hashedEmail) external view returns (address)',
    'function createProject(uint256 charityId, uint256 poolId, string memory name, string memory description, string memory ipfsHash) external returns (uint256)',
    'function distributeQuadraticFunding(uint256 poolId) external returns (uint256[] memory)',
    'function createPool(string calldata name, string calldata description, address sponsor, uint256 duration) external returns (uint256)',
    'function endPoolEarly(uint256 poolId) external',
    'function getPoolCount() external view returns (uint256)',
    'function getPoolInfo(uint256 poolId) external view returns (string memory name, string memory description, address sponsor, uint256 startTime, uint256 endTime, uint256 totalFunds, bool distributed)',
    'function getProjectAllocations(uint256 poolId, uint256[] calldata projectIds) external view returns (uint256[] memory)',
    'function getProjectsInPool(uint256 poolId) external view returns (uint256[] memory)',
    'function owner() external view returns (address)'
  ];
  
  quadraticFundingAbi = [
    'function createPool(string calldata name, string calldata description, address sponsor, uint256 duration) external returns (uint256)',
    'function donateToPool(uint256 poolId) external payable',
    'function recordDonation(address donor, uint256 projectId, uint256 poolId, uint256 amount) external',
    'function distributeQuadraticFunding(uint256 poolId, uint256[] calldata projectIds, address payable[] calldata destinations) external returns (uint256[] memory)',
    'function getPoolInfo(uint256 poolId) external view returns (string memory name, string memory description, address sponsor, uint256 startTime, uint256 endTime, uint256 totalFunds, bool distributed)',
    'function getPoolCount() external view returns (uint256)',
    'function endPoolEarly(uint256 poolId) external',
    'function getProjectAllocation(uint256 poolId, uint256 projectId) external view returns (uint256)',
    'function getPoolAllocations(uint256 poolId, uint256[] calldata projectIds) external view returns (uint256[] memory)'
  ];
  
  baseContractAbi = [];
}

// Create contract instances
const entryPointContract = createContract(
  process.env.ENTRY_POINT_ADDRESS,
  baseContractAbi
);

const accountFactoryContract = createContract(
  process.env.ACCOUNT_FACTORY_ADDRESS,
  baseContractAbi
);

const paymasterContract = createContract(
  process.env.PAYMASTER_ADDRESS,
  baseContractAbi
);

const platformContract = createContract(
  process.env.PLATFORM_ADDRESS,
  platformAbi
);

const fundingPoolContract = createContract(
  process.env.FUNDING_POOL_ADDRESS,
  quadraticFundingAbi
);

// Validate essential contracts are properly configured
if (!process.env.FUNDING_POOL_ADDRESS || process.env.FUNDING_POOL_ADDRESS === '0x0000000000000000000000000000000000000000') {
  logger.error('FUNDING_POOL_ADDRESS is not properly configured in .env file!');
} else {
  logger.info(`Funding Pool contract configured at: ${process.env.FUNDING_POOL_ADDRESS}`);
}

if (!process.env.PLATFORM_ADDRESS || process.env.PLATFORM_ADDRESS === '0x0000000000000000000000000000000000000000') {
  logger.error('PLATFORM_ADDRESS is not properly configured in .env file!');
} else {
  logger.info(`Platform contract configured at: ${process.env.PLATFORM_ADDRESS}`);
}

const projectWalletImplementation = process.env.PROJECT_WALLET_ADDRESS;

// Function to get a signed instance of a contract
const getSignedContract = (contract) => {
  try {
    const wallet = getAdminWallet();
    return contract.connect(wallet);
  } catch (error) {
    logger.error('Failed to get signed contract:', error.message);
    return createMockContract();
  }
};

// Function to get a user-specific signer with a provided private key
const getUserSigner = (privateKey) => {
  try {
    if (!privateKey) {
      throw new Error('Private key not provided');
    }
    
    // Create a wallet with the provided private key
    return new ethers.Wallet(privateKey, provider);
  } catch (error) {
    logger.error('Failed to create user signer:', error.message);
    throw new Error('Failed to create user signer');
  }
};

// Export the configuration
module.exports = {
  provider,
  getAdminWallet,
  getUserSigner,
  entryPointContract,
  accountFactoryContract,
  paymasterContract,
  platformContract,
  fundingPoolContract,
  projectWalletImplementation,
  getSignedContract,
  createContract,
  isProduction,
  chainId,
  ADMIN_WALLET_ADDRESS
}; 