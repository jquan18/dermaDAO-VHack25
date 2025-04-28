const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function testContract() {
  try {
    // Load ABI
    const platformAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/abi/Platform.json'), 'utf8'));

    // Setup provider and wallet
    const url = 'https://sepolia-rpc.scroll.io/';
    console.log('Connecting to RPC URL:', url);
    
    const provider = new ethers.JsonRpcProvider(url);
    const network = await provider.getNetwork();
    console.log('Connected to network:', network.name, network.chainId);
    
    // Create read-only contract instance
    const platformAddress = '0xa7f9b6d74C3A4F86b1813A186Cb417e4860988b5';
    const platformReadOnly = new ethers.Contract(platformAddress, platformAbi, provider);
    console.log('Platform contract address:', platformAddress);

    // Check owner
    const owner = await platformReadOnly.owner();
    console.log('Platform contract owner:', owner);
    
    // Our private key
    const privateKey = '0x3c9832e74a3be28ad5d44180d1a8549ab596798b44860beb173c6d40171dc807';
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log('Our wallet address:', wallet.address);
    
    // Check if our wallet is the owner
    const isOwner = owner.toLowerCase() === wallet.address.toLowerCase();
    console.log('Are we the owner?', isOwner);
    
    if (isOwner) {
      // Create contract instance with signer
      const platform = platformReadOnly.connect(wallet);
      
      // Generate sample data
      const testHash = '0x' + Buffer.from('test@example.com').toString('hex');
      const testSalt = 123456;
      console.log('Test email hash:', testHash);
      console.log('Test salt:', testSalt);
      
      // Check if user exists
      const existingAddress = await platform.getUserAccount(testHash);
      console.log('Existing user address:', existingAddress);
      
      if (existingAddress === '0x0000000000000000000000000000000000000000') {
        console.log('User does not exist, will try to register');
        
        // Estimate gas for the registerUser transaction
        try {
          const gasEstimate = await platform.registerUser.estimateGas(testHash, testSalt);
          console.log('Gas estimate for registerUser:', gasEstimate.toString());
          
          // Call the registerUser function
          const tx = await platform.registerUser(testHash, testSalt);
          console.log('Transaction sent with hash:', tx.hash);
          
          // Wait for transaction to be mined
          const receipt = await tx.wait();
          console.log('Transaction confirmed in block:', receipt.blockNumber);
          
          // Check the address again
          const newAddress = await platform.getUserAccount(testHash);
          console.log('New user address:', newAddress);
        } catch (txError) {
          console.error('Transaction error:', txError.message);
          if (txError.reason) console.error('Reason:', txError.reason);
          if (txError.code) console.error('Code:', txError.code);
          
          // If we get "only owner" but we are the owner, there might be a Paymaster issue
          if (txError.reason?.includes('only owner')) {
            console.log('Trying to register with low-level call to bypass Paymaster...');
            
            // Look for the registerUser function directly without paymaster
            try {
              // Try a direct call with gas and gasPrice set
              const tx = await platform.registerUser(testHash, testSalt, {
                gasLimit: 500000, // Manual gas limit
                gasPrice: ethers.parseUnits('20', 'gwei') // Manual gas price
              });
              console.log('Direct transaction sent with hash:', tx.hash);
              
              // Wait for transaction to be mined
              const receipt = await tx.wait();
              console.log('Transaction confirmed in block:', receipt.blockNumber);
              
              // Check the address again
              const newAddress = await platform.getUserAccount(testHash);
              console.log('New user address:', newAddress);
            } catch (directError) {
              console.error('Direct call error:', directError.message);
            }
          }
        }
      } else {
        console.log('User already exists with address:', existingAddress);
      }
    } else {
      console.error('Cannot register user - wallet is not the contract owner');
    }
  } catch (error) {
    console.error('Error:', error);
    
    // Show more details if available
    if (error.error) console.error('Details:', error.error);
    if (error.code) console.error('Error code:', error.code);
  }
}

testContract().then(() => {
  console.log('Test completed');
}).catch(error => {
  console.error('Unexpected error:', error);
}); 