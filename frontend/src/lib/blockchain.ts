import { ethers } from 'ethers';

// ABI for Platform contract (simplified for the necessary functions)
const PLATFORM_ABI = [
  "function verifyCharity(uint256 charityId, bool verified, uint256 score) external",
  "function verifyProject(uint256 projectId, bool verified) external",
  "function verifyUser(address accountAddress, bool verified) external",
  "function verifyBankAccount(address bankAccount, bool verified) external",
  "function verifyProposal(uint256 projectId, uint256 proposalId, bool approved) external",
  "function distributeQuadraticFunding() external returns (uint256[] memory)",
  "function createNewFundingRound() external",
  "function distributeAndCreateNewRound() external returns (uint256[] memory)",
  "function owner() external view returns (address)",
  "function getProjectWallet(uint256 projectId) external view returns (address)",
];

// ABI for Project Wallet contract (for direct transfers)
const PROJECT_WALLET_ABI = [
  "function transferFunds(address recipient, uint256 amount) external",
  "function executeProposal(uint256 proposalId, address recipient, uint256 amount) external",
];

// Default bank account address for blockchain representation
const DEFAULT_BANK_TRANSFER_ADDRESS = '0xE01aA1e53d13E5f735118f7019f5D00Fb449143C';

class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private platformContract: ethers.Contract;
  private signer: ethers.Signer | null = null;

  constructor() {
    // Get RPC URL from environment variable or use default
    const rpcUrl = process.env.NEXT_PUBLIC_SCROLL_RPC_URL || 'https://sepolia-rpc.scroll.io/';
    
    // Get Platform contract address from environment variable
    const platformAddress = process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || '0xa7f9b6d74C3A4F86b1813A186Cb417e4860988b5';
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.platformContract = new ethers.Contract(platformAddress, PLATFORM_ABI, this.provider);
  }

  /**
   * Connect wallet to use for transactions
   * @param provider Web3 provider from MetaMask or other wallet
   */
  async connectWallet(provider: any) {
    try {
      const ethersProvider = new ethers.BrowserProvider(provider);
      this.signer = await ethersProvider.getSigner();
      
      // Create contract instance with signer
      this.platformContract = new ethers.Contract(
        this.platformContract.target,
        this.platformContract.interface,
        this.signer
      );
      
      return true;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      return false;
    }
  }

  /**
   * Check if connected wallet is the platform owner
   */
  async isOwner(): Promise<boolean> {
    try {
      if (!this.signer) return false;
      
      const ownerAddress = await this.platformContract.owner();
      const currentAddress = await this.signer.getAddress();
      
      return ownerAddress.toLowerCase() === currentAddress.toLowerCase();
    } catch (error) {
      console.error('Error checking owner:', error);
      return false;
    }
  }

  /**
   * Verify a charity
   * @param charityId The charity ID
   * @param verified Whether the charity is verified
   * @param score The verification score
   */
  async verifyCharity(charityId: number, verified: boolean, score: number): Promise<boolean> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }
      
      // Check if user is owner
      const isOwner = await this.isOwner();
      if (!isOwner) {
        throw new Error('Only platform owner can verify charities');
      }
      
      // Call contract method
      const tx = await this.platformContract.verifyCharity(charityId, verified, score);
      
      // Wait for transaction confirmation
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Error verifying charity:', error);
      throw error;
    }
  }

  /**
   * Verify a project
   * @param projectId The project ID
   * @param verified Whether the project is verified
   */
  async verifyProject(projectId: number, verified: boolean): Promise<boolean> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }
      
      // Check if user is owner
      const isOwner = await this.isOwner();
      if (!isOwner) {
        throw new Error('Only platform owner can verify projects');
      }
      
      // Call contract method with verified boolean
      const tx = await this.platformContract.verifyProject(projectId, verified);
      
      // Wait for transaction confirmation
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Error verifying project:', error);
      throw error;
    }
  }

  /**
   * Verify a user with Worldcoin (for quadratic funding eligibility)
   * @param accountAddress The user's account address
   * @param verified Whether the user is verified
   */
  async verifyUser(accountAddress: string, verified: boolean): Promise<boolean> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }
      
      // Check if user is owner
      const isOwner = await this.isOwner();
      if (!isOwner) {
        throw new Error('Only platform owner can verify users');
      }
      
      // Call contract method
      const tx = await this.platformContract.verifyUser(accountAddress, verified);
      
      // Wait for transaction confirmation
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Error verifying user:', error);
      throw error;
    }
  }

  /**
   * Verify a withdrawal proposal
   * @param projectId The project ID
   * @param proposalId The proposal ID
   * @param approved Whether the proposal is approved
   */
  async verifyProposal(projectId: number, proposalId: number, approved: boolean): Promise<boolean> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }
      
      // Check if user is owner
      const isOwner = await this.isOwner();
      if (!isOwner) {
        throw new Error('Only platform owner can verify proposals');
      }
      
      // Call contract method
      const tx = await this.platformContract.verifyProposal(projectId, proposalId, approved);
      
      // Wait for transaction confirmation
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Error verifying proposal:', error);
      throw error;
    }
  }

  /**
   * Execute a proposal transfer
   * @param projectId The project ID
   * @param proposalId The proposal ID
   * @param amount The amount to transfer (in ETH)
   * @param transferType The type of transfer (bank or crypto)
   * @param recipientAddress The recipient address (for crypto transfers) 
   */
  async executeProposalTransfer(
    projectId: number, 
    proposalId: number, 
    amount: number, 
    transferType: 'bank' | 'crypto', 
    recipientAddress?: string
  ): Promise<{success: boolean, txHash: string}> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }
      
      // Get project wallet address
      const projectWalletAddress = await this.platformContract.getProjectWallet(projectId);
      
      if (!projectWalletAddress || projectWalletAddress === ethers.ZeroAddress) {
        throw new Error('Project wallet not found');
      }
      
      // Create instance of project wallet contract
      const projectWalletContract = new ethers.Contract(
        projectWalletAddress,
        PROJECT_WALLET_ABI,
        this.signer
      );
      
      // Determine recipient address based on transfer type
      const recipient = transferType === 'bank' 
        ? DEFAULT_BANK_TRANSFER_ADDRESS 
        : (recipientAddress || DEFAULT_BANK_TRANSFER_ADDRESS);
      
      // Convert amount to wei
      const amountInWei = ethers.parseEther(amount.toString());
      
      // Execute the transfer
      const tx = await projectWalletContract.executeProposal(
        proposalId,
        recipient,
        amountInWei
      );
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error) {
      console.error('Error executing proposal transfer:', error);
      throw error;
    }
  }

  /**
   * Distribute quadratic funding to projects
   * @param createNewRound Whether to also create a new round after distribution
   */
  async distributeQuadraticFunding(createNewRound: boolean = false): Promise<number[]> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }
      
      // Check if user is owner
      const isOwner = await this.isOwner();
      if (!isOwner) {
        throw new Error('Only platform owner can distribute funding');
      }
      
      // Call the appropriate contract method based on createNewRound parameter
      const tx = createNewRound
        ? await this.platformContract.distributeAndCreateNewRound()
        : await this.platformContract.distributeQuadraticFunding();
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Parse event to get allocation results
      // This would need to be implemented based on your event structure
      
      return [];
    } catch (error) {
      console.error('Error distributing funding:', error);
      throw error;
    }
  }
}

// Singleton instance 
export const blockchain = new BlockchainService(); 