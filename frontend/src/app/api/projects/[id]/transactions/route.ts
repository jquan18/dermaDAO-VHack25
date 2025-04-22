import { NextResponse } from 'next/server';
import { db } from '@/lib/db'; // Assuming db setup is in lib/db
import { ethers } from 'ethers'; // For Wei to ETH conversion

// Helper function to validate address
const isValidAddress = (address: string) => {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = parseInt(params.id, 10);
  const scrollscanApiKey = process.env.SCROLLSCAN_API_KEY;

  if (isNaN(projectId)) {
    return NextResponse.json({ success: false, error: { message: 'Invalid project ID format' } }, { status: 400 });
  }

  if (!scrollscanApiKey) {
    console.error('SCROLLSCAN_API_KEY is not set in environment variables.');
    return NextResponse.json({ success: false, error: { message: 'Server configuration error' } }, { status: 500 });
  }

  try {
    // 1. Fetch project details to get the wallet address
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { wallet_address: true, name: true } 
    });

    if (!project) {
      return NextResponse.json({ success: false, error: { message: 'Project not found' } }, { status: 404 });
    }

    if (!project.wallet_address || !isValidAddress(project.wallet_address)) {
      console.error(`Project ${projectId} has missing or invalid wallet address: ${project.wallet_address}`);
      return NextResponse.json({ success: false, error: { message: 'Project wallet address is missing or invalid' } }, { status: 400 });
    }

    // 2. Try both Sepolia and Mainnet networks
    const networks = [
      { name: 'Sepolia', url: `https://api-sepolia.scrollscan.com/api` },
      { name: 'Mainnet', url: `https://api.scrollscan.com/api` }
    ];

    let transactions = [];
    let networkUsed = '';

    for (const network of networks) {
      try {
        console.log(`Trying ${network.name} network for project ${projectId} transactions...`);
        
        // Fetch regular transactions
        const txUrl = `${network.url}?module=account&action=txlist&address=${project.wallet_address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${scrollscanApiKey}`;
        const txResponse = await fetch(txUrl);
        
        if (!txResponse.ok) {
          console.error(`${network.name} API error: ${txResponse.status}`);
          continue;
        }
        
        const txData = await txResponse.json();
        
        if (txData.status === '1' && Array.isArray(txData.result) && txData.result.length > 0) {
          console.log(`Found ${txData.result.length} transactions on ${network.name}`);
          
          // Format the transactions
          transactions = txData.result.map((tx: any) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: ethers.formatEther(tx.value), // Convert Wei to ETH
            timestamp: parseInt(tx.timeStamp, 10),
            blockNumber: tx.blockNumber,
            isIncoming: tx.to.toLowerCase() === project.wallet_address.toLowerCase(),
            isOutgoing: tx.from.toLowerCase() === project.wallet_address.toLowerCase(),
            gasUsed: tx.gasUsed,
            gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei')
          }));
          
          networkUsed = network.name;
          break; // Exit loop if we found transactions
        }
        
        // Also fetch internal transactions
        const internalTxUrl = `${network.url}?module=account&action=txlistinternal&address=${project.wallet_address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${scrollscanApiKey}`;
        const internalTxResponse = await fetch(internalTxUrl);
        
        if (internalTxResponse.ok) {
          const internalTxData = await internalTxResponse.json();
          
          if (internalTxData.status === '1' && Array.isArray(internalTxData.result) && internalTxData.result.length > 0) {
            console.log(`Found ${internalTxData.result.length} internal transactions on ${network.name}`);
            
            // Format and add internal transactions
            const internalTransactions = internalTxData.result.map((tx: any) => ({
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: ethers.formatEther(tx.value), // Convert Wei to ETH
              timestamp: parseInt(tx.timeStamp, 10),
              blockNumber: tx.blockNumber,
              isIncoming: tx.to.toLowerCase() === project.wallet_address.toLowerCase(),
              isOutgoing: tx.from.toLowerCase() === project.wallet_address.toLowerCase(),
              isInternal: true
            }));
            
            transactions = [...transactions, ...internalTransactions];
            
            // Sort by timestamp (newest first)
            transactions.sort((a, b) => b.timestamp - a.timestamp);
            
            networkUsed = network.name;
            break; // Exit loop if we found transactions
          }
        }
      } catch (error) {
        console.error(`Error fetching transactions from ${network.name}:`, error);
      }
    }

    // 3. If no transactions found, try to check if there are any local transactions in the database
    if (transactions.length === 0) {
      console.log(`No transactions found on blockchain for project ${projectId}, checking database...`);
      
      try {
        // Check for donations or other transactions in our database
        const dbTransactions = await db.transaction.findMany({
          where: {
            OR: [
              { to_address: project.wallet_address },
              { from_address: project.wallet_address }
            ]
          },
          orderBy: { created_at: 'desc' }
        });
        
        if (dbTransactions.length > 0) {
          console.log(`Found ${dbTransactions.length} transactions in database`);
          
          // Format database transactions
          transactions = dbTransactions.map((tx: any) => ({
            hash: tx.transaction_hash || `local-${tx.id}`,
            from: tx.from_address || 'Unknown',
            to: tx.to_address || project.wallet_address,
            value: tx.amount?.toString() || '0',
            timestamp: new Date(tx.created_at).getTime() / 1000,
            isIncoming: tx.to_address?.toLowerCase() === project.wallet_address.toLowerCase(),
            isOutgoing: tx.from_address?.toLowerCase() === project.wallet_address.toLowerCase(),
            status: tx.status || 'completed',
            source: 'database'
          }));
        }
      } catch (dbError) {
        console.error(`Error fetching transactions from database:`, dbError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        transactions,
        project_id: projectId,
        project_name: project.name,
        wallet_address: project.wallet_address,
        network: networkUsed || 'Database',
        count: transactions.length
      }
    });

  } catch (error: any) {
    console.error(`Error fetching transactions for project ${projectId}:`, error);
    return NextResponse.json({ 
      success: false, 
      error: { 
        message: error.message || 'Failed to fetch transactions' 
      }
    }, { status: 500 });
  }
} 