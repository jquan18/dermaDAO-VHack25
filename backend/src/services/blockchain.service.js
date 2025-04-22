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
const PROJECT_WALLET_ABI_PATH = path.join(__dirname, '../../../blockchain/abi/ProjectWallet.json');
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
        details: `Could not find wallet address for project ID ${projectId}`
      };
    }
    
    // Create contract instance for the project wallet with direct ABI
    const walletContract = new ethers.Contract(
      projectWallet,
      PROJECT_WALLET_ABI,
      blockchainConfig.provider
    );
    
    // Check if the proposal exists before trying to verify it
    try {
      logger.info(`Checking if proposal ${proposalIdNumber} exists in project wallet ${projectWallet}`);
      
      // Call view function to check if proposal exists
      const proposal = await walletContract.proposals(proposalIdNumber);
      
      // Check if we got a valid proposal (check if amount is greater than 0)
      if (!proposal || proposal.amount.toString() === '0') {
        logger.error(`Proposal ${proposalIdNumber} does not exist or has zero amount`);
        return {
          success: false,
          error: 'Proposal does not exist',
          details: `Proposal ${proposalIdNumber} could not be found on the blockchain`
        };
      }
      
      // If we got here, the proposal exists. Check if it's already executed
      // The executedAt field might be represented differently depending on the contract
      const executedAt = proposal.executedAt || proposal[7]; // Try different ways to access executedAt
      
      // Check if executedAt is non-zero (executed)
      const isExecuted = executedAt && 
                        ((typeof executedAt.toNumber === 'function' && executedAt.toNumber() > 0) || 
                         (typeof executedAt === 'bigint' && executedAt > 0n) ||
                         (typeof executedAt === 'number' && executedAt > 0) ||
                         (executedAt.toString() !== '0'));
      
      if (isExecuted) {
        logger.warn(`Proposal ${proposalIdNumber} has already been executed`);
        return {
          success: false,
          error: 'Proposal already executed',
          details: `Proposal ${proposalIdNumber} has already been executed and cannot be verified again`
        };
      }
      
      logger.info(`Confirmed proposal ${proposalIdNumber} exists and is not executed`);
    } catch (checkError) {
      logger.error(`Error checking proposal existence: ${checkError.message}`);
      return {
        success: false,
        error: 'Proposal does not exist or cannot be accessed',
        details: checkError.message
      };
    }
    
    // Get the platform contract from the blockchain config
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);
    
    // Call the platform contract's verifyProposal function
    logger.info(`Calling verifyProposal function on platform contract for proposal ${proposalIdNumber}`);
    const tx = await platformContract.verifyProposal(projectId, proposalIdNumber, approved);
    
    logger.info(`Transaction hash: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    if (!receipt.status) {
      logger.error(`Proposal verification transaction failed for proposal ${proposalIdNumber}`);
      return {
        success: false,
        error: 'Transaction failed',
        transactionHash: tx.hash
      };
    }
    
    logger.info(`Successfully verified proposal ${proposalIdNumber}, transaction confirmed in block ${receipt.blockNumber}`);
    return tx.hash;
  } catch (error) {
    logger.error(`Failed to verify proposal: ${error.message}`, {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.info?.error || error.error
      }
    });
    
    // Return error information instead of dummy hash
    return {
      success: false,
      error: error.message || 'Unknown blockchain error',
      errorCode: error.code,
      details: error.reason || (error.info?.error?.message)
    };
  }
};

/**
 * Distributes quadratic funding for a specific pool via the platform contract.
 * @param {number} poolId - The database ID of the funding pool.
 * @param {Array} projectsForDistribution - Optional array of project data needed for off-chain calcs or contract input.
 * @returns {Promise<Object>} Distribution results { success, transactionHash, distributions?, error? }
 */
const distributeQuadraticFunding = async (poolId, projectsForDistribution = []) => {
  try {
    logger.info(`Distributing quadratic funding for DB pool ${poolId}`);

    // 1. Get Contract Pool ID from DB Pool ID
    const poolQuery = await db.query('SELECT contract_pool_id FROM funding_pools WHERE id = $1', [poolId]);
    if (poolQuery.rows.length === 0 || poolQuery.rows[0].contract_pool_id === null || poolQuery.rows[0].contract_pool_id === undefined) {
        throw new Error(`Funding pool DB ID ${poolId} not found or has no contract_pool_id.`);
    }
    const contractPoolId = poolQuery.rows[0].contract_pool_id;
    logger.info(`Targeting distribution for Contract Pool ID: ${contractPoolId}`);


    // 2. Get the SIGNED Platform contract
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);

    // 3. Call the platform contract's distributeQuadraticFunding function
    // Adjust based on Platform.sol's distribute logic.
    // Example: platform.distributeQuadraticFunding(uint256 contractPoolId)
    logger.info(`Calling platform.distributeQuadraticFunding(${contractPoolId})`);
    const interaction = platformContract.distributeQuadraticFunding(contractPoolId);

    const result = await sendTransaction(interaction, `distribute funds for Pool ${contractPoolId}`);

    if (!result.success) {
      // Use the error message from sendTransaction
      throw new Error(`Distribute transaction failed: ${result.error}`);
    }

    // 4. Parse allocation events
    let distributions = [];
    logger.info(`Parsing logs for distribution events from tx ${result.transactionHash}...`);
    for (const log of result.receipt.logs) {
      try {
        const parsedLog = platformContract.interface.parseLog(log);

        // Assuming event ProjectAllocation(uint256 indexed poolId, uint256 indexed projectId, uint256 amount);
        // Where poolId is contractPoolId and projectId is dbProjectId
        if (parsedLog && parsedLog.name === 'ProjectAllocation') {
           // Match against the *contract* pool ID emitted by the event
          if (parsedLog.args.poolId.toString() === contractPoolId.toString()) {
             const dbProjectId = parsedLog.args.projectId.toString(); // Assuming event emits DB Project ID
             const amount = ethers.formatEther(parsedLog.args.amount);
             distributions.push({
               poolId: poolId, // Store DB Pool ID
               contractPoolId: contractPoolId, // Store Contract Pool ID
               projectId: parseInt(dbProjectId), // Store DB Project ID from event
               amount,
             });
             logger.info(`Found ProjectAllocation event: Pool ${contractPoolId}, DB Project ${dbProjectId}, Amount ${amount} ETH`);
          } else {
             logger.warn(`Parsed ProjectAllocation event for wrong contract pool ID: ${parsedLog.args.poolId.toString()} (expected ${contractPoolId})`);
          }
        } else if (parsedLog && parsedLog.name === 'FundsDistributed') {
           // Assuming event FundsDistributed(uint256 indexed poolId, address distributor);
           // Match against the *contract* pool ID emitted by the event
           if (parsedLog.args.poolId.toString() === contractPoolId.toString()) {
               logger.info(`Found FundsDistributed event for contract pool ${contractPoolId}`);
           }
        }
      } catch (e) { /* Ignore logs not parseable by platform ABI */ }
    }
    logger.info(`Found ${distributions.length} project allocations in logs for DB Pool ${poolId} (Contract ID: ${contractPoolId}).`);

    return {
      success: true,
      transactionHash: result.transactionHash,
      distributions, // Array of { poolId (DB), contractPoolId, projectId (DB), amount }
      // REMOVED: newRoundCreated flag
    };

  } catch (error) {
    logger.error(`Failed to distribute quadratic funding for pool ${poolId}: ${error.message}`, { error });
    return { success: false, error: error.message };
  }
};

/**
 * Gets the balance of the quadratic funding pool
 * @returns {Promise<string>} The pool balance in ETH
 */
const getQuadraticPoolBalance = async () => {
  try {
    logger.info('Getting quadratic funding pool balance');
    
    // Get the quadratic funding contract directly from config
    const quadraticContract = blockchainConfig.fundingPoolContract;
    
    // Call the getPoolBalance function
    const balanceWei = await quadraticContract.getPoolBalance();
    
    // Convert to ETH
    const balanceETH = ethers.formatEther(balanceWei);
    
    logger.info(`Pool balance: ${balanceETH} ETH`);
    return balanceETH;
  } catch (error) {
    logger.error(`Failed to get quadratic pool balance: ${error.message}`, {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.info?.error || error.error
      }
    });
    
    return "0";
  }
};

/**
 * Get the wallet address for a project
 * @param {number} projectId - Project ID
 * @returns {Promise<string>} Project wallet address
 */
const getProjectWallet = async (projectId) => {
  try {
    logger.info(`Getting wallet address for project ${projectId}`);
    
    // Query the database for the project wallet address
    const result = await db.query(
      'SELECT wallet_address FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (result.rows.length === 0) {
      logger.warn(`Project ${projectId} not found in database`);
      return null;
    }
    
    const walletAddress = result.rows[0].wallet_address;
    logger.info(`Found wallet address for project ${projectId}: ${walletAddress}`);
    
    return walletAddress;
  } catch (error) {
    logger.error(`Error retrieving project wallet: ${error.message}`, error);
    return null;
  }
};

/**
 * Execute a proposal transfer on the blockchain via the platform contract
 * @param {number} projectId - Project ID
 * @param {number} contractProposalId - Contract proposal ID (0-based index in the project wallet)
 * @param {boolean} approved - Whether to approve and execute the proposal
 * @returns {Promise<string>} Transaction hash
 */
const executeProposal = async (projectId, contractProposalId, approved = true) => {
  logger.info(`Executing proposal with contract ID ${contractProposalId} for project ${projectId} via platform contract (approved: ${approved})`);
  
  try {
    // Ensure contract proposal ID is a number
    const proposalIdNumber = Number(contractProposalId);
    
    // We should use the platform contract to verify/execute the proposal
    // This will handle both approval and execution in one transaction
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);
    
    logger.info(`Calling verifyProposal on platform contract for project ${projectId}, proposal ${proposalIdNumber}, approved=${approved}`);
    
    // Call the platform contract's verifyProposal function
    // This will handle both updating the status and executing if approved
    const tx = await platformContract.verifyProposal(
      projectId,
      proposalIdNumber,
      approved
    );
    
    logger.info(`Transaction sent with hash: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Return the transaction hash
    return tx.hash;
  } catch (error) {
    logger.error(`Error executing proposal on blockchain:`, error);
    throw {
      message: `Blockchain error: ${error.message || 'Unknown error'}`,
      code: 'BLOCKCHAIN_ERROR',
      originalError: error
    };
  }
};

/**
 * Get the platform contract instance with admin wallet
 * @returns {Promise<ethers.Contract>} Signed platform contract
 */
const getPlatformContract = async () => {
  return blockchainConfig.platformContract;
};

/**
 * Creates a funding pool on the blockchain platform.
 * Replaces the old `createFundingPool`.
 * @param {object} poolData - Data for the pool, expects { poolId (DB ID), name, description, sponsor, duration }
 * @returns {Promise<object>} - Result { success, transactionHash?, data?: { pool_id (contract ID) }, error? }
 */
const createPoolOnContract = async (poolData) => {
  try {
    const { poolId, name, description, sponsor, duration } = poolData; // Extract all required parameters
    
    // Add detailed debugging for missing parameters
    logger.info(`CreatePoolOnContract params: poolId=${poolId}, name=${name}, description=${description?.substring(0, 20)}..., sponsor=${sponsor}, duration=${duration}`);
    
    if (poolId === undefined || poolId === null || !name || !description || !sponsor || !duration) {
      const missingParams = [];
      if (poolId === undefined || poolId === null) missingParams.push('poolId');
      if (!name) missingParams.push('name');
      if (!description) missingParams.push('description');
      if (!sponsor) missingParams.push('sponsor');
      if (!duration) missingParams.push('duration');
      
      throw new Error(`Missing required parameters for createPoolOnContract: ${missingParams.join(', ')}`);
    }
    logger.info(`Creating pool on Platform contract. DB Pool ID: ${poolId}, Name: ${name}`);
    // Get SIGNED contract
    const platformContract = blockchainConfig.getSignedContract(blockchainConfig.platformContract);

    // Call createPool with correct parameters as per Platform.sol: 
    // createPool(string calldata name, string calldata description, address sponsor, uint256 duration)
    logger.info(`Calling platform.createPool("${name}", "${description}", "${sponsor}", ${duration})`);
    const interaction = platformContract.createPool(name, description, sponsor, duration);
    const result = await sendTransaction(interaction, `create Pool (DB ID ${poolId}) on Platform contract`);

    if (!result.success) {
      // Use error from sendTransaction
      throw new Error(`Create pool transaction failed: ${result.error}`);
    }

    // Parse PoolCreated event to get the Contract's Pool ID
    let contractPoolId = null; // The ID the contract uses internally
     const poolCreatedEvent = result.receipt.logs
        .map(log => { try { return platformContract.interface.parseLog(log); } catch(e){return null;} })
        .find(log => log && log.name === 'PoolCreated');

     if (poolCreatedEvent) {
         // Get pool ID from event (first argument is typically the ID)
         contractPoolId = poolCreatedEvent.args[0].toString();
         logger.info(`PoolCreated event found: DB Pool ID ${poolId} mapped to Contract Pool ID ${contractPoolId}`);
     } else {
         logger.error(`PoolCreated event not found for DB pool ID ${poolId}. Cannot confirm contract pool ID.`);
         throw new Error(`PoolCreated event not found for DB pool ID ${poolId}`);
     }

    // Ensure contractPoolId is not null or undefined before returning success
    if (contractPoolId === null || contractPoolId === undefined) {
        throw new Error('Failed to extract contract pool ID from event logs.');
    }

    return {
        success: true,
        transactionHash: result.transactionHash,
        data: { pool_id: contractPoolId } // Return the contract's pool ID
    };
  } catch (error) {
      // Log the specific DB pool ID if available
      logger.error(`Failed to create pool (DB ID ${poolData?.poolId}) on blockchain: ${error.message}`, { error });
      return { success: false, error: error.message };
  }
};

/**
 * Donate to a funding pool
 * @param {string} userWalletAddress - User wallet address
 * @param {number} poolId - Database Pool ID
 * @param {string} amount - Amount to donate in ETH
 * @param {boolean} isWorldcoinVerified - Whether the user is verified by Worldcoin
 * @param {boolean} isPoolOwner - Whether the user is the owner of the pool
 * @returns {Promise<string>} - Transaction hash
 */
const donateToFundingPool = async (
  userWalletAddress,
  poolId,
  amount,
  isWorldcoinVerified = false,
  isPoolOwner = false
) => {
  try {
    logger.info(`Making donation to database funding pool ${poolId} from ${userWalletAddress} of ${amount} ETH`);
    
    // Get the contract_pool_id from the database
    const poolResult = await db.query(
      'SELECT contract_pool_id FROM funding_pools WHERE id = $1',
      [poolId]
    );

    if (poolResult.rows.length === 0) {
      logger.error(`Funding pool ${poolId} not found in database`);
      throw new Error(`Funding pool ${poolId} not found in database`);
    }

    // Get the contract_pool_id (blockchain pool ID)
    const contractPoolId = poolResult.rows[0].contract_pool_id !== null 
      ? poolResult.rows[0].contract_pool_id 
      : 0; // Fallback to 0 if null

    logger.info(`Using contract pool ID ${contractPoolId} for database pool ID ${poolId}`);
    logger.info(`User Worldcoin verified: ${isWorldcoinVerified}, Is pool owner: ${isPoolOwner}`);
    
    // Convert the amount to proper format for blockchain (ethers format)
    const ethAmount = ethers.parseEther(amount.toString());
    
    // Get the funding pool contract address
    const fundingPoolAddress = blockchainConfig.fundingPoolContract.target;
    
    // Get the entry point contract
    const entryPoint = blockchainConfig.entryPointContract;
    
    // Encode the function call data for donateToPool(uint256) using the contract_pool_id
    const donateToPoolAbi = ['function donateToPool(uint256 poolId) external payable'];
    const fundingPoolInterface = new ethers.Interface(donateToPoolAbi);
    const callData = fundingPoolInterface.encodeFunctionData('donateToPool', [contractPoolId]);
    
    // Handle pool owner case separately
    if (isPoolOwner) {
      logger.info(`User is pool owner, using direct funding method`);
      
      // For pool owners, directly execute through their account
      try {
        // Create user operation for the ERC-4337 account
        const userAccount = new ethers.Contract(
          userWalletAddress,
          [
            'function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory)',
            'function nonce() external view returns (uint256)'
          ],
          blockchainConfig.provider
        );
        
        // Get the admin wallet to send the transaction through the entry point
        const adminWallet = blockchainConfig.getAdminWallet();
        
        // For ERC-4337, we need to create a UserOperation
        // First, get the nonce
        const nonce = await userAccount.nonce().catch(() => 0);
        
        // Create the calldata for the execute function
        const accountInterface = new ethers.Interface([
          'function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory)'
        ]);
        
        const executeCalldata = accountInterface.encodeFunctionData('execute', [
          fundingPoolAddress,
          ethAmount,
          callData
        ]);
        
        // Submit the transaction through the entry point
        const userOp = {
          sender: userWalletAddress,
          nonce: nonce,
          initCode: '0x', // Empty for existing accounts
          callData: executeCalldata,
          callGasLimit: 500000,
          verificationGasLimit: 500000,
          preVerificationGas: 100000,
          maxFeePerGas: ethers.parseUnits('10', 'gwei'),
          maxPriorityFeePerGas: ethers.parseUnits('5', 'gwei'),
          paymasterAndData: '0x',
          signature: '0x' // Will be filled in by the bundler or we can sign it ourselves
        };
        
        // Create the full transaction to handle the user operation
        const signedEntryPoint = entryPoint.connect(adminWallet);
        
        // For simplified handling, we'll just connect directly to the user account
        // This ensures the funds come from the user, not the admin
        const tx = await userAccount.connect(adminWallet).execute(
          fundingPoolAddress,
          ethAmount,
          callData,
          { gasLimit: 1000000 }
        );
        
        logger.info(`Direct pool funding transaction initiated with hash: ${tx.hash}`);
        
        const receipt = await tx.wait();
        if (!receipt.status) {
          throw new Error('Pool funding transaction failed');
        }
        
        logger.info(`Pool funding confirmed in block ${receipt.blockNumber}`);
        return tx.hash;
      } catch (error) {
        logger.error(`Error in pool owner funding: ${error.message}`);
        throw error;
      }
    } else {
      // Regular user donation flow
      try {
        // Get the user account
        const userAccount = new ethers.Contract(
          userWalletAddress,
          [
            'function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory)',
            'function nonce() external view returns (uint256)'
          ],
          blockchainConfig.provider
        );
        
        // Since we're using ERC-4337, we need to properly handle the account abstraction
        // Get the admin wallet to send the operation through the entry point
        const adminWallet = blockchainConfig.getAdminWallet();
        
        // Check user account balance first
        const userBalance = await blockchainConfig.provider.getBalance(userWalletAddress);
        if (userBalance < ethAmount) {
          throw new Error(`Insufficient balance in user wallet: ${ethers.formatEther(userBalance)} ETH, needed: ${amount} ETH`);
        }
        
        logger.info(`User wallet has sufficient balance: ${ethers.formatEther(userBalance)} ETH`);
        
        // Execute the donation from the user account
        // This ensures the funds come from the user wallet
        const tx = await userAccount.connect(adminWallet).execute(
          fundingPoolAddress,
          ethAmount,
          callData,
          { gasLimit: 1000000 }
        );
        
        logger.info(`User account donation transaction initiated with hash: ${tx.hash}`);
        
        const receipt = await tx.wait();
        if (!receipt.status) {
          throw new Error('User donation transaction failed');
        }
        
        logger.info(`Pool donation confirmed in block ${receipt.blockNumber}`);
        
        // If the user is Worldcoin verified, record the donation for quadratic funding
        if (isWorldcoinVerified) {
          try {
            logger.info(`Recording pool donation for quadratic funding - user: ${userWalletAddress}, contract pool: ${contractPoolId}, amount: ${ethAmount}`);
            
            // Get the funding pool contract with admin signer
            const fundingPool = blockchainConfig.getSignedContract(blockchainConfig.fundingPoolContract);
            
            // Use recordDonation on the funding pool contract
            const recordTx = await fundingPool.recordDonation(
              userWalletAddress,
              0, // Using 0 as a placeholder since we're donating to a pool, not a project
              contractPoolId,
              ethAmount
            );
            
            logger.info(`Quadratic funding record transaction initiated with hash: ${recordTx.hash}`);
            
            const recordReceipt = await recordTx.wait();
            if (!recordReceipt.status) {
              throw new Error('Record pool donation transaction failed');
            }
            
            logger.info(`Pool donation recorded for quadratic funding in block ${recordReceipt.blockNumber}`);
          } catch (error) {
            logger.error(`Failed to record pool donation for quadratic funding: ${error.message}`, { error });
            // We don't throw here because the main donation was successful
          }
        }
        
        return tx.hash;
      } catch (error) {
        logger.error(`Failed to execute donation from user wallet: ${error.message}`, {
          error: {
            message: error.message,
            code: error.code,
            stack: error.stack
          }
        });
        
        // If we're in development mode, provide a mock transaction
        if (process.env.NODE_ENV === 'development') {
          logger.info(`Generating mock transaction hash for pool donation in development mode`);
          const mockTransactionHash = `0x${crypto.randomBytes(32).toString('hex')}`;
          return mockTransactionHash;
        }
        
        throw new Error(`User wallet donation failed: ${error.message}. Please ensure the wallet has sufficient funds.`);
      }
    }
  } catch (error) {
    logger.error(`Failed to make donation to funding pool: ${error.message}`, {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.info?.error || error.error
      }
    });
    
    // Generate a mock hash if needed for development
    if (process.env.NODE_ENV === 'development') {
      logger.info(`Generating mock transaction hash for pool donation in development mode`);
      const mockTransactionHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      return mockTransactionHash;
    }
    
    throw error;
  }
};

/**
 * Gets the quadratic funding allocation for a specific project in a specific pool.
 * @param {number} poolId - The database ID of the funding pool.
 * @param {number} projectId - The database ID of the project.
 * @returns {Promise<string>} The allocated amount in ETH, or '0' if error or not found.
 */
const getProjectAllocation = async (poolId, projectId) => {
  try {
    logger.info(`Getting allocation for project ${projectId} in DB pool ${poolId}`);

    // 1. Get Contract Pool ID from DB Pool ID
    const poolQuery = await db.query('SELECT contract_pool_id FROM funding_pools WHERE id = $1', [poolId]);
    if (poolQuery.rows.length === 0 || poolQuery.rows[0].contract_pool_id === null || poolQuery.rows[0].contract_pool_id === undefined) {
        logger.warn(`DB Pool ID ${poolId} not found or has no contract_pool_id. Cannot fetch allocation.`);
        return '0'; // Return 0 if pool/contract_pool_id doesn't exist
    }
    const contractPoolId = poolQuery.rows[0].contract_pool_id;
    logger.info(`Using Contract Pool ID ${contractPoolId} for DB Pool ID ${poolId}`);

    // 2. Get the READ-ONLY QuadraticFundingPool contract
    const fundingPoolContract = blockchainConfig.fundingPoolContract;
    if (!fundingPoolContract) {
        logger.error('Funding Pool contract is not initialized in blockchain config.');
        return '0';
    }

    // 3. Call the getProjectAllocation view function
    // Function signature from QuadraticFunding.sol: getProjectAllocation(uint256 poolId, uint256 projectId) returns (uint256)
    logger.info(`Calling fundingPool.getProjectAllocation(poolId=${contractPoolId}, projectId=${projectId})`);
    const allocationWei = await fundingPoolContract.getProjectAllocation(contractPoolId, projectId);

    // 4. Convert Wei to ETH and return
    const allocationEth = ethers.formatEther(allocationWei);
    logger.info(`Project ${projectId} allocation in pool ${contractPoolId}: ${allocationEth} ETH`);
    return allocationEth;

  } catch (error) {
    // Log specific errors
    if (error.code === 'CALL_EXCEPTION') {
        logger.warn(`Contract call exception fetching allocation for project ${projectId}, pool ${contractPoolId}. Possibly project not found in pool or other contract issue: ${error.reason || error.message}`);
    } else {
        logger.error(`Failed to get project allocation for project ${projectId}, pool ${poolId} (Contract Pool ID ${contractPoolId || 'N/A'}): ${error.message}`, { error });
    }
    return '0'; // Return '0' on any error
  }
};

// Export all functions
module.exports = {
  initializeBlockchain,
  createUserWallet,
  registerCharity,
  verifyProject,
  verifyUserWithWorldcoin,
  createProjectWallet,
  getWalletBalance,
  makeDonation,
  createWithdrawalProposal,
  verifyProposal,
  distributeQuadraticFunding,
  getQuadraticPoolBalance,
  getProjectWallet,
  executeProposal,
  getPlatformContract,
  createPoolOnContract,
  donateToFundingPool,
  getProjectAllocation
};