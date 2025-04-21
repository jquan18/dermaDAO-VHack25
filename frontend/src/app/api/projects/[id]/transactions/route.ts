import { NextResponse } from 'next/server';
import { db } from '@/lib/db'; // Assuming db setup is in lib/db
import { ethers } from 'ethers'; // For Wei to ETH conversion

// Helper function to validate address (optional but good practice)
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
      select: { wallet_address: true } // Only select the needed field
    });

    if (!project) {
      return NextResponse.json({ success: false, error: { message: 'Project not found' } }, { status: 404 });
    }

    if (!project.wallet_address || !isValidAddress(project.wallet_address)) {
       console.error(`Project ${projectId} has missing or invalid wallet address: ${project.wallet_address}`);
       return NextResponse.json({ success: false, error: { message: 'Project wallet address is missing or invalid' } }, { status: 400 });
    }

    // 2. Fetch transactions from Scrollscan API
    const scrollscanUrl = `https://api.scrollscan.com/api?module=account&action=txlist&address=${project.wallet_address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${scrollscanApiKey}`;

    const scrollscanResponse = await fetch(scrollscanUrl);

    if (!scrollscanResponse.ok) {
      console.error(`Scrollscan API error: ${scrollscanResponse.status} ${scrollscanResponse.statusText}`);
      // Try to parse error body if available
      let errorBody = 'Failed to fetch transactions from Scrollscan';
      try {
          const body = await scrollscanResponse.json();
          errorBody = body?.message || body?.result || errorBody;
      } catch(e) { /* ignore parsing error */ }
      return NextResponse.json({ success: false, error: { message: errorBody } }, { status: scrollscanResponse.status });
    }

    const scrollscanData = await scrollscanResponse.json();

    // Check for specific errors returned in the JSON payload
    if (scrollscanData.status === "0") {
        // status "0" indicates an error according to Etherscan API docs
        console.error(`Scrollscan API returned error: ${scrollscanData.message}`, scrollscanData.result);
        // Provide a more specific error message if possible
        let errorMessage = 'Failed to retrieve transactions';
        if (scrollscanData.message === 'NOTOK' && typeof scrollscanData.result === 'string') {
            errorMessage = scrollscanData.result; // e.g., "Error! Invalid address format"
        } else if (scrollscanData.message) {
            errorMessage = scrollscanData.message;
        }
        return NextResponse.json({ success: false, error: { message: errorMessage } }, { status: 400 });
    }

    if (!scrollscanData.result || !Array.isArray(scrollscanData.result)) {
        console.error('Unexpected response format from Scrollscan:', scrollscanData);
        return NextResponse.json({ success: false, error: { message: 'Unexpected response format from Scrollscan' } }, { status: 500 });
    }

    // 3. Format and return the transactions
    const transactions = scrollscanData.result.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value), // Convert Wei to ETH
        timeStamp: parseInt(tx.timeStamp, 10), // Ensure timestamp is a number
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei'), // Format gas price
    }));

    return NextResponse.json({ success: true, data: transactions });

  } catch (error: any) {
    console.error(`Error fetching transactions for project ${projectId}:`, error);
    // Distinguish between known errors and generic server errors
    if (error.message.includes('Project not found')) {
         return NextResponse.json({ success: false, error: { message: 'Project not found' } }, { status: 404 });
    }
    if (error.message.includes('wallet address is missing or invalid')) {
         return NextResponse.json({ success: false, error: { message: 'Project wallet address is missing or invalid' } }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
  }
} 