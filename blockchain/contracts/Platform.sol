// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import interfaces
interface IEntryPoint {
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }
    
    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external;
    function depositTo(address account) external payable;
    function balanceOf(address account) external view returns (uint256);
}

interface IDermaDAOAccountFactory {
    function createAccount(address owner, uint256 salt) external returns (address);
    function getAddress(address owner, uint256 salt) external view returns (address);
}

interface IDermaDAOPaymaster {
    function setAccountAllowance(address account, bool allowed) external;
}

interface IQuadraticFundingPool {
    function recordDonation(address donor, uint256 projectId, uint256 poolId, uint256 amount) external;
    function distributeQuadraticFunding(uint256 poolId, uint256[] calldata projectIds, address payable[] calldata destinations) external returns (uint256[] memory);
    function getProjectAllocation(uint256 poolId, uint256 projectId) external view returns (uint256);
    function getPoolAllocations(uint256 poolId, uint256[] calldata projectIds) external view returns (uint256[] memory);
    function getPoolInfo(uint256 poolId) external view returns (string memory name, string memory description, address sponsor, uint256 startTime, uint256 endTime, uint256 totalFunds, bool distributed);
    function createPool(string calldata name, string calldata description, address sponsor, uint256 duration) external returns (uint256);
    function addProjectToPool(uint256 projectId, uint256 poolId) external;
    function getPoolCount() external view returns (uint256);
    function endPoolEarly(uint256 poolId) external;
    function donateToPool(uint256 poolId) external payable;
}

interface IProjectWallet {
    enum ProposalStatus { Pending, Approved, Rejected, Executed }
    
    function initialize(address _charityAdmin, uint256 _projectId) external;
    function updateProposalStatus(uint256 proposalId, ProposalStatus status) external;
    function executeProposal(uint256 proposalId) external;
}

interface IDermaDAOAccount {
    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory result);
}

// Minimal implementation of OpenZeppelin's Clones library
library Clones {
    function clone(address implementation) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "Clone failed");
    }

    function cloneDeterministic(address implementation, bytes32 salt) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create2(0, ptr, 0x37, salt)
        }
        require(instance != address(0), "Clone failed");
    }
}

// Library to handle project operations
library ProjectLib {
    struct Project {
        string name;
        string description;
        string ipfsHash;
        uint256 charityId;
        uint256 poolId;
        bool isActive;
        address payable walletAddress;
        bool isVerified;
    }
    
    function createProjectWallet(
        address implementation,
        address charityAdmin, 
        uint256 projectId
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(charityAdmin, projectId, block.timestamp));
        address instance = Clones.cloneDeterministic(implementation, salt);
        IProjectWallet(instance).initialize(charityAdmin, projectId);
        return instance;
    }
    
    function getProjectsInPool(
        Project[] storage projects, 
        uint256 poolId
    ) internal view returns (uint256[] memory) {
        // Count projects in this pool
        uint256 count = 0;
        for (uint256 i = 0; i < projects.length; i++) {
            if (projects[i].poolId == poolId) {
                count++;
            }
        }
        
        // Create and fill array
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < projects.length; i++) {
            if (projects[i].poolId == poolId) {
                result[index] = i;
                index++;
            }
        }
        
        return result;
    }
}

/**
 * @title DermaDAOPlatform
 * @dev Main contract for the DermaDAO platform
 */
contract DermaDAOPlatform {
    // References to external contracts
    IEntryPoint public immutable entryPoint;
    IDermaDAOAccountFactory public accountFactory;
    IDermaDAOPaymaster public paymaster;
    IQuadraticFundingPool public fundingPool;
    
    address public owner;
    address public projectWalletImplementation;
    
    struct Charity {
        string name;
        string description;
        address admin;
        bool isVerified;
    }
    
    struct Pool {
        string name;
        string description;
        address sponsor;
        bool isActive;
    }
    
    struct User {
        address accountAddress;
        string hashedEmail;
        bool worldcoinVerified;
    }
    
    Charity[] public charities;
    ProjectLib.Project[] public projects;
    Pool[] public pools;
    
    mapping(address => bool) public isCharityAdmin;
    mapping(string => address) public emailToAccount;
    mapping(address => User) public users;
    mapping(address => bool) public isVerifiedBank;
    
    event CharityRegistered(uint256 indexed charityId, string name, address admin);
    event ProjectCreated(uint256 indexed projectId, uint256 indexed charityId, uint256 indexed poolId, string name, address walletAddress);
    event ProjectVerified(uint256 indexed projectId, bool verified);
    event UserRegistered(address indexed accountAddress, string hashedEmail);
    event UserVerified(address indexed accountAddress, bool verified);
    event BankAccountVerified(address indexed bankAccount, bool verified);
    event DonationMade(address indexed donor, uint256 indexed projectId, uint256 indexed poolId, uint256 amount);
    event ProposalVerified(address indexed projectWallet, uint256 indexed proposalId, bool approved);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AccountFactoryUpdated(address indexed oldFactory, address indexed newFactory);
    event PaymasterUpdated(address indexed oldPaymaster, address indexed newPaymaster);
    event FundingPoolUpdated(address indexed oldFundingPool, address indexed newFundingPool);
    event ProjectWalletImplementationUpdated(address indexed oldImplementation, address indexed newImplementation);
    event QuadraticFundingDistributed(uint256 indexed poolId);
    event PoolCreated(uint256 indexed poolId, string name, address indexed sponsor);
    event PoolEndedEarly(uint256 indexed poolId);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }
    
    constructor(
        address _entryPoint,
        address _accountFactory,
        address _paymaster,
        address _fundingPool,
        address _projectWalletImplementation
    ) {
        entryPoint = IEntryPoint(_entryPoint);
        accountFactory = IDermaDAOAccountFactory(_accountFactory);
        paymaster = IDermaDAOPaymaster(_paymaster);
        fundingPool = IQuadraticFundingPool(_fundingPool);
        projectWalletImplementation = _projectWalletImplementation;
        owner = msg.sender;
    }
    
    /**
     * @dev Create a new funding pool
     */
    function createPool(
        string calldata name,
        string calldata description,
        address sponsor,
        uint256 duration
    ) external returns (uint256) {
        require(bytes(name).length > 0, "name empty");
        require(bytes(description).length > 0, "desc empty");
        require(sponsor != address(0), "zero addr");
        require(duration > 0, "zero duration");
        
        // Create the pool in the funding pool contract
        uint256 poolId = fundingPool.createPool(name, description, sponsor, duration);
        
        // Store local pool data for reference
        pools.push(Pool({
            name: name,
            description: description,
            sponsor: sponsor,
            isActive: true
        }));
        
        emit PoolCreated(poolId, name, sponsor);
        
        return poolId;
    }
    
    /**
     * @dev End a pool early
     */
    function endPoolEarly(uint256 poolId) external onlyOwner {
        require(poolId < pools.length, "pool not found");
        
        fundingPool.endPoolEarly(poolId);
        
        emit PoolEndedEarly(poolId);
    }
    
    /**
     * @dev Register a new user
     */
    function registerUser(string calldata hashedEmail, uint256 salt) external returns (address) {
        require(emailToAccount[hashedEmail] == address(0), "email exists");
        
        // Create a new account
        address accountAddress = accountFactory.createAccount(msg.sender, salt);
        
        // Store user information
        users[accountAddress] = User({
            accountAddress: accountAddress,
            hashedEmail: hashedEmail,
            worldcoinVerified: false
        });
        
        emailToAccount[hashedEmail] = accountAddress;
        
        // Allow the account to use the paymaster
        paymaster.setAccountAllowance(accountAddress, true);
        
        emit UserRegistered(accountAddress, hashedEmail);
        
        return accountAddress;
    }
    
    /**
     * @dev Verify a user with Worldcoin
     */
    function verifyUser(address accountAddress, bool verified) external onlyOwner {
        require(users[accountAddress].accountAddress != address(0), "user not found");
        
        users[accountAddress].worldcoinVerified = verified;
        
        emit UserVerified(accountAddress, verified);
    }
    
    /**
     * @dev Register a new charity (automatically verified)
     */
    function registerCharity(string calldata name, string calldata description) external {
        require(bytes(name).length > 0, "name empty");
        require(bytes(description).length > 0, "desc empty");
        
        charities.push(Charity({
            name: name,
            description: description,
            admin: msg.sender,
            isVerified: true // Auto-verified
        }));
        
        // Automatically set the sender as charity admin
        isCharityAdmin[msg.sender] = true;
        
        emit CharityRegistered(charities.length - 1, name, msg.sender);
    }
    
    /**
     * @dev Create a new project
     */
    function createProject(
        uint256 charityId,
        uint256 poolId,
        string calldata name,
        string calldata description,
        string calldata ipfsHash
    ) external returns (uint256) {
        require(charityId < charities.length, "charity not found");
        require(poolId < pools.length, "pool not found");
        require(charities[charityId].admin == msg.sender, "not admin");
        require(bytes(name).length > 0, "name empty");
        require(bytes(description).length > 0, "desc empty");
        
        // Create a new project wallet
        address payable walletAddress = payable(
            ProjectLib.createProjectWallet(
                projectWalletImplementation,
                msg.sender, 
                projects.length
            )
        );
        
        // Create the project (not verified by default)
        projects.push(ProjectLib.Project({
            name: name,
            description: description,
            ipfsHash: ipfsHash,
            charityId: charityId,
            poolId: poolId,
            isActive: true,
            walletAddress: walletAddress,
            isVerified: false
        }));
        
        uint256 projectId = projects.length - 1;
        
        // Register the project with the funding pool
        fundingPool.addProjectToPool(projectId, poolId);
        
        emit ProjectCreated(projectId, charityId, poolId, name, walletAddress);
        
        return projectId;
    }
    
    /**
     * @dev Verify a project
     */
    function verifyProject(uint256 projectId, bool verified) external onlyOwner {
        require(projectId < projects.length, "project not found");
        
        projects[projectId].isVerified = verified;
        
        emit ProjectVerified(projectId, verified);
    }
    
    /**
     * @dev Verify a bank account
     */
    function verifyBankAccount(address bankAccount, bool verified) external onlyOwner {
        isVerifiedBank[bankAccount] = verified;
        
        emit BankAccountVerified(bankAccount, verified);
    }
    
    /**
     * @dev Make a donation
     */
    function makeDonation(
        address userAccount, 
        uint256 projectId, 
        uint256 amount
    ) external {
        require(projectId < projects.length, "project not found");
        require(projects[projectId].isActive, "project inactive");
        require(projects[projectId].isVerified, "project not verified");
        require(amount > 0, "zero amount");
        
        // Get the project's pool ID
        uint256 poolId = projects[projectId].poolId;
        
        // Get the user's account
        IDermaDAOAccount account = IDermaDAOAccount(userAccount);
        
        // Check that the sender is authorized
        require(
            msg.sender == address(entryPoint) || 
            msg.sender == owner || 
            msg.sender == users[userAccount].accountAddress, 
            "not authorized"
        );
        
        // Transfer funds from the user's account to the project wallet
        account.execute(
            projects[projectId].walletAddress,
            amount,
            ""
        );
        
        // Record the donation for quadratic funding
        User storage user = users[userAccount];
        if (user.worldcoinVerified) {
            fundingPool.recordDonation(userAccount, projectId, poolId, amount);
        }
        
        emit DonationMade(userAccount, projectId, poolId, amount);
    }
    
    /**
     * @dev Record a donation for quadratic funding without transferring funds
     */
    function recordDonationForQuadraticFunding(
        address userAccount,
        uint256 projectId,
        uint256 amount
    ) external {
        require(projectId < projects.length, "project not found");
        require(projects[projectId].isActive, "project inactive");
        require(projects[projectId].isVerified, "project not verified");
        require(amount > 0, "zero amount");
        
        // Get the project's pool ID
        uint256 poolId = projects[projectId].poolId;
        
        // Check that the sender is authorized
        require(
            msg.sender == owner || 
            msg.sender == address(entryPoint),
            "not authorized"
        );
        
        // Record the donation for quadratic funding (without transferring funds)
        User storage user = users[userAccount];
        if (user.worldcoinVerified) {
            fundingPool.recordDonation(userAccount, projectId, poolId, amount);
            emit DonationMade(userAccount, projectId, poolId, 0); // Amount 0 indicates just recording
        } else {
            revert("user not verified");
        }
    }
    
    /**
     * @dev Verify and process a withdrawal proposal
     */
    function verifyProposal(uint256 projectId, uint256 proposalId, bool approved) external onlyOwner {
        require(projectId < projects.length, "project not found");
        
        IProjectWallet wallet = IProjectWallet(projects[projectId].walletAddress);
        
        // Update the proposal status
        wallet.updateProposalStatus(
            proposalId,
            approved ? IProjectWallet.ProposalStatus.Approved : IProjectWallet.ProposalStatus.Rejected
        );
        
        // If approved, execute the proposal
        if (approved) {
            wallet.executeProposal(proposalId);
        }
        
        emit ProposalVerified(projects[projectId].walletAddress, proposalId, approved);
    }
    
    /**
     * @dev Distribute quadratic funding for a specific pool
     */
    function distributeQuadraticFunding(uint256 poolId) public onlyOwner returns (uint256[] memory) {
        require(poolId < pools.length, "pool not found");
        
        // Count active projects in this pool
        uint256 activeCount = 0;
        for (uint256 i = 0; i < projects.length; i++) {
            if (projects[i].isActive && projects[i].isVerified && projects[i].poolId == poolId) {
                activeCount++;
            }
        }
        
        // Create arrays for project IDs and destinations
        uint256[] memory projectIds = new uint256[](activeCount);
        address payable[] memory destinations = new address payable[](activeCount);
        
        // Fill arrays with active project data
        uint256 index = 0;
        for (uint256 i = 0; i < projects.length; i++) {
            if (projects[i].isActive && projects[i].isVerified && projects[i].poolId == poolId) {
                projectIds[index] = i;
                destinations[index] = projects[i].walletAddress;
                index++;
            }
        }
        
        // Distribute funding
        uint256[] memory allocations = fundingPool.distributeQuadraticFunding(poolId, projectIds, destinations);
        
        // Emit event
        emit QuadraticFundingDistributed(poolId);
        
        return allocations;
    }
    
    /**
     * @dev Get project allocations for a specific pool
     */
    function getProjectAllocations(uint256 poolId, uint256[] calldata projectIds) external view returns (uint256[] memory) {
        return fundingPool.getPoolAllocations(poolId, projectIds);
    }
    
    /**
     * @dev Get a project's allocation for a specific pool
     */
    function getProjectAllocation(uint256 poolId, uint256 projectId) external view returns (uint256) {
        return fundingPool.getProjectAllocation(poolId, projectId);
    }
    
    /**
     * @dev Get pool information
     */
    function getPoolInfo(uint256 poolId) external view returns (
        string memory name,
        string memory description,
        address sponsor,
        uint256 startTime,
        uint256 endTime,
        uint256 totalFunds,
        bool distributed
    ) {
        return fundingPool.getPoolInfo(poolId);
    }
    
    /**
     * @dev Get a user's account
     */
    function getUserAccount(string calldata hashedEmail) external view returns (address) {
        return emailToAccount[hashedEmail];
    }
    
    /**
     * @dev Check if a user is verified for quadratic funding
     */
    function isUserVerifiedForQuadraticFunding(address accountAddress) external view returns (bool) {
        return users[accountAddress].worldcoinVerified;
    }
    
    /**
     * @dev Get a project's wallet address
     */
    function getProjectWallet(uint256 projectId) external view returns (address) {
        require(projectId < projects.length, "project not found");
        return projects[projectId].walletAddress;
    }
    
    /**
     * @dev Get a pool's info
     */
    function getLocalPoolInfo(uint256 poolId) external view returns (
        string memory name,
        string memory description,
        address sponsor,
        bool isActive
    ) {
        require(poolId < pools.length, "pool not found");
        
        Pool storage pool = pools[poolId];
        
        return (
            pool.name,
            pool.description,
            pool.sponsor,
            pool.isActive
        );
    }
    
    /**
     * @dev Get the number of pools
     */
    function getPoolCount() external view returns (uint256) {
        return pools.length;
    }
    
    /**
     * @dev Get projects in a specific pool
     */
    function getProjectsInPool(uint256 poolId) external view returns (uint256[] memory) {
        require(poolId < pools.length, "pool not found");
        return ProjectLib.getProjectsInPool(projects, poolId);
    }
    
    /**
     * @dev Transfer ownership of the platform
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero addr");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @dev Update the account factory
     */
    function updateAccountFactory(address newAccountFactory) external onlyOwner {
        require(newAccountFactory != address(0), "zero addr");
        address oldFactory = address(accountFactory);
        accountFactory = IDermaDAOAccountFactory(newAccountFactory);
        emit AccountFactoryUpdated(oldFactory, newAccountFactory);
    }
    
    /**
     * @dev Update the paymaster
     */
    function updatePaymaster(address newPaymaster) external onlyOwner {
        require(newPaymaster != address(0), "zero addr");
        address oldPaymaster = address(paymaster);
        paymaster = IDermaDAOPaymaster(newPaymaster);
        emit PaymasterUpdated(oldPaymaster, newPaymaster);
    }
    
    /**
     * @dev Update the funding pool
     */
    function updateFundingPool(address newFundingPool) external onlyOwner {
        require(newFundingPool != address(0), "zero addr");
        address oldFundingPool = address(fundingPool);
        fundingPool = IQuadraticFundingPool(newFundingPool);
        emit FundingPoolUpdated(oldFundingPool, newFundingPool);
    }
    
    /**
     * @dev Update the project wallet implementation
     */
    function updateProjectWalletImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "zero addr");
        address oldImplementation = projectWalletImplementation;
        projectWalletImplementation = newImplementation;
        emit ProjectWalletImplementationUpdated(oldImplementation, newImplementation);
    }
}