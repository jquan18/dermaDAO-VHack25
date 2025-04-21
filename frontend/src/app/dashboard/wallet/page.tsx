"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { walletApi } from "@/lib/api";
import { CopyIcon, ExternalLink, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TransakFunding } from "@/components/wallet/transak-funding";
import { WorldcoinVerification } from "@/components/auth/WorldcoinVerification";
import dynamic from "next/dynamic";

// Define transaction type
interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  transaction_hash?: string;
  recipient?: string;
  project_name?: string;
  created_at: string;
  gas_used?: string;
  gas_price?: string;
  block_number?: string;
  nonce?: string;
  is_internal?: boolean;
  contract_address?: string;
  _raw?: any; // For debugging raw transaction data
}

// Dynamically import the layouts to avoid SSR issues
const DynamicDashboardLayout = dynamic(
  () => import("@/components/layout/dashboard-layout").then(mod => mod.DashboardLayout),
  { ssr: false }
);

const DynamicCorporateLayout = dynamic(
  () => import("@/app/dashboard/corporate/layout").then(mod => mod.default),
  { ssr: false }
);

export default function WalletPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const [walletBalance, setWalletBalance] = useState("0.00");
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [totalDonated, setTotalDonated] = useState(0);
  const [projectsSupported, setProjectsSupported] = useState(0);
  const [lastTransactionDate, setLastTransactionDate] = useState<string | null>(null);
  const [transactionNetwork, setTransactionNetwork] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [testApiUrl, setTestApiUrl] = useState<string | null>(null);
  const [isUsingTestWallet, setIsUsingTestWallet] = useState(false);
  const [transactionStats, setTransactionStats] = useState({
    total: 0,
    internal: 0,
    normal: 0
  });

  // Debug log for diagnosing corporate user wallet issues
  console.log('[WalletPage] Initializing wallet page with user:', {
    isAuthenticated,
    role: user?.role,
    hasWallet: !!user?.wallet_address,
    walletAddress: user?.wallet_address ? `${user.wallet_address.substring(0, 6)}...${user.wallet_address.substring(user.wallet_address.length - 4)}` : 'none'
  });

  useEffect(() => {
    fetchWalletData();
    
    // Force a debug check of user role
    if (isDebugMode && user) {
      console.log("Current user info:", {
        role: user.role, 
        isAuthenticated,
        wallet_address: user.wallet_address
      });
    }
  }, [isAuthenticated, user?.wallet_address, isDebugMode]);

  const fetchWalletData = async () => {
    if (!isAuthenticated) return;
    
    await Promise.all([
      fetchWalletBalance(),
      fetchTransactions()
    ]);
  };

  const fetchWalletBalance = async () => {
    try {
      setIsLoadingWallet(true);
      const response = await walletApi.getWalletBalance();
      
      if (response.success && response.data) {
        setWalletBalance(response.data.balance || "0.00");
      } else {
        setWalletBalance("0.00");
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      toast({
        title: "Error",
        description: "Failed to load wallet balance. Please try again later.",
        variant: "destructive",
      });
      setWalletBalance("0.00");
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const fetchTransactions = async () => {
    if (!user?.wallet_address) {
      console.log('No wallet address found, skipping transaction fetch');
      setIsLoadingTransactions(false);
      setTransactions([]);
      setTransactionError('No wallet address available');
      return;
    }
    
    setIsLoadingTransactions(true);
    try {
      console.log('Fetching transactions for address:', user.wallet_address);
      const response = await walletApi.getWalletDataFromScrollScan(user.wallet_address);
      console.log('Wallet data response:', response);
      
      if (response.success) {
        setTransactions(response.data.transactions);
        setTransactionNetwork(response.data.network);
        setTestApiUrl(response.data.debug.testUrl);
        setTransactionError(null);
        
        // Set balance from the API response
        if (response.data.balance) {
          console.log(`Setting balance from API: ${response.data.balance} ETH`);
          setWalletBalance(response.data.balance);
        } else {
          console.warn('No balance found in API response');
        }
        
        // Calculate transaction statistics
        const internalCount = response.data.transactions.filter((tx: Transaction) => tx.is_internal).length;
        const normalCount = response.data.transactions.length - internalCount;
        
        setTransactionStats({
          total: response.data.transactions.length,
          internal: internalCount,
          normal: normalCount
        });
        
        // Set test URL if available
        if (response.data.debug.testUrl) {
          console.log(`Test URL: ${response.data.debug.testUrl}`);
          setTestApiUrl(response.data.debug.testUrl);
        } else {
          console.log('No test URL in response');
        }
        
        // Check if we're using a test wallet
        if (response.data.debug.note === 'Using test wallet address') {
          console.log('Using test wallet address');
          setIsUsingTestWallet(true);
        } else {
          setIsUsingTestWallet(false);
        }
        
        // Calculate transaction stats
        const stats = calculateTransactionStats(response.data.transactions);
        setTotalDonated(stats.totalDonated);
        setProjectsSupported(stats.projectsSupported);
        setLastTransactionDate(stats.lastTransactionDate);
      } else {
        console.warn('Failed to fetch wallet data:', response);
        setTransactionError(response.error?.message || 'Failed to fetch wallet data');
        toast({
          title: 'Error',
          description: 'Failed to fetch wallet data. Please try again later.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      setTransactionError(error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Error',
        description: 'Failed to fetch wallet data. Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingTransactions(false);
    }
  };
  
  const calculateTransactionStats = (txData: Transaction[]) => {
    console.log('Calculating transaction stats for:', txData.length, 'transactions');
    
    // Calculate total donated (sum of all donation transactions)
    const donated = txData
      .filter((tx: Transaction) => tx.type === 'donation' || (tx.type === 'transfer' && tx.amount > 0))
      .reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
    const totalDonated = parseFloat(donated.toFixed(4));
    
    // Count unique projects supported - with more detailed logging
    const donationTransactions = txData.filter((tx: Transaction) => 
      (tx.type === 'donation' || (tx.type === 'transfer' && tx.amount > 0))
    );
    
    console.log('Donation transactions:', donationTransactions.length);
    
    // Log each donation transaction to see if project_name is present
    donationTransactions.forEach((tx: Transaction, index: number) => {
      console.log(`Transaction ${index}:`, {
        type: tx.type,
        amount: tx.amount,
        project_name: tx.project_name || 'No project name',
        recipient: tx.recipient || 'No recipient'
      });
    });
    
    // Try to identify projects from transaction data
    const projectTransactions = donationTransactions.filter((tx: Transaction) => {
      // If project_name is available, use it
      if (tx.project_name) return true;
      
      // If recipient is available, try to use it as a project identifier
      if (tx.recipient) return true;
      
      return false;
    });
    
    console.log('Project transactions:', projectTransactions.length);
    
    // Create a set of unique project identifiers
    const uniqueProjects = new Set(
      projectTransactions.map((tx: Transaction) => {
        // Use project_name if available, otherwise use recipient
        return tx.project_name || tx.recipient || 'Unknown Project';
      })
    );
    
    const projectsSupported = uniqueProjects.size;
    console.log('Unique projects:', Array.from(uniqueProjects));
    console.log('Projects supported count:', projectsSupported);
    
    // Get last transaction date
    if (txData.length > 0) {
      const latestTx = txData.sort((a: Transaction, b: Transaction) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      
      const txDate = new Date(latestTx.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - txDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let lastTransactionDate: string | null = null;
      if (diffDays === 0) {
        lastTransactionDate = 'Today';
      } else if (diffDays === 1) {
        lastTransactionDate = 'Yesterday';
      } else {
        lastTransactionDate = `${diffDays} days ago`;
      }
      
      return {
        totalDonated,
        projectsSupported,
        lastTransactionDate,
      };
    } else {
      return {
        totalDonated,
        projectsSupported,
        lastTransactionDate: null,
      };
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
    });
  };

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-100 text-green-800';
      case 'donation':
        return 'bg-blue-100 text-blue-800';
      case 'transfer':
        return 'bg-gray-100 text-gray-800';
      case 'self':
        return 'bg-yellow-100 text-yellow-800';
      case 'contract_creation':
        return 'bg-purple-100 text-purple-800';
      case 'quadratic_distribution':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'Deposit';
      case 'donation':
        return 'Donation';
      case 'transfer':
        return 'Transfer';
      case 'self':
        return 'Self Transfer';
      case 'contract_creation':
        return 'Contract Created';
      case 'quadratic_distribution':
        return 'Quadratic Funding';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  // Use the appropriate layout based on user role
  const Layout = user?.role === "corporate" ? DynamicCorporateLayout : DynamicDashboardLayout;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Wallet</h1>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsDebugMode(!isDebugMode)}
            >
              {isDebugMode ? "Hide Debug" : "Debug Mode"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchWalletData}
            >
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Show debug info at the top if debug mode is enabled */}
        {isDebugMode && (
          <div className="mb-6 p-4 border rounded-lg bg-blue-50">
            <h2 className="text-lg font-semibold text-blue-700 mb-2">Debug Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Wallet Address:</strong> {user?.wallet_address || 'Not connected'}</p>
                <p><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
                <p><strong>User Role:</strong> {user?.role || 'Unknown'}</p>
                <p><strong>Balance:</strong> {walletBalance} ETH</p>
              </div>
              <div>
                <p><strong>Network:</strong> {transactionNetwork || 'Unknown'}</p>
                <p><strong>Transaction Count:</strong> {transactions.length}</p>
                <p><strong>Last API Error:</strong> {transactionError || 'None'}</p>
                <p><strong>API Endpoint:</strong> Internal transactions only (ERC4337 account)</p>
                {isUsingTestWallet && (
                  <p className="text-yellow-600 font-medium">Using test wallet address for demonstration</p>
                )}
              </div>
              {testApiUrl && (
                <div className="col-span-2">
                  <p className="font-medium text-blue-700">Test API URL (copy and open in browser):</p>
                  <div className="flex mt-1">
                    <input
                      type="text"
                      readOnly
                      className="w-full p-2 text-xs bg-white border rounded-l"
                      value={testApiUrl}
                    />
                    <Button 
                      size="sm"
                      className="rounded-l-none"
                      onClick={() => {
                        navigator.clipboard.writeText(testApiUrl);
                        toast({
                          title: "Copied!",
                          description: "API URL copied to clipboard",
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
              <div className="col-span-2 mt-2">
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.open(`https://sepolia.scrollscan.com/address/${user?.wallet_address}`, '_blank')}
                    disabled={!user?.wallet_address}
                  >
                    View on Sepolia
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.open(`https://sepolia.scrollscan.com/address/${user?.wallet_address}`, '_blank')}
                    disabled={!user?.wallet_address}
                  >
                    View on Mainnet
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle>Wallet Details</CardTitle>
              <CardDescription>Your Ethereum wallet information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-primary/5 p-6 rounded-lg space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-gray-500">Wallet Address</p>
                    {user?.wallet_address && (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => copyToClipboard(user.wallet_address || '')}
                          className="text-gray-500 hover:text-primary"
                          title="Copy to clipboard"
                        >
                          <CopyIcon size={16} />
                        </button>
                        <a 
                          href={`https://sepolia.scrollscan.com/address/${user.wallet_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-primary"
                          title="View on blockchain explorer"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    )}
                  </div>
                  {isLoadingWallet ? (
                    <Skeleton className="h-6 w-full" />
                  ) : (
                    <div>
                      {user?.wallet_address ? (
                        <p className="text-lg font-medium text-gray-800">
                          {user.wallet_address}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-lg font-medium text-gray-800">
                            No wallet connected
                          </p>
                          <p className="text-sm text-gray-500">
                            You need to connect or create a wallet to use donation features.
                          </p>
                          {user?.role === 'corporate' && (
                            <div className="border border-orange-200 bg-orange-50 rounded p-3 mt-2">
                              <p className="text-sm text-orange-800">
                                Corporate accounts should have a wallet automatically created during registration.
                                If your wallet is missing, please contact support.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                  {isLoadingWallet ? (
                    <Skeleton className="h-10 w-32" />
                  ) : (
                    <p className="text-3xl font-bold text-primary">{walletBalance} ETH</p>
                  )}
                </div>

                <div className="pt-4 flex space-x-4">
                  <TransakFunding onSuccess={() => fetchWalletBalance()} />
                  <Button 
                    variant="outline" 
                    className="flex-1" 
                    disabled={!user?.wallet_address}
                  >
                    Send ETH
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Wallet Stats</CardTitle>
              <CardDescription>Summary of your wallet activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Total Donations</p>
                  {isLoadingTransactions ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    <p className="text-2xl font-bold">{totalDonated} ETH</p>
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Projects Supported</p>
                  {isLoadingTransactions ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{projectsSupported}</p>
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Transaction Count</p>
                  {isLoadingTransactions ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total:</span>
                        <span className="text-lg font-bold">{transactionStats.total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Regular:</span>
                        <span className="text-lg font-bold">{transactionStats.normal}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Internal:</span>
                        <span className="text-lg font-bold">{transactionStats.internal}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Last Transaction</p>
                  {isLoadingTransactions ? (
                    <Skeleton className="h-6 w-24" />
                  ) : (
                    <p className="text-md font-medium">{lastTransactionDate || 'No transactions'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Worldcoin Verification */}
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle>Quadratic Funding Verification</CardTitle>
            <CardDescription>
              Verify your identity with Worldcoin to participate in quadratic funding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorldcoinVerification />
          </CardContent>
        </Card>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
            <TabsTrigger value="donations">Donations</TabsTrigger>
            <TabsTrigger value="internal">Internal</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Recent transactions from your wallet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-6">
                  <h2 className="text-xl font-semibold">Transaction History</h2>
                  
                  {isLoadingTransactions ? (
                    <div className="space-y-4">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : transactions.length > 0 ? (
                    <div className="space-y-4">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge className={getTransactionTypeColor(tx.type)}>
                                {getTransactionTypeLabel(tx.type)}
                              </Badge>
                              {tx.is_internal && (
                                <Badge className="bg-purple-100 text-purple-800">
                                  Internal
                                </Badge>
                              )}
                              <Badge className={getTransactionStatusColor(tx.status)}>
                                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{formatDate(tx.created_at)}</p>
                            {tx.project_name && (
                              <p className="text-sm font-medium mt-1">
                                Project: {tx.project_name}
                              </p>
                            )}
                            {tx.recipient && tx.type !== 'deposit' && (
                              <p className="text-xs text-gray-500 mt-1">
                                To: {truncateAddress(tx.recipient)}
                              </p>
                            )}
                            {tx.contract_address && (
                              <p className="text-xs text-gray-500 mt-1">
                                Contract: {truncateAddress(tx.contract_address)}
                              </p>
                            )}
                            {tx.block_number && (
                              <p className="text-xs text-gray-500 mt-1">
                                Block: {tx.block_number}
                              </p>
                            )}
                            {tx.transaction_hash && (
                              <div className="flex items-center mt-1">
                                <a
                                  href={`https://sepolia.scrollscan.com/tx/${tx.transaction_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center"
                                >
                                  {truncateAddress(tx.transaction_hash)}
                                  <ExternalLink size={12} className="ml-1" />
                                </a>
                              </div>
                            )}
                          </div>
                          <div className={`text-lg font-bold ${
                            tx.type === 'deposit' || tx.type === 'quadratic_distribution' ? 'text-green-600' : 
                            tx.type === 'contract_creation' ? 'text-yellow-600' : 
                            'text-gray-800'
                          }`}>
                            {tx.type === 'deposit' || tx.type === 'quadratic_distribution' ? '+' : 
                             tx.type === 'contract_creation' ? '' : 
                             '-'}{tx.amount > 0 ? tx.amount : '0.00'} {tx.currency}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center border rounded-lg bg-gray-50">
                      <p className="text-gray-500 mb-3">No transaction history found</p>
                      <p className="text-sm text-gray-400">
                        {user?.wallet_address ? 
                          "This wallet has no transactions on the Scroll network yet." : 
                          "Connect your wallet to view transaction history."}
                      </p>
                      
                      <div className="mt-4 text-xs text-left bg-blue-50 p-3 rounded border border-blue-100">
                        <p className="font-medium text-blue-700">Debugging information:</p>
                        <p className="text-blue-600 mt-1">Wallet address: {user?.wallet_address || 'Not connected'}</p>
                        <p className="text-blue-600 mt-1">
                          Networks checked: {transactionNetwork || 'Sepolia and Mainnet'}
                        </p>
                        {transactionError && (
                          <p className="text-red-600 mt-1">Error: {transactionError}</p>
                        )}
                        <p className="text-blue-600 mt-1">
                          Try viewing transactions on{' '}
                          {user?.wallet_address ? (
                            <>
                              <a 
                                href={`https://sepolia.scrollscan.com/address/${user.wallet_address}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                Sepolia ScrollScan
                              </a>
                              {' or '}
                              <a 
                                href={`https://sepolia.scrollscan.com/address/${user.wallet_address}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                Mainnet ScrollScan
                              </a>
                            </>
                          ) : 'ScrollScan (connect wallet first)'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="deposits" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Deposits</CardTitle>
                <CardDescription>Funds added to your wallet</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTransactions ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : transactions.filter(tx => tx.type === 'deposit').length > 0 ? (
                  <div className="space-y-4">
                    {transactions
                      .filter(tx => tx.type === 'deposit')
                      .map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge className={getTransactionStatusColor(tx.status)}>
                                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{formatDate(tx.created_at)}</p>
                            {tx.transaction_hash && (
                              <div className="flex items-center mt-1">
                                <a
                                  href={`https://sepolia.scrollscan.com/tx/${tx.transaction_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center"
                                >
                                  {truncateAddress(tx.transaction_hash)}
                                  <ExternalLink size={12} className="ml-1" />
                                </a>
                              </div>
                            )}
                          </div>
                          <div className={`text-lg font-bold ${
                            tx.type === 'deposit' || tx.type === 'quadratic_distribution' ? 'text-green-600' : 
                            tx.type === 'contract_creation' ? 'text-yellow-600' : 
                            'text-gray-800'
                          }`}>
                            {tx.type === 'deposit' || tx.type === 'quadratic_distribution' ? '+' : 
                             tx.type === 'contract_creation' ? '' : 
                             '-'}{tx.amount > 0 ? tx.amount : '0.00'} {tx.currency}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <h3 className="text-xl font-medium mb-2">No Deposits</h3>
                    <p className="text-gray-600 mb-4">
                      You haven't made any deposits yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="donations" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Donations</CardTitle>
                <CardDescription>Your contributions to projects</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTransactions ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : transactions.filter(tx => tx.type === 'donation').length > 0 ? (
                  <div className="space-y-4">
                    {transactions
                      .filter(tx => tx.type === 'donation')
                      .map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge className={getTransactionStatusColor(tx.status)}>
                                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{formatDate(tx.created_at)}</p>
                            {tx.project_name && (
                              <p className="text-sm font-medium mt-1">
                                Project: {tx.project_name}
                              </p>
                            )}
                            {tx.transaction_hash && (
                              <div className="flex items-center mt-1">
                                <a
                                  href={`https://sepolia.scrollscan.com/tx/${tx.transaction_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center"
                                >
                                  {truncateAddress(tx.transaction_hash)}
                                  <ExternalLink size={12} className="ml-1" />
                                </a>
                              </div>
                            )}
                          </div>
                          <div className={`text-lg font-bold ${
                            tx.type === 'deposit' || tx.type === 'quadratic_distribution' ? 'text-green-600' : 
                            tx.type === 'contract_creation' ? 'text-yellow-600' : 
                            'text-gray-800'
                          }`}>
                            {tx.type === 'deposit' || tx.type === 'quadratic_distribution' ? '+' : 
                             tx.type === 'contract_creation' ? '' : 
                             '-'}{tx.amount > 0 ? tx.amount : '0.00'} {tx.currency}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <h3 className="text-xl font-medium mb-2">No Donations</h3>
                    <p className="text-gray-600 mb-4">
                      You haven't made any donations yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="internal" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Internal Transactions</CardTitle>
                <CardDescription>Contract interactions and internal transfers</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTransactions ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : transactions.filter(tx => tx.is_internal).length > 0 ? (
                  <div className="space-y-4">
                    {transactions
                      .filter(tx => tx.is_internal)
                      .map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge className={getTransactionTypeColor(tx.type)}>
                                {getTransactionTypeLabel(tx.type)}
                              </Badge>
                              <Badge className={getTransactionStatusColor(tx.status)}>
                                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{formatDate(tx.created_at)}</p>
                            {tx.project_name && (
                              <p className="text-sm font-medium mt-1">
                                Project: {tx.project_name}
                              </p>
                            )}
                            {tx.recipient && (
                              <p className="text-xs text-gray-500 mt-1">
                                To: {truncateAddress(tx.recipient)}
                              </p>
                            )}
                            {tx.contract_address && (
                              <p className="text-xs text-gray-500 mt-1">
                                Contract: {truncateAddress(tx.contract_address)}
                              </p>
                            )}
                            {tx.transaction_hash && (
                              <div className="flex items-center mt-1">
                                <a
                                  href={`https://sepolia.scrollscan.com/tx/${tx.transaction_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center"
                                >
                                  {truncateAddress(tx.transaction_hash)}
                                  <ExternalLink size={12} className="ml-1" />
                                </a>
                              </div>
                            )}
                          </div>
                          <div className={`text-lg font-bold ${
                            tx.type === 'deposit' || tx.type === 'quadratic_distribution' ? 'text-green-600' : 
                            tx.type === 'contract_creation' ? 'text-yellow-600' : 
                            'text-gray-800'
                          }`}>
                            {tx.type === 'deposit' || tx.type === 'quadratic_distribution' ? '+' : 
                             tx.type === 'contract_creation' ? '' : 
                             '-'}{tx.amount > 0 ? tx.amount : '0.00'} {tx.currency}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <h3 className="text-xl font-medium mb-2">No Internal Transactions</h3>
                    <p className="text-gray-600 mb-4">
                      You haven't made any internal transactions yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add an additional debug section when in debug mode */}
        {isDebugMode && transactions.length > 0 && (
          <div className="mt-6 p-4 border rounded-lg bg-blue-50">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">Transaction Debug Data</h3>
            <div className="overflow-auto max-h-96 bg-white p-3 rounded">
              <pre className="text-xs">{JSON.stringify(transactions, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Troubleshooting section for wallet issues */}
        {(!user?.wallet_address || transactionError) && (
          <Card className="mt-8 border-orange-200">
            <CardHeader className="pb-2 bg-orange-50">
              <CardTitle className="text-orange-800">Wallet Troubleshooting</CardTitle>
              <CardDescription className="text-orange-700">
                Having issues with your wallet? Here are some tips to help you get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {!user?.wallet_address && (
                <div className="border-l-4 border-orange-400 pl-3 py-2">
                  <p className="text-sm font-medium">Missing Wallet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your account doesn't have a wallet address associated with it. This typically happens when:
                  </p>
                  <ul className="list-disc ml-5 mt-2 text-sm text-gray-600 space-y-1">
                    <li>Your wallet creation process was incomplete during registration</li>
                    <li>There was a connectivity issue with the blockchain during setup</li>
                    <li>You haven't completed the wallet connection process</li>
                  </ul>
                </div>
              )}

              {user?.role === 'corporate' && !user?.wallet_address && (
                <div className="border-l-4 border-blue-400 pl-3 py-2">
                  <p className="text-sm font-medium">Corporate Account Note</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Corporate accounts should have a wallet automatically created during the registration process.
                    If you're seeing this message, please try the following:
                  </p>
                  <ul className="list-disc ml-5 mt-2 text-sm text-gray-600 space-y-1">
                    <li>Log out and log back in to refresh your credentials</li>
                    <li>Contact support to manually create a wallet for your account</li>
                    <li>Try refreshing this page after a few minutes</li>
                  </ul>
                </div>
              )}

              {transactionError && (
                <div className="border-l-4 border-red-400 pl-3 py-2">
                  <p className="text-sm font-medium">Transaction Error</p>
                  <p className="text-sm text-gray-500 mt-1">
                    There was an error retrieving your wallet transactions:
                  </p>
                  <p className="text-sm bg-red-50 p-2 rounded mt-1 text-red-600">
                    {transactionError}
                  </p>
                </div>
              )}

              <div className="flex space-x-4 mt-4">
                <Button 
                  onClick={fetchWalletData} 
                  className="flex-1"
                >
                  Refresh Wallet Data
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
} 