"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { projectsApi, walletApi, donationsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, ExternalLink, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AIVerificationBadge } from '@/components/projects/ai-verification-badge';
import { Skeleton } from "@/components/ui/skeleton";
import { formatEther } from "ethers";
import { BlurContainer } from "@/components/ui/blur-container";

// Define transaction interface similar to the wallet page
interface Transaction {
  id?: string;
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  amount?: number;
  type?: string;
  status?: string;
  timestamp?: number;
  block_number?: string;
  is_internal?: boolean;
  currency?: string;
  created_at?: string;
  transaction_hash?: string;
  is_database?: boolean;
  user_name?: string;
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [databaseDonations, setDatabaseDonations] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingDonations, setLoadingDonations] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [transactionNetwork, setTransactionNetwork] = useState<string>("sepolia");

  useEffect(() => {
    const fetchProjectDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await projectsApi.getProjectById(projectId);
        if (response.success) {
          setProject(response.data);
          // Fetch transactions if we have a wallet address
          if (response.data.wallet_address) {
            fetchTransactions(response.data.wallet_address);
          }
          
          // Also fetch donations from the database
          fetchDatabaseDonations(projectId);
        } else {
          setError(response.error?.message || "Failed to load project details");
        }
      } catch (err) {
        console.error("Error fetching project details:", err);
        setError("An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    const fetchTransactions = async (walletAddress: string) => {
      setLoadingTransactions(true);
      try {
        // Use the Sepolia network by default
        console.log(`Fetching transactions for wallet: ${walletAddress}`);
        const response = await walletApi.getWalletDataFromScrollScan(walletAddress, "sepolia");
        
        if (response.success && response.data && response.data.transactions) {
          console.log(`Found ${response.data.transactions.length} transactions`);
          // Log the first few transactions to help with debugging
          if (response.data.transactions.length > 0) {
            console.log('First transaction sample:', response.data.transactions[0]);
          }
          
          setTransactions(response.data.transactions);
          setTransactionNetwork(response.data.network || "sepolia");
        } else {
          console.error("Failed to load transactions:", response.error);
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
      } finally {
        setLoadingTransactions(false);
      }
    };
    
    // Fetch donations from the database
    const fetchDatabaseDonations = async (projectId: string) => {
      setLoadingDonations(true);
      try {
        console.log(`Fetching database donations for project: ${projectId}`);
        const response = await donationsApi.getProjectDonations(projectId);
        
        if (response.success && response.data && Array.isArray(response.data.donations)) {
          console.log(`Found ${response.data.donations.length} database donations`);
          
          // Get project info if needed
          let projectWalletAddress = project?.wallet_address;
          if (!projectWalletAddress && response.data.project) {
            projectWalletAddress = response.data.project.wallet_address;
          }
          
          // Convert database donations to Transaction format
          const donationTransactions = response.data.donations.map((donation: any) => ({
            id: donation.id.toString(),
            hash: donation.transaction_hash,
            from: donation.user_id ? `user-${donation.user_id}` : undefined,
            to: projectWalletAddress,
            amount: donation.amount,
            type: 'donation',
            status: 'completed',
            timestamp: new Date(donation.created_at).getTime() / 1000,
            is_database: true, // Flag to identify database records
            created_at: donation.created_at,
            user_name: donation.user_name || undefined, // Only set if available
            currency: 'ETH'
          }));
          
          setDatabaseDonations(donationTransactions);
        } else {
          console.error("Failed to load database donations:", response.error);
        }
      } catch (err) {
        console.error("Error fetching database donations:", err);
      } finally {
        setLoadingDonations(false);
      }
    };

    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  const handleApproveProject = async () => {
    if (!project || isVoting) return;
    
    setIsVoting(true);
    try {
      const response = await projectsApi.voteProject(Number(projectId), true);
      if (response.success) {
        toast({
          title: "Project Approved",
          description: "You have successfully verified this project",
          variant: "default",
        });
        // Refresh the project data
        const updatedProject = await projectsApi.getProjectById(projectId);
        if (updatedProject.success) {
          setProject(updatedProject.data);
        }
      } else {
        toast({
          title: "Error",
          description: response.error?.message || "Failed to approve project",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error approving project:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsVoting(false);
    }
  };

  if (loading) {
    return (
      <BlurContainer className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading project details...</span>
      </BlurContainer>
    );
  }

  if (error || !project) {
    return (
      <BlurContainer className="container max-w-6xl py-8">
        <Card className="bg-transparent border-0">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              {error || "Project not found"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Back to Home</Button>
          </CardContent>
        </Card>
      </BlurContainer>
    );
  }

  // Calculate funding progress
  const raised = project.funding?.raised || 0;
  const goal = project.funding?.goal || 0;
  const progressPercentage = goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getBlockExplorerUrl = (hash: string) => {
    return `https://sepolia.scrollscan.com/tx/${hash}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getTransactionStatusColor = (status?: string) => {
    if (!status) return "bg-gray-100 text-gray-800";
    
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return "bg-green-100 text-green-800";
      case 'pending':
        return "bg-yellow-100 text-yellow-800";
      case 'failed':
      case 'error':
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getTransactionTypeColor = (type?: string) => {
    if (!type) return "bg-gray-100 text-gray-800";
    
    switch (type.toLowerCase()) {
      case 'donation':
        return "bg-blue-100 text-blue-800";
      case 'deposit':
        return "bg-green-100 text-green-800";
      case 'contract_interaction':
        return "bg-purple-100 text-purple-800";
      case 'quadratic_distribution':
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTransactionTypeLabel = (tx: Transaction, isIncoming: boolean) => {
    // Simple labels as requested
    return isIncoming ? 'Donation' : 'Transaction';
  };

  // Format crypto amounts to avoid showing "0.00" for tiny amounts
  const formatCryptoAmount = (amount: number) => {
    // Don't display anything if amount is too small
    if (!amount || Math.abs(amount) < 0.0001) {
      return '0.00 ETH';
    }
    
    // For regular amounts
    if (Math.abs(amount) >= 0.01) {
      return amount.toFixed(2) + ' ETH';
    }
    
    // For small amounts (between 0.0001 and 0.01)
    return amount.toFixed(6) + ' ETH';
  };

  // Combine and deduplicate transactions from blockchain and database
  const getAllTransactions = () => {
    // Create a Set to track transaction hashes we've already seen
    const seenHashes = new Set();
    const combinedTransactions: Transaction[] = [];
    
    // Add blockchain transactions first
    transactions.forEach(tx => {
      if (tx.hash && !seenHashes.has(tx.hash)) {
        seenHashes.add(tx.hash);
        combinedTransactions.push(tx);
      } else if (!tx.hash) {
        // If no hash, still add it (unlikely, but just in case)
        combinedTransactions.push(tx);
      }
    });
    
    // Then add database donations, skipping any with hashes we've already seen
    databaseDonations.forEach(donation => {
      if (donation.hash && !seenHashes.has(donation.hash)) {
        seenHashes.add(donation.hash);
        combinedTransactions.push(donation);
      } else if (!donation.hash) {
        // If no hash (e.g., off-chain donation), add it
        combinedTransactions.push(donation);
      }
    });
    
    // Sort by timestamp, most recent first
    return combinedTransactions.sort((a, b) => {
      const timeA = a.timestamp ? Number(a.timestamp) : 0;
      const timeB = b.timestamp ? Number(b.timestamp) : 0;
      return timeB - timeA;
    });
  };

  // Fetch block timestamp from API if needed
  const fetchBlockTimestamp = async (blockNumber: string) => {
    try {
      // This is a sample API endpoint - modify as needed for your blockchain provider
      const response = await fetch(`https://api-sepolia.scrollscan.com/api?module=block&action=getblockreward&blockno=${blockNumber}`);
      const data = await response.json();
      if (data.status === '1' && data.result && data.result.timeStamp) {
        return Number(data.result.timeStamp);
      }
    } catch (error) {
      console.error('Error fetching block timestamp:', error);
    }
    return null;
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <BlurContainer intensity="strong" className="mb-6">
        <Card className="border-0 bg-transparent">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-2xl md:text-3xl">{project.name}</CardTitle>
                <CardDescription className="text-base mt-2">
                  by {project.charity_name}
                </CardDescription>
              </div>
              <div className="flex items-center mt-4 md:mt-0 space-x-2">
                {project.is_verified ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    Pending Verification
                  </Badge>
                )}
                {project.is_active ? (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-2">Funding Progress</h3>
              <div className="flex justify-between mb-2">
                <span>{formatCryptoAmount(raised)}</span>
                <span>{formatCryptoAmount(goal)}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>{progressPercentage}% Funded</span>
                <span>{project.funding?.donors_count || 0} Donors</span>
              </div>
            </div>

            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="verification">Verification</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="pt-4">
                <div className="prose max-w-none bg-white/20 backdrop-blur-sm p-4 rounded-md mb-6">
                  <p>{project.description}</p>
                </div>
                
                {project.pool && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-2">Funding Pool</h3>
                    <Card className="bg-white/20 backdrop-blur-sm border-0">
                      <CardHeader className="py-4">
                        <CardTitle className="text-xl">{project.pool.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p>{project.pool.description}</p>
                        <div className="mt-4">
                          <Button 
                            onClick={() => router.push(`/pools/${project.pool.id}`)}
                            variant="outline"
                          >
                            View Pool
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Project Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/20 backdrop-blur-sm p-4 rounded-md">
                    <div>
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p>{formatDateTime(project.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">End Date</p>
                      <p>{project.end_date ? formatDateTime(project.end_date) : 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p>{project.duration_days} days</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p>{formatDateTime(project.created_at)}</p>
                    </div>
                  </div>
                </div>
                
                {project.wallet_address && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-2">Wallet Address</h3>
                    <p className="font-mono bg-white/20 backdrop-blur-sm p-2 rounded break-all">
                      {project.wallet_address}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      This is the project's blockchain wallet address where donations are sent.
                    </p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="transactions" className="pt-4">
                <Card className="bg-white/20 backdrop-blur-sm border-0">
                  <CardHeader className="pb-2">
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>
                      Blockchain transactions and donations for this project
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(loadingTransactions || loadingDonations) ? (
                      <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : getAllTransactions().length > 0 ? (
                      <div className="mt-4 space-y-4">
                        {getAllTransactions()
                          .filter(tx => {
                            // Include all database donations
                            if (tx.is_database) return true;
                            
                            // Parse the transaction value for blockchain transactions
                            let txValue = 0;
                            try {
                              if (tx.value) {
                                txValue = parseFloat(formatEther(tx.value));
                              } else if (tx.amount) {
                                txValue = tx.amount;
                              }
                            } catch (err) {
                              console.error("Error parsing tx value:", err);
                              return false;
                            }
                            
                            // Filter out blockchain transactions with value less than 0.0001 ETH
                            return Math.abs(txValue) >= 0.0001;
                          })
                          .map((tx, index) => {
                            // For database donations, they're always incoming
                            const isIncoming = tx.is_database || (tx.to?.toLowerCase() === project.wallet_address?.toLowerCase());
                            
                            // Calculate transaction amount
                            let txAmount = 0;
                            try {
                              if (tx.value) {
                                txAmount = parseFloat(formatEther(tx.value));
                              } else if (tx.amount) {
                                txAmount = tx.amount;
                              }
                            } catch (err) {
                              console.error("Error parsing transaction value:", err, tx);
                              return null;
                            }
                            
                            // Skip blockchain transactions with value less than 0.0001 ETH
                            if (!tx.is_database && Math.abs(txAmount) < 0.0001) return null;
                            
                            // Format the transaction date
                            let transactionDate = 'Unknown date';
                            
                            if (tx.is_database && tx.created_at) {
                              // For database transactions, use the created_at date
                              transactionDate = new Date(tx.created_at).toLocaleString();
                            } else if (tx.timestamp) {
                              // For blockchain transactions with timestamp
                              transactionDate = new Date(parseInt(tx.timestamp.toString()) * 1000).toLocaleString();
                            } else if (tx.block_number) {
                              // For blockchain transactions with just block number, use a better format
                              transactionDate = `Block ${tx.block_number}`;
                              // You could potentially fetch the block timestamp here if needed
                            }
                            
                            return (
                              <div key={tx.hash || tx.id || index} className="flex justify-between items-center p-3 border rounded-md bg-white/10 backdrop-blur-xs">
                                <div className="flex items-center">
                                  <div className={`p-2 rounded-full mr-4 ${isIncoming ? 'bg-green-100' : 'bg-gray-100'}`}>
                                    {isIncoming ? <ArrowDownRight className="h-6 w-6 text-green-600" /> : <ArrowUpRight className="h-6 w-6 text-gray-800" />}
                                  </div>
                                  <div>
                                    <h4 className="font-medium">
                                      {getTransactionTypeLabel(tx, isIncoming)}
                                      {tx.is_database && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1 rounded">Database</span>}
                                    </h4>
                                    <p className="text-sm text-gray-500">
                                      {transactionDate}
                                    </p>
                                    {tx.from && !tx.is_database && (
                                      <p className="text-xs text-gray-500">
                                        From: {truncateAddress(tx.from)}
                                        {tx.to && tx.to !== project.wallet_address ? ` To: ${truncateAddress(tx.to)}` : ''}
                                      </p>
                                    )}
                                    {tx.user_name ? (
                                      <p className="text-xs text-gray-500">
                                        From: {tx.user_name}
                                      </p>
                                    ) : tx.is_database ? (
                                      <p className="text-xs text-gray-500">
                                        From: DermaDAO User
                                      </p>
                                    ) : null}
                                    {tx.hash && (
                                      <a 
                                        href={`https://sepolia-blockscout.scroll.io/tx/${tx.hash}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-500 flex items-center mt-1"
                                      >
                                        View on Scroll <ExternalLink className="h-3 w-3 ml-1" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div className={`text-lg font-bold ${isIncoming ? 'text-green-600' : 'text-gray-800'}`}>
                                  {isIncoming ? '+' : '-'}{formatCryptoAmount(Math.abs(txAmount))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 mt-4">No transactions found.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="verification" className="pt-4">
                <div className="space-y-4 bg-white/20 backdrop-blur-sm p-4 rounded-md">
                  <div>
                    <h3 className="text-lg font-medium">Project Verification Status</h3>
                    <p className="mt-1">
                      {project.is_verified 
                        ? "This project has been verified and is eligible to receive donations." 
                        : "This project is pending verification."}
                    </p>
                    
                    {!project.is_verified && (
                      <Button 
                        onClick={handleApproveProject}
                        disabled={isVoting}
                        className="mt-4"
                      >
                        {isVoting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>Verify Project</>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-medium">About Project Verification</h3>
                    <p className="mt-1">
                      Project verification ensures that this charity project is legitimate and the funds will be used as described.
                      Verified projects have been reviewed by the DermaDAO community and meet our standards for transparency and impact.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </BlurContainer>

      {/* Action button */}
      <BlurContainer intensity="strong" className="flex justify-center">
        <Button 
          onClick={() => router.push(`/dashboard/donations/${projectId}`)}
          size="lg"
          className="mt-6"
        >
          Donate to This Project
        </Button>
      </BlurContainer>
    </div>
  );
}