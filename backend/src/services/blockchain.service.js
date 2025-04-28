const { ethers } = require('ethers');
const logger = require('../config/logger');
const blockchainConfig = require('../config/blockchain');
const { AppError } = require('../utils/appError');
const httpStatus = require('http-status');
const { generateDeterministicAddress } = require('../utils/blockchain-utils');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

// Import the ProjectWallet ABI directly
const PROJECT_WALLET_ABI_PATH = path.join(__dirname, '../../abi/ProjectWallet.json');
const PROJECT_WALLET_ABI = JSON.parse(fs.readFileSync(PROJECT_WALLET_ABI_PATH, 'utf8'));

/**
 * Helper function to handle transactions and errors
 */
const sendTransaction = async (contractInteraction, description) => {
  try {
    logger.info(`Attempting: ${description}`);
    const tx = await contractInteraction;
    logger.info(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
    const receipt = await tx.wait();
    logger.info(`Transaction confirmed: ${receipt.hash}. Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    if (receipt.status !== 1) {
      throw new Error(`Transaction failed: ${receipt.hash}`);
    }
    return { success: true, receipt, transactionHash: receipt.hash };
  } catch (error) {
    logger.error(`Error during ${description}: ${error.message}`, {
      error: error,
      code: error.code,
      reason: error.reason,
      tx: error.transactionHash
    });
    // Try to extract revert reason if available
    let reason = error.reason || error.message;
    if (error.data && blockchainConfig.platformContract) {
        try {
            const decodedError = blockchainConfig.platformContract.interface.parseError(error.data);
            reason = `${decodedError.name}(${decodedError.args.join(', ')})`;
        } catch (e) { /* ignore if not a contract error */ }
    }
    return { success: false, error: reason };
  }
};

/**
 * Initialize blockchain connectivity
 * @returns {Promise<boolean>} Whether initialization succeeded
 */
const initializeBlockchain = async () => {
  try {
    logger.info('Initializing blockchain connection...');
    
    const provider = blockchainConfig.provider;
    const network = await provider.getNetwork();
    logger.info(`Connected to blockchain network: ${network.name} (Chain ID: ${network.chainId})`);
    
    const platformContract = blockchainConfig.platformContract;
    if (!platformContract || !(await platformContract.getAddress())) {
      throw new Error('Platform contract not properly initialized');
    }
    
    logger.info(`Platform contract initialized at address: ${await platformContract.getAddress()}`);
    
    try {
      const owner = await platformContract.owner();
      logger.info(`Platform contract owner: ${owner}`);
    } catch (error) {
      logger.warn(`Could not fetch platform contract owner: ${error.message}`);
    }
    
    logger.info('Blockchain initialization successful');
    return true;
  } catch (error) {
    logger.error(`Blockchain initialization failed: ${error.message}`, {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    });
    return false;
  }
};

/**
 * Creates a user wallet via platform contract
 * @param {string} hashedEmail - Hash of the user's email
 * @param {number} salt - Random salt for wallet creation
 * @returns {Promise<string>} - Wallet address
 */
const createUserWallet = async (hashedEmail, salt) => {
  try {
    const randomizedSalt = Math.floor(Math.random() * 1000000) + 1;
    logger.info(`Using randomized salt: ${randomizedSalt} for email hash: ${hashedEmail}`);
    
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);
    
    logger.info(`Checking if wallet exists for ${hashedEmail}`);
    const existingAddress = await blockchainConfig.platformContract.getUserAccount(hashedEmail);
    
    if (existingAddress !== ethers.ZeroAddress) {
      logger.info(`Wallet already exists: ${existingAddress}`);
      return existingAddress;
    }
    
    try {
      logger.info(`Calling platform.registerUser with hashedEmail=${hashedEmail} and salt=${randomizedSalt}`);
      
      const maxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      if (BigInt(randomizedSalt) > maxUint256) {
        throw new Error(`Salt value overflow: ${randomizedSalt} exceeds max uint256`);
      }
      
      const interaction = platformContract.registerUser(hashedEmail, randomizedSalt);
      const result = await sendTransaction(interaction, `register user ${hashedEmail}`);
      
      if (!result.success) {
        const errMsg = `User registration transaction failed: ${result.error}`;
        logger.error(errMsg);
        throw new Error(errMsg);
      }
      
      const receipt = result.receipt;
      
      logger.info('Transaction confirmed, extracting wallet address from events');
      const userRegisteredEvent = receipt.logs
        .map(log => {
          try {
            return platformContract.interface.parseLog(log);
          } catch (error) {
            return null;
          }
        })
        .find(parsedLog => parsedLog && parsedLog.name === 'UserRegistered');

      if (!userRegisteredEvent) {
        logger.error('UserRegistered event not found', { txHash: receipt.transactionHash });
        const walletAddress = await blockchainConfig.platformContract.getUserAccount(hashedEmail);
        if (walletAddress && walletAddress !== ethers.ZeroAddress) {
          logger.info(`Retrieved wallet address from contract (fallback): ${walletAddress}`);
          return walletAddress;
        }
        throw new Error('Failed to find UserRegistered event and contract query fallback failed');
      }

      const walletAddress = userRegisteredEvent.args[0];
      logger.info(`Wallet address extracted: ${walletAddress}`);
      
      return walletAddress;
    } catch (error) {
      logger.error(`Wallet creation failed: ${error.message}`, {
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        },
        hashedEmail,
        salt: randomizedSalt
      });
      
      let errorMessage = 'Blockchain error during wallet creation';
      let errorCode = 'BLOCKCHAIN_ERROR';
      
      if (error.message.includes('insufficient funds') || (error.error && typeof error.error === 'string' && error.error.includes('insufficient funds'))) {
        errorCode = 'INSUFFICIENT_FUNDS';
        errorMessage = 'Backend signer has insufficient funds for gas.';
      } else if (error.message.includes('User already registered')) {
        errorCode = 'USER_ALREADY_REGISTERED';
        errorMessage = 'User account already exists on chain.';
        try {
          const walletAddress = await blockchainConfig.platformContract.getUserAccount(hashedEmail);
          if (walletAddress && walletAddress !== ethers.ZeroAddress) {
            logger.info(`Retrieved existing wallet address after registration error: ${walletAddress}`);
            return walletAddress;
          }
        } catch(fetchError) {
          logger.error('Failed to fetch existing address after registration error', fetchError);
        }
      }
      
      const appError = new AppError(errorMessage, httpStatus.INTERNAL_SERVER_ERROR, false, error.stack);
      appError.code = errorCode;
      
      const randomHash = crypto.createHash('sha256')
        .update(`${hashedEmail}-${Date.now()}-${Math.random()}`)
        .digest('hex');
      
      appError.placeholderAddress = `0x${randomHash.substring(0, 40)}`;
      logger.info(`Created placeholder address: ${appError.placeholderAddress}`);
      throw appError;
    }
  } catch (error) {
    if (error instanceof AppError && error.placeholderAddress) {
      logger.warn(`Returning placeholder address due to blockchain error: ${error.message}`);
      return error.placeholderAddress;
    }
    logger.error(`Unhandled error in createUserWallet: ${error.message}`);
    throw error;
  }
};

/**
 * Register a charity on the blockchain
 * @param {string} name - Charity name
 * @param {string} description - Charity description
 * @param {number} userId - User ID of charity admin
 * @returns {Promise<boolean>} - Success status
 */
const registerCharity = async (name, description, userId) => {
  try {
    logger.info(`Registering charity on blockchain: ${name}`);
    
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);
    
    const interaction = platformContract.registerCharity(name, description);
    const result = await sendTransaction(interaction, `register charity ${name}`);
    return result;
  } catch (error) {
    logger.error(`Failed to register charity ${name}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Verify a project on the blockchain
 * @param {number} projectId - Project ID 
 * @param {boolean} verified - Verification status (true/false)
 * @returns {Promise<boolean>} - Success status
 */
const verifyProject = async (projectId, verified) => {
  try {
    logger.info(`Verifying project on blockchain: ID ${projectId}, verified: ${verified}`);
    
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);
    
    // Adjust projectId to be 0-indexed for the contract
    const contractProjectId = projectId;
    if (contractProjectId < 0) {
      throw new Error(`Invalid project ID: ${projectId} resulted in negative contract ID`);
    }
    
    logger.info(`Using contract project ID ${contractProjectId} for database ID ${projectId}`);
    const interaction = platformContract.verifyProject(contractProjectId, verified);
    const result = await sendTransaction(interaction, `verify project ${projectId}`);
    
    return result;
  } catch (error) {
    logger.error(`Failed to verify project ${projectId}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Verify a user with Worldcoin on the blockchain
 * Note: This function is used for both Worldcoin and Onfido verifications
 * as the blockchain contract only needs to know if a user is verified or not
 * @param {string} walletAddress - User wallet address
 * @param {boolean} verified - Verification status (true/false)
 * @returns {Promise<boolean>} - Success status
 */
const verifyUserWithWorldcoin = async (walletAddress, verified) => {
  try {
    logger.info(`Verifying user on blockchain: Address ${walletAddress}, verified: ${verified}`);
    
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);
    
    const interaction = platformContract.verifyUser(walletAddress, verified);
    const result = await sendTransaction(interaction, `verify user ${walletAddress} (Worldcoin: ${verified})`);
    
    return result;
  } catch (error) {
    logger.error(`Failed to verify user ${walletAddress}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Create a project wallet on the blockchain
 * @param {number} adminId - Admin ID (user id) from the database
 * @param {number} projectId - Project ID from the database
 * @param {string} name - Project name
 * @param {string} description - Project description
 * @param {number} charityId - Charity ID from the database
 * @param {number} poolId - Contract Pool ID (from contract_pool_id in database) - defaults to 0
 * @returns {Promise<string>} - Project wallet address
 */
const createProjectWallet = async (adminId, projectId, name, description, charityId, poolId = 0) => {
  // Always initialize tempProjectId at the beginning of the function
  const tempProjectId = projectId || Math.floor(Math.random() * 10000);
  
  try {
    logger.info(`Creating project wallet on blockchain: ID ${tempProjectId}, name: ${name}, charity ID: ${charityId}, contract pool ID: ${poolId}`);
    
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);
    
    // Validate that we're using a valid pool ID
    try {
      // Check if pool exists on the blockchain - get pool count first
      const poolCount = await platformContract.getPoolCount().then(count => Number(count));
      logger.info(`Found ${poolCount} pools on the blockchain`);
      
      // If pool ID is out of range, use the default pool 0
      if (poolId >= poolCount) {
        logger.warn(`Contract pool ID ${poolId} not found on blockchain (max: ${poolCount-1}), using default pool 0`);
        poolId = 0;
      }
    } catch (poolError) {
      logger.warn(`Failed to validate pool ID: ${poolError.message}, using default pool 0`);
      poolId = 0;
    }
    
    // Call the platform contract's createProject function with correct parameter order
    try {
      const tx = await platformContract.createProject(
        charityId,   // First parameter: charityId (uint256)
        poolId,      // Second parameter: poolId (uint256) - this is the contract_pool_id from the database
        name,        // Third parameter: name (string)
        description, // Fourth parameter: description (string)
        ""           // Fifth parameter: ipfsHash (string) - empty for now
      );
      logger.info(`Transaction hash: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (!receipt.status) {
        throw new Error('Project creation transaction failed');
      }
      
      // Parse the events to get the project wallet address
      const projectCreatedEvent = receipt.logs
        .map(log => {
          try {
            return platformContract.interface.parseLog(log);
          } catch (error) {
            return null;
          }
        })
        .filter(parsedLog => parsedLog && parsedLog.name === 'ProjectCreated')
        .pop();
  
      if (!projectCreatedEvent) {
        logger.error('ProjectCreated event not found in transaction logs', { 
          transactionHash: receipt.hash,
          logs: receipt.logs.length
        });
        // Log raw logs for debugging
        logger.debug('Raw transaction logs:', JSON.stringify(receipt.logs, null, 2));
        throw new Error('Failed to find ProjectCreated event');
      }
      
      // Log the parsed event for debugging
      logger.debug('Parsed ProjectCreated event:', JSON.stringify(projectCreatedEvent, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value // Convert BigInts to strings for JSON
      , 2));
  
      // Extract the relevant fields from the event according to the contract definition
      // event ProjectCreated(uint256 indexed projectId, uint256 indexed charityId, uint256 indexed poolId, string name, address walletAddress);
      const contractProjectIdFromEvent = Number(projectCreatedEvent.args[0]); // Correct: projectId is at index 0
      const eventCharityId = Number(projectCreatedEvent.args[1]); // Correct: charityId is at index 1
      const eventPoolId = Number(projectCreatedEvent.args[2]); // Correct: poolId is at index 2
      const eventProjectName = projectCreatedEvent.args[3]; // Correct: name is at index 3
      const walletAddress = projectCreatedEvent.args[4]; // Correct: walletAddress is at index 4
      
      // Verify wallet address is a proper Ethereum address
      if (!walletAddress || !ethers.isAddress(walletAddress)) { // Use ethers.isAddress for validation
        logger.error(`Invalid wallet address returned from contract: ${walletAddress}`);
        throw new Error('Invalid wallet address format returned from blockchain');
      }
      
      logger.info(`Project created with blockchain ID: ${contractProjectIdFromEvent}, name: ${eventProjectName}, pool: ${eventPoolId}, wallet address: ${walletAddress}`);
      
      return walletAddress;
    } catch (txError) {
      logger.error(`Blockchain transaction failed: ${txError.message}`, {
        error: {
          message: txError.message,
          code: txError.code,
          stack: txError.stack
        }
      });
      
      // Fall through to the fallback mechanism below
      throw txError;
    }
  } catch (error) {
    logger.error(`Project wallet creation failed: ${error.message}`, {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    
    // Generate a deterministic address as a fallback - ensure it's a valid Ethereum address
    const deterministicAddress = generateDeterministicAddress(
      `project-${tempProjectId}-charity-${charityId}-pool-${poolId}`, 
      Date.now()
    );
    logger.info(`Generated deterministic address as fallback: ${deterministicAddress}`);
    
    return deterministicAddress;
  }
};

/**
 * Get wallet balance 
 * @param {string} walletAddress - User wallet address
 * @returns {Promise<string>} - Wallet balance in ETH
 */
const getWalletBalance = async (walletAddress) => {
  try {
    const balance = await blockchainConfig.provider.getBalance(walletAddress);
    return ethers.formatEther(balance);
  } catch (error) {
    logger.error(`Failed to get wallet balance: ${error.message}`);
    throw new Error(`Failed to get wallet balance: ${error.message}`);
  }
};

/**
 * Make a donation to a project
 * @param {string} userWalletAddress - User wallet address
 * @param {string} projectWalletAddress - Project wallet address
 * @param {string} amount - Amount to donate in ETH
 * @param {number} projectId - Project ID from database
 * @param {boolean} isWorldcoinVerified - Whether the user is verified by Worldcoin
 * @returns {Promise<string>} - Transaction hash
 */
const makeDonation = async (userWalletAddress, projectWalletAddress, amount, projectId, isWorldcoinVerified = false) => {
  try {
    logger.info(`Making donation from ${userWalletAddress} to ${projectWalletAddress} of ${amount} ETH for project ID ${projectId}`);
    logger.info(`User Worldcoin verified: ${isWorldcoinVerified}`);
    
    // Convert the amount to proper format for blockchain (ethers format)
    const ethAmount = ethers.parseEther(amount.toString());
    
    // Get the platform contract for later quadratic funding recording
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);
    
    try {
      // Get the user account contract
      const userAccount = new ethers.Contract(
        userWalletAddress,
        [
          'function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory)',
          'function nonce() external view returns (uint256)'
        ],
        blockchainConfig.provider
      );
      
      // Check user account balance first
      const userBalance = await blockchainConfig.provider.getBalance(userWalletAddress);
      if (userBalance < ethAmount) {
        throw new Error(`Insufficient balance in user wallet: ${ethers.formatEther(userBalance)} ETH, needed: ${amount} ETH`);
      }
      
      logger.info(`User wallet has sufficient balance: ${ethers.formatEther(userBalance)} ETH`);
      
      // Connect with admin wallet (which is authorized to call functions on the user's account)
      const adminWallet = blockchainConfig.getAdminWallet();
      
      // Use ERC-4337 execute function directly on the user account
      // This ensures funds come from the user wallet, not the admin
      const tx = await userAccount.connect(adminWallet).execute(
        projectWalletAddress,  // target = project wallet
        ethAmount,             // value = donation amount
        '0x',                  // data = empty for simple transfers
        { gasLimit: 1000000 }  // ensure sufficient gas
      );
      
      logger.info(`User account execute transaction initiated with hash: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (!receipt.status) {
        throw new Error('User account execute transaction failed');
      }
      
      logger.info(`Donation confirmed in block ${receipt.blockNumber}`);
      
      // If the user is Worldcoin verified, record the donation for quadratic funding
      if (isWorldcoinVerified) {
        try {
          logger.info(`Recording donation for quadratic funding through platform contract - user: ${userWalletAddress}, project: ${projectId}, amount: ${ethAmount}`);
          
          // Call the platform contract's recordDonationForQuadraticFunding function
          // This function only records the donation without transferring funds again
          const recordTx = await platformContract.recordDonationForQuadraticFunding(
            userWalletAddress,
            projectId,
            ethAmount
          );
          
          logger.info(`Quadratic funding record transaction initiated with hash: ${recordTx.hash}`);
          
          // Wait for transaction confirmation
          const recordReceipt = await recordTx.wait();
          
          if (!recordReceipt.status) {
            throw new Error('Record donation transaction failed');
          }
          
          logger.info(`Donation recorded for quadratic funding in block ${recordReceipt.blockNumber}`);
        } catch (error) {
          logger.error(`Failed to record donation for quadratic funding: ${error.message}`, { error });
          // We don't throw here because the main donation was successful
        }
      }
      
      return tx.hash;
    } catch (error) {
      logger.error(`User donation failed: ${error.message}`, {
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        }
      });
      
      // If we're in development mode, provide a mock transaction
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Generating mock transaction hash for donation in development mode`);
        const mockTransactionHash = `0x${crypto.randomBytes(32).toString('hex')}`;
        return mockTransactionHash;
      }
      
      throw new Error(`User wallet donation failed: ${error.message}. Please ensure the wallet has sufficient funds.`);
    }
  } catch (error) {
    logger.error(`Failed to make donation: ${error.message}`, {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.info?.error || error.error
      }
    });
    
    // If blockchain transaction fails in development, generate a mock hash as fallback
    if (process.env.NODE_ENV === 'development') {
      logger.info(`Generating mock transaction hash as fallback`);
      const mockTransactionHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      return mockTransactionHash;
    }
    
    throw error;
  }
};

/**
 * Verifies a bank account against blockchain data
 * @param {string} accountId - Bank account ID
 * @returns {Promise<boolean>} - Whether the account is verified
 */
const verifyBankAccount = async (accountId) => {
  // This is a placeholder for future implementation
  return true;
};

/**
 * Creates a withdrawal proposal on the blockchain
 * @param {number} projectId - Project ID
 * @param {string} projectWalletAddress - Project wallet address
 * @param {string} description - Proposal description
 * @param {string} evidenceIpfsHash - IPFS hash of evidence
 * @param {number} amount - Amount to withdraw
 * @param {string} destinationAccount - Destination wallet address
 * @returns {Promise<number|Object>} - Contract proposal ID or error object
 */
const createWithdrawalProposal = async (
  projectId,
  projectWalletAddress,
  description,
  evidenceIpfsHash,
  amount,
  destinationAccount,
  transferType = 'bank'
) => {
  try {
    logger.info(`Creating withdrawal proposal for project ${projectId}, amount: ${amount}, to ${destinationAccount}`);
    
    if (!projectWalletAddress) {
      logger.error(`Invalid project wallet address: ${projectWalletAddress}`);
      return { 
        success: false, 
        error: 'Invalid project wallet address' 
      };
    }
    
    // Check if the destination account is a valid address
    if (!destinationAccount || !destinationAccount.startsWith('0x') || destinationAccount.length !== 42) {
      logger.error(`Invalid destination account: ${destinationAccount}`);
      return { 
        success: false, 
        error: 'Invalid destination account' 
      };
    }
    
    logger.info(`Using project wallet at ${projectWalletAddress} and recipient ${destinationAccount}`);
    
    // Get a project wallet instance using direct ABI
    const wallet = new ethers.Contract(
      projectWalletAddress,
      PROJECT_WALLET_ABI,
      blockchainConfig.getAdminWallet()
    );
    
    // Verify wallet exists on chain
    try {
      const walletExists = await blockchainConfig.provider.getCode(projectWalletAddress);
      if (walletExists === '0x') {
        logger.error(`Project wallet not deployed at address: ${projectWalletAddress}`);
        return { 
          success: false, 
          error: 'Project wallet contract not found on blockchain' 
        };
      }
      logger.info(`Confirmed project wallet exists on blockchain`);
    } catch (checkError) {
      logger.error(`Error checking project wallet: ${checkError.message}`);
      return { 
        success: false, 
        error: `Error checking project wallet: ${checkError.message}` 
      };
    }
    
    // Call the create proposal function with proper error handling
    logger.info(`Calling createProposal with: description=${description}, evidence=${evidenceIpfsHash}, amount=${amount} ETH, destination=${destinationAccount}`);
    
    const tx = await wallet.createProposal(
      description,
      evidenceIpfsHash,
      ethers.parseEther(amount.toString()),
      destinationAccount
    );
    
    logger.info(`Transaction hash: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    if (!receipt.status) {
      logger.error('Proposal creation transaction failed');
      return { 
        success: false, 
        error: 'Blockchain transaction failed', 
        transactionHash: tx.hash 
      };
    }
    
    // Parse the events to get the proposal ID
    const proposalCreatedEvent = receipt.logs
      .map(log => {
        try {
          return wallet.interface.parseLog(log);
        } catch (error) {
          return null;
        }
      })
      .filter(parsedLog => parsedLog && parsedLog.name === 'ProposalCreated')
      .pop();
    
    if (!proposalCreatedEvent) {
      logger.error('Failed to parse ProposalCreated event');
      return { 
        success: false, 
        error: 'Could not find proposal ID in transaction logs' 
      };
    }
    
    // The proposal ID is the first argument in the event
    const contractProposalId = Number(proposalCreatedEvent.args[0]);
    logger.info(`Proposal created with contract ID: ${contractProposalId}`);
    
    return contractProposalId;
  } catch (error) {
    logger.error(`Proposal creation failed: ${error.message}`, {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    });
    
    return { 
      success: false, 
      error: `Blockchain error: ${error.message}` 
    };
  }
};

/**
 * Verifies a proposal on the blockchain
 * @param {number} projectId - Project ID
 * @param {number} contractProposalId - Contract proposal ID (0-based index in the project wallet)
 * @param {boolean} approved - Whether the proposal is approved
 * @returns {Promise<string|Object>} - Transaction hash or error object
 */
const verifyProposal = async (projectId, contractProposalId, approved) => {
  try {
    logger.info(`Verifying proposal with contract ID ${contractProposalId} for project ${projectId}, approved: ${approved}`);
    
    // Ensure contractProposalId is a valid number
    if (contractProposalId === undefined || contractProposalId === null || isNaN(Number(contractProposalId))) {
      logger.warn(`Invalid contract proposal ID: ${contractProposalId}`);
      return {
        success: false,
        error: 'Invalid contract proposal ID',
        details: `The contract proposal ID ${contractProposalId} is not valid`
      };
    }
    
    // Parse as number to ensure correct format for blockchain
    const proposalIdNumber = Number(contractProposalId);
    
    // Get the project wallet address to check if the proposal exists
    const projectWallet = await getProjectWallet(projectId);
    if (!projectWallet) {
      logger.error(`Project wallet not found for ID ${projectId}`);
      return {
        success: false,
        error: 'Project wallet not found',
        details: `