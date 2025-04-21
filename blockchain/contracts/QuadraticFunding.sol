// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title QuadraticFundingPool
 * @dev Manages quadratic funding pools with simplified structure (no rounds)
 */
contract QuadraticFundingPool {
    address public platform;
    address public owner;
    
    struct Pool {
        uint256 id;
        string name;
        string description;
        address sponsor;
        uint256 startTime;
        uint256 endTime;
        uint256 totalFunds;
        bool distributed;
    }
    
    struct Donation {
        address donor;
        uint256 projectId;
        uint256 amount;
        uint256 poolId;
    }
    
    Pool[] public pools;
    Donation[] public donations;
    
    // poolId => projectId => total donations
    mapping(uint256 => mapping(uint256 => uint256)) public projectDonationSum;
    
    // poolId => projectId => count of unique contributors
    mapping(uint256 => mapping(uint256 => uint256)) public projectUniqueContributors;
    
    // poolId => donor => projectId => has contributed
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public hasContributed;
    
    // poolId => projectId => allocation
    mapping(uint256 => mapping(uint256 => uint256)) public projectAllocations;
    
    // projectId => poolId => is project in pool
    mapping(uint256 => mapping(uint256 => bool)) public projectInPool;
    
    event PoolCreated(uint256 indexed poolId, string name, address indexed sponsor, uint256 duration);
    event PoolContribution(address indexed contributor, uint256 indexed poolId, uint256 amount);
    event DonationRecorded(address indexed donor, uint256 indexed projectId, uint256 amount, uint256 indexed poolId);
    event FundsDistributed(uint256 indexed poolId);
    event ProjectAllocation(uint256 indexed poolId, uint256 indexed projectId, uint256 amount);
    event PlatformUpdated(address indexed oldPlatform, address indexed newPlatform);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyPlatform() {
        require(msg.sender == platform, "only platform can call");
        _;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner can call");
        _;
    }
    
    modifier onlyOwnerOrPlatform() {
        require(msg.sender == owner || msg.sender == platform, "only owner or platform can call");
        _;
    }
    
    constructor(address _platform) {
        owner = msg.sender;
        platform = _platform != address(0) ? _platform : msg.sender;
        // No default pool creation
    }
    
    /**
     * @dev Create a new funding pool
     * @param name The name of the pool
     * @param description The description of the pool
     * @param sponsor The sponsor of the pool
     * @param duration The pool duration in seconds
     * @return poolId The ID of the created pool
     */
    function createPool(
        string calldata name,
        string calldata description,
        address sponsor,
        uint256 duration
    ) external onlyOwnerOrPlatform returns (uint256) {
        return _createPool(name, description, sponsor, duration);
    }
    
    /**
     * @dev Internal function to create a new pool
     */
    function _createPool(
        string memory name,
        string memory description,
        address sponsor,
        uint256 duration
    ) internal returns (uint256) {
        require(bytes(name).length > 0, "name cannot be empty");
        require(bytes(description).length > 0, "description cannot be empty");
        require(sponsor != address(0), "sponsor cannot be zero address");
        require(duration > 0, "duration must be greater than 0");
        
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;
        uint256 poolId = pools.length;
        
        pools.push(Pool({
            id: poolId,
            name: name,
            description: description,
            sponsor: sponsor,
            startTime: startTime,
            endTime: endTime,
            totalFunds: 0,
            distributed: false
        }));
        
        emit PoolCreated(poolId, name, sponsor, duration);
        
        return poolId;
    }
    
    /**
     * @dev Donate ETH to a specific pool
     * @param poolId The pool ID
     */
    function donateToPool(uint256 poolId) external payable {
        require(poolId < pools.length, "pool does not exist");
        require(msg.value > 0, "amount must be greater than 0");
        require(!pools[poolId].distributed, "pool already distributed");
        require(block.timestamp <= pools[poolId].endTime, "pool ended");
        
        pools[poolId].totalFunds += msg.value;
        
        emit PoolContribution(msg.sender, poolId, msg.value);
    }
    
    /**
     * @dev Receive function to add funds to a specified pool
     * Must use donateToPool() instead since there's no default pool
     */
    receive() external payable {
        revert("Use donateToPool(poolId) to specify which pool to donate to");
    }

    /**
     * @dev Update the platform address
     * @param _newPlatform The new platform address
     */
    function updatePlatform(address _newPlatform) external onlyOwnerOrPlatform {
        require(_newPlatform != address(0), "new platform cannot be zero address");
        address oldPlatform = platform;
        platform = _newPlatform;
        emit PlatformUpdated(oldPlatform, _newPlatform);
    }
    
    /**
     * @dev Transfer ownership of the funding pool
     * @param newOwner The new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "new owner cannot be zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @dev Add a project to a pool
     * @param projectId The project ID
     * @param poolId The pool ID
     */
    function addProjectToPool(uint256 projectId, uint256 poolId) external onlyPlatform {
        require(poolId < pools.length, "pool does not exist");
        require(!pools[poolId].distributed, "pool already distributed");
        
        projectInPool[projectId][poolId] = true;
    }
    
    /**
     * @dev Record a donation for quadratic funding calculation
     * @param donor The donor
     * @param projectId The project ID
     * @param poolId The pool ID
     * @param amount The donation amount
     */
    function recordDonation(
        address donor,
        uint256 projectId,
        uint256 poolId,
        uint256 amount
    ) external onlyPlatform {
        require(poolId < pools.length, "pool does not exist");
        require(projectInPool[projectId][poolId], "project not in this pool");
        require(!pools[poolId].distributed, "pool already distributed");
        require(block.timestamp >= pools[poolId].startTime && block.timestamp <= pools[poolId].endTime, "pool not active");
        
        // Record the donation
        donations.push(Donation({
            donor: donor,
            projectId: projectId,
            amount: amount,
            poolId: poolId
        }));
        
        // Update project donation sum
        projectDonationSum[poolId][projectId] += amount;
        
        // Update unique contributors count
        if (!hasContributed[poolId][donor][projectId]) {
            hasContributed[poolId][donor][projectId] = true;
            projectUniqueContributors[poolId][projectId]++;
        }
        
        emit DonationRecorded(donor, projectId, amount, poolId);
    }
    
    /**
     * @dev Calculate and distribute quadratic funding for a specific pool
     * @param poolId The pool ID
     * @param projectIds Array of project IDs to calculate funding for
     * @param destinations Array of destination addresses for each project
     * @return allocations Array of allocated amounts
     */
    function distributeQuadraticFunding(
        uint256 poolId,
        uint256[] calldata projectIds,
        address payable[] calldata destinations
    ) external onlyOwnerOrPlatform returns (uint256[] memory) {
        require(poolId < pools.length, "pool does not exist");
        require(projectIds.length == destinations.length, "array length mismatch");
        require(!pools[poolId].distributed, "pool already distributed");
        
        Pool storage pool = pools[poolId];
        uint256 totalFunds = pool.totalFunds;
        require(totalFunds > 0, "no funds in pool");
        
        // Calculate quadratic funding allocations
        uint256[] memory sumOfSquareRoots = new uint256[](projectIds.length);
        uint256 totalSumOfSquareRoots = 0;
        
        // Calculate square roots of donations for each project
        for (uint256 i = 0; i < projectIds.length; i++) {
            uint256 projectId = projectIds[i];
            
            // Check if project is in this pool
            require(projectInPool[projectId][poolId], "project not in this pool");
            
            uint256 donationSum = projectDonationSum[poolId][projectId];
            
            if (donationSum > 0) {
                // Calculate the square root of the donation sum
                uint256 sqrtSum = sqrt(donationSum);
                sumOfSquareRoots[i] = sqrtSum;
                totalSumOfSquareRoots += sqrtSum;
            }
        }
        
        // Allocate and distribute funds
        uint256[] memory allocations = new uint256[](projectIds.length);
        
        if (totalSumOfSquareRoots > 0) {
            for (uint256 i = 0; i < projectIds.length; i++) {
                uint256 projectId = projectIds[i];
                if (sumOfSquareRoots[i] > 0) {
                    allocations[i] = (totalFunds * sumOfSquareRoots[i]) / totalSumOfSquareRoots;
                    
                    // Store the allocation amount
                    projectAllocations[poolId][projectId] = allocations[i];
                    
                    // Emit event for allocation
                    emit ProjectAllocation(poolId, projectId, allocations[i]);
                    
                    // Transfer funds to the destination
                    if (allocations[i] > 0) {
                        (bool success, ) = destinations[i].call{value: allocations[i]}("");
                        require(success, "transfer failed");
                    }
                }
            }
        }
        
        // Mark pool as distributed
        pool.distributed = true;
        
        emit FundsDistributed(poolId);
        
        return allocations;
    }
    
    /**
     * @dev End the pool early by setting its end time to now
     * @param poolId The pool ID to end
     */
    function endPoolEarly(uint256 poolId) external onlyOwnerOrPlatform {
        require(poolId < pools.length, "pool does not exist");
        require(!pools[poolId].distributed, "pool already distributed");
        require(pools[poolId].endTime > block.timestamp, "pool already ended");
        
        pools[poolId].endTime = block.timestamp;
    }
    
    /**
     * @dev Get project allocation for a specific pool
     * @param poolId The pool ID
     * @param projectId The project ID
     * @return The allocation amount
     */
    function getProjectAllocation(uint256 poolId, uint256 projectId) external view returns (uint256) {
        return projectAllocations[poolId][projectId];
    }
    
    /**
     * @dev Get all project allocations for a pool
     * @param poolId The pool ID
     * @param projectIds Array of project IDs to get allocations for
     * @return Array of allocation amounts
     */
    function getPoolAllocations(uint256 poolId, uint256[] calldata projectIds) external view returns (uint256[] memory) {
        uint256[] memory allocations = new uint256[](projectIds.length);
        
        for (uint256 i = 0; i < projectIds.length; i++) {
            allocations[i] = projectAllocations[poolId][projectIds[i]];
        }
        
        return allocations;
    }
    
    /**
     * @dev Get pool info
     * @param poolId The pool ID
     * @return name The pool name
     * @return description The pool description
     * @return sponsor The pool sponsor
     * @return startTime The start time
     * @return endTime The end time
     * @return totalFunds The total funds
     * @return distributed Whether the pool has been distributed
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
        require(poolId < pools.length, "pool does not exist");
        Pool storage pool = pools[poolId];
        
        return (
            pool.name,
            pool.description,
            pool.sponsor,
            pool.startTime,
            pool.endTime,
            pool.totalFunds,
            pool.distributed
        );
    }
    
    /**
     * @dev Get the number of pools
     * @return The number of pools
     */
    function getPoolCount() external view returns (uint256) {
        return pools.length;
    }
    
    /**
     * @dev Square root function using the Babylonian method
     * @param x The number to calculate the square root of
     * @return y The square root of x
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        else if (x <= 3) return 1;
        
        uint256 z = (x + 1) / 2;
        y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}