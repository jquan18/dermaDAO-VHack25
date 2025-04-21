// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

//-----------------------------------------------------------------------------
// ERC-4337 INTERFACES
//-----------------------------------------------------------------------------

/**
 * @title IEntryPoint
 * @dev Simplified interface for the ERC-4337 EntryPoint contract
 */
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

/**
 * @title IAccount
 * @dev Interface for ERC-4337 compatible accounts
 */
interface IAccount {
    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

/**
 * @title IPaymaster
 * @dev Interface for ERC-4337 Paymaster
 */
interface IPaymaster {
    function validatePaymasterUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);
    
    function postOp(
        uint8 mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external;
}

//-----------------------------------------------------------------------------
// USER ACCOUNT CONTRACT
//-----------------------------------------------------------------------------

/**
 * @title DermaDAOAccount
 * @dev ERC-4337 compatible smart contract wallet for DermaDAO users
 */
contract DermaDAOAccount is IAccount {
    IEntryPoint public immutable entryPoint;
    address public owner;
    address public platform;
    
    event Executed(address target, uint256 value, bytes data);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event PlatformUpdated(address indexed oldPlatform, address indexed newPlatform);
    event Received(address sender, uint256 amount);
    
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }
    
    modifier onlyOwnerOrEntryPoint() {
        require(
            msg.sender == owner || msg.sender == address(entryPoint) || msg.sender == platform,
            "not authorized"
        );
        _;
    }
    
    constructor(IEntryPoint _entryPoint, address _owner, address _platform) {
        entryPoint = _entryPoint;
        owner = _owner;
        platform = _platform != address(0) ? _platform : _owner; // If platform is zero, use owner
    }
    
    /**
     * @dev Implementation of IAccount.validateUserOp
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds Funds needed to be paid to the EntryPoint
     * @return validationData Result of the validation
     */
    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        require(msg.sender == address(entryPoint), "only EntryPoint can validate");
        
        bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        
        // Verify the signature is from the owner
        // For a real implementation, you'd check the signature against owner's address
        // This is a simplified version
        
        // Transfer missing funds to the EntryPoint if needed
        if (missingAccountFunds > 0) {
            (bool success,) = payable(address(entryPoint)).call{value: missingAccountFunds}("");
            require(success, "failed to transfer funds to EntryPoint");
        }
        
        return 0; // Valid signature
    }
    
    /**
     * @dev Execute a function call
     * @param target The address to call
     * @param value The value to send with the call
     * @param data The data to send with the call
     * @return result The result of the call
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwnerOrEntryPoint returns (bytes memory result) {
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "execution failed");
        
        emit Executed(target, value, data);
        return returnData;
    }
    
    /**
     * @dev Update the owner of the account
     * @param newOwner The new owner
     */
    function updateOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "new owner cannot be zero address");
        
        address oldOwner = owner;
        owner = newOwner;
        
        emit OwnerUpdated(oldOwner, newOwner);
    }
    
    /**
     * @dev Update the platform address
     * @param newPlatform The new platform address
     */
    function updatePlatform(address newPlatform) external onlyOwner {
        require(newPlatform != address(0), "new platform cannot be zero address");
        
        address oldPlatform = platform;
        platform = newPlatform;
        
        emit PlatformUpdated(oldPlatform, newPlatform);
    }
    
    /**
     * @dev Get the account's balance
     * @return The account's balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

//-----------------------------------------------------------------------------
// ACCOUNT FACTORY
//-----------------------------------------------------------------------------

/**
 * @title DermaDAOAccountFactory
 * @dev Factory contract to create DermaDAOAccount instances
 */
contract DermaDAOAccountFactory {
    IEntryPoint public immutable entryPoint;
    address public platform; // No longer immutable
    address public owner;
    
    event AccountCreated(address indexed account, address indexed owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PlatformUpdated(address indexed oldPlatform, address indexed newPlatform);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }
    
    constructor(IEntryPoint _entryPoint, address _platform) {
        entryPoint = _entryPoint;
        owner = msg.sender; // Owner is deployer
        platform = _platform != address(0) ? _platform : msg.sender; // If platform is zero, use owner
    }
    
    /**
     * @dev Create a new account
     * @param owner The owner of the account
     * @param salt A salt to determine the account's address
     * @return account The address of the created account
     */
    function createAccount(address owner, uint256 salt) external returns (address) {
        address account = getAddress(owner, salt);
        uint256 codeSize = account.code.length;
        if (codeSize > 0) {
            return account;
        }
        
        account = address(new DermaDAOAccount{salt: bytes32(salt)}(
            entryPoint,
            owner,
            platform
        ));
        
        emit AccountCreated(account, owner);
        return account;
    }
    
    /**
     * @dev Get the counterfactual address of an account
     * @param owner The owner of the account
     * @param salt A salt to determine the account's address
     * @return The address of the account
     */
    function getAddress(address owner, uint256 salt) public view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            bytes32(salt),
            keccak256(abi.encodePacked(
                type(DermaDAOAccount).creationCode,
                abi.encode(entryPoint, owner, platform)
            ))
        )))));
    }
    
    /**
     * @dev Update the platform address
     * @param newPlatform The new platform address
     */
    function updatePlatform(address newPlatform) external onlyOwner {
        require(newPlatform != address(0), "new platform cannot be zero address");
        
        address oldPlatform = platform;
        platform = newPlatform;
        
        emit PlatformUpdated(oldPlatform, newPlatform);
    }
    
    /**
     * @dev Transfer ownership of the factory
     * @param newOwner The new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "new owner cannot be zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

//-----------------------------------------------------------------------------
// PAYMASTER
//-----------------------------------------------------------------------------

/**
 * @title DermaDAOPaymaster
 * @dev Paymaster contract to sponsor gas fees for DermaDAO users
 */
contract DermaDAOPaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    address public owner;
    
    mapping(address => bool) public allowedAccounts;
    mapping(address => bool) public allowedTargets;
    mapping(address => uint256) public accountUsage;
    
    uint256 public dailyAccountLimit = 0.01 ether;
    
    event DepositedToEntryPoint(address indexed account, uint256 amount);
    event SponsoredGasFees(address indexed account, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }
    
    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
        owner = msg.sender; // Owner is deployer
    }
    
    receive() external payable {
        depositToEntryPoint(msg.value);
    }
    
    /**
     * @dev Deposit funds to the EntryPoint
     * @param amount The amount to deposit
     */
    function depositToEntryPoint(uint256 amount) public payable {
        require(msg.value >= amount, "insufficient funds");
        entryPoint.depositTo{value: amount}(address(this));
        emit DepositedToEntryPoint(msg.sender, amount);
    }
    
    /**
     * @dev Set an account's allowance
     * @param account The account to set allowance for
     * @param allowed Whether the account is allowed
     */
    function setAccountAllowance(address account, bool allowed) external onlyOwner {
        allowedAccounts[account] = allowed;
    }
    
    /**
     * @dev Set a target's allowance
     * @param target The target to set allowance for
     * @param allowed Whether the target is allowed
     */
    function setTargetAllowance(address target, bool allowed) external onlyOwner {
        allowedTargets[target] = allowed;
    }
    
    /**
     * @dev Set the daily limit per account
     * @param limit The new daily limit
     */
    function setDailyLimit(uint256 limit) external onlyOwner {
        dailyAccountLimit = limit;
    }
    
    /**
     * @dev Reset an account's usage
     * @param account The account to reset
     */
    function resetAccountUsage(address account) external onlyOwner {
        accountUsage[account] = 0;
    }
    
    /**
     * @dev Transfer ownership of the paymaster
     * @param newOwner The new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "new owner cannot be zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @dev Withdraw funds from the EntryPoint
     * @param amount The amount to withdraw
     * @param recipient The recipient of the funds
     */
    function withdrawFromEntryPoint(uint256 amount, address payable recipient) external onlyOwner {
        require(amount > 0, "amount must be greater than 0");
        require(recipient != address(0), "recipient cannot be zero address");
        
        // Get the deposit balance from the EntryPoint
        uint256 balance = entryPoint.balanceOf(address(this));
        require(amount <= balance, "insufficient balance in EntryPoint");
        
        // Withdraw the funds
        // Note: This is a simplified implementation
        // In practice, you'd need to follow the EntryPoint's withdrawal pattern
        
        // 1. Request withdrawal from EntryPoint to this contract
        // (EntryPoint interface would need a withdraw method)
        // entryPoint.withdraw(amount);
        
        // 2. Transfer the funds to the recipient
        (bool success,) = recipient.call{value: amount}("");
        require(success, "transfer failed");
    }
    
    /**
     * @dev Implementation of IPaymaster.validatePaymasterUserOp
     */
    function validatePaymasterUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        require(msg.sender == address(entryPoint), "only EntryPoint can call");
        
        address sender = userOp.sender;
        
        // Check if the account is allowed to use this paymaster
        require(allowedAccounts[sender], "account not allowed");
        
        // Check if the account has exceeded its daily limit
        require(accountUsage[sender] + maxCost <= dailyAccountLimit, "daily limit exceeded");
        
        // Update account usage
        accountUsage[sender] += maxCost;
        
        // Return empty context and valid (0) validationData
        return (abi.encode(sender, maxCost), 0);
    }
    
    /**
     * @dev Implementation of IPaymaster.postOp
     */
    function postOp(
        uint8 mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override {
        require(msg.sender == address(entryPoint), "only EntryPoint can call");
        
        (address sender, uint256 maxCost) = abi.decode(context, (address, uint256));
        
        // Adjust account usage to actual cost (which may be less than max)
        if (actualGasCost < maxCost) {
            accountUsage[sender] -= (maxCost - actualGasCost);
        }
        
        emit SponsoredGasFees(sender, actualGasCost);
    }
}

//-----------------------------------------------------------------------------
// PROJECT WALLET
//-----------------------------------------------------------------------------

/**
 * @title ProjectWallet
 * @dev Wallet for charity projects with milestone-based fund release
 */
contract ProjectWallet {
    address public owner; // Owner of the platform
    address public platform; // Platform address (can be set later)
    address public charityAdmin;
    uint256 public projectId;
    
    enum ProposalStatus { Pending, Approved, Rejected, Executed }
    
    struct Proposal {
        uint256 id;
        string description;
        string evidenceIpfsHash;
        uint256 amount;
        address payable destinationAccount;
        ProposalStatus status;
        uint256 createdAt;
        uint256 executedAt;
    }
    
    Proposal[] public proposals;
    
    event FundsReceived(address sender, uint256 amount);
    event ProposalCreated(uint256 indexed proposalId, uint256 amount, address destination);
    event ProposalStatusChanged(uint256 indexed proposalId, ProposalStatus status);
    event FundsReleased(uint256 indexed proposalId, address destination, uint256 amount);
    event PlatformUpdated(address indexed oldPlatform, address indexed newPlatform);
    event CharityAdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner can call");
        _;
    }
    
    modifier onlyPlatform() {
        require(msg.sender == platform, "only platform can call");
        _;
    }
    
    modifier onlyOwnerOrPlatform() {
        require(msg.sender == owner || msg.sender == platform, "only owner or platform can call");
        _;
    }
    
    modifier onlyCharityAdmin() {
        require(msg.sender == charityAdmin, "only charity admin can call");
        _;
    }
    
    constructor() {
        // Empty constructor, will be initialized after deployment
    }
    
    /**
     * @dev Initialize the wallet after deployment
     * @param _charityAdmin The charity admin
     * @param _projectId The project ID
     */
    function initialize(address _charityAdmin, uint256 _projectId) external {
        require(owner == address(0), "already initialized");
        owner = msg.sender;
        platform = msg.sender; // Initially, platform is the same as owner (deployer)
        charityAdmin = _charityAdmin;
        projectId = _projectId;
    }
    
    /**
     * @dev Create a withdrawal proposal
     * @param description The proposal description
     * @param evidenceIpfsHash IPFS hash of evidence for milestone completion
     * @param amount The amount to withdraw
     * @param destinationAccount The destination account for the funds
     * @return proposalId The ID of the created proposal
     */
    function createProposal(
        string calldata description,
        string calldata evidenceIpfsHash,
        uint256 amount,
        address payable destinationAccount
    ) external onlyCharityAdmin returns (uint256) {
        require(amount > 0, "amount must be greater than 0");
        require(amount <= address(this).balance, "insufficient funds");
        require(destinationAccount != address(0), "destination cannot be zero address");
        
        uint256 proposalId = proposals.length;
        
        proposals.push(Proposal({
            id: proposalId,
            description: description,
            evidenceIpfsHash: evidenceIpfsHash,
            amount: amount,
            destinationAccount: destinationAccount,
            status: ProposalStatus.Pending,
            createdAt: block.timestamp,
            executedAt: 0
        }));
        
        emit ProposalCreated(proposalId, amount, destinationAccount);
        
        return proposalId;
    }
    
    /**
     * @dev Update a proposal's status
     * @param proposalId The proposal ID
     * @param status The new status
     */
    function updateProposalStatus(uint256 proposalId, ProposalStatus status) external onlyOwnerOrPlatform {
        require(proposalId < proposals.length, "proposal does not exist");
        require(proposals[proposalId].status == ProposalStatus.Pending, "proposal not pending");
        
        proposals[proposalId].status = status;
        
        emit ProposalStatusChanged(proposalId, status);
    }
    
    /**
     * @dev Execute a proposal to release funds
     * @param proposalId The proposal ID
     */
    function executeProposal(uint256 proposalId) external onlyOwnerOrPlatform {
        require(proposalId < proposals.length, "proposal does not exist");
        require(proposals[proposalId].status == ProposalStatus.Approved, "proposal not approved");
        
        Proposal storage proposal = proposals[proposalId];
        
        require(address(this).balance >= proposal.amount, "insufficient funds");
        
        proposal.status = ProposalStatus.Executed;
        proposal.executedAt = block.timestamp;
        
        (bool success, ) = proposal.destinationAccount.call{value: proposal.amount}("");
        require(success, "transfer failed");
        
        emit FundsReleased(proposalId, proposal.destinationAccount, proposal.amount);
    }
    
    /**
     * @dev Update the platform address
     * @param newPlatform The new platform address
     */
    function updatePlatform(address newPlatform) external onlyOwner {
        require(newPlatform != address(0), "new platform cannot be zero address");
        address oldPlatform = platform;
        platform = newPlatform;
        emit PlatformUpdated(oldPlatform, newPlatform);
    }
    
    /**
     * @dev Update the charity admin
     * @param newCharityAdmin The new charity admin
     */
    function updateCharityAdmin(address newCharityAdmin) external onlyOwnerOrPlatform {
        require(newCharityAdmin != address(0), "new charity admin cannot be zero address");
        address oldAdmin = charityAdmin;
        charityAdmin = newCharityAdmin;
        emit CharityAdminUpdated(oldAdmin, newCharityAdmin);
    }
    
    /**
     * @dev Get the wallet's balance
     * @return The wallet's balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get the number of proposals
     * @return The number of proposals
     */
    function getProposalCount() external view returns (uint256) {
        return proposals.length;
    }
}