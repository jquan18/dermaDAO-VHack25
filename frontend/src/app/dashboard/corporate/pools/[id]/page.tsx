"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CircleDollarSign, 
  Users, 
  Calendar, 
  ArrowLeft, 
  Edit, 
  PlusCircle,
  LineChart,
  Clock,
  CheckCircle2,
  Building,
  Info,
  AlertCircle,
  ExternalLink,
  Loader2,
  Share2
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { quadraticFundingApi, walletApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConnectWallet } from "@/components/blockchain/connect-wallet";
import { useAuthStore } from "@/store/auth-store";
import { formatDistanceToNow } from 'date-fns';

export default function PoolDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const poolId = params?.id as string;
  const { toast } = useToast();
  const { user } = useAuthStore();
  
  const [pool, setPool] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [donationAmount, setDonationAmount] = useState("");
  const [isDonating, setIsDonating] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);

  // --- Status Calculation (moved up for clarity) ---
  const now = new Date();
  const startDate = pool?.start_date ? new Date(pool.start_date) : null;
  const endDate = pool?.end_date ? new Date(pool.end_date) : null;
  
  // Fixed status calculations with better fallbacks
  const isPoolActive = pool?.is_active === true;
  const isScheduled = isPoolActive && startDate && now < startDate;
  const isActive = isPoolActive && 
                  (!startDate || now >= startDate) && 
                  (!endDate || now <= endDate);
  const hasEnded = isPoolActive && endDate && now > endDate;
  const isDistributed = pool?.is_distributed === true;

  // Can we distribute?
  const distributionEligible = hasEnded && !isDistributed;
  // Manual distribution is eligible if the pool is active and not yet distributed
  const manualDistributionEligible = isPoolActive && !isDistributed;

  // Check user permissions
  const isCorporateUser = user?.role === 'corporate';
  const isPoolSponsor = user?.id === pool?.sponsor_id;
  const isAdmin = user?.role === 'admin';
  const canDistribute = (isCorporateUser && isPoolSponsor) || isAdmin;

  // Fetch pool data
  useEffect(() => {
    const fetchPoolDetails = async () => {
      try {
        setIsLoading(true);
        
        // Fetch pool details
        const poolResponse = await quadraticFundingApi.getPool(poolId);
        if (poolResponse.success && poolResponse.data) {
          setPool(poolResponse.data);
        }
        
        // Fetch projects in this pool
        const projectsResponse = await quadraticFundingApi.getPoolProjects(poolId);
        if (projectsResponse.success && projectsResponse.data && projectsResponse.data.projects) {
          setProjects(projectsResponse.data.projects);
        }
      } catch (error) {
        console.error("Error fetching pool details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (poolId) {
      fetchPoolDetails();
    }
  }, [poolId]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        setIsLoadingWallet(true);
        
        // Check if we have a wallet address
        const walletAddressToUse = user?.wallet_address;
        
        if (!walletAddressToUse) {
          console.log('No wallet address found, using regular wallet API');
          const response = await walletApi.getWalletBalance();
          
          if (response.success && response.data) {
            let formattedBalance = response.data.balance;
            if (formattedBalance && !formattedBalance.includes('ETH')) {
              formattedBalance = `${formattedBalance} ETH`;
            }
            setWalletBalance(formattedBalance);
            setWalletAddress(response.data.wallet_address);
          } else {
            setWalletBalance("0.00 ETH");
          }
          setIsLoadingWallet(false);
          return;
        }
        
        // Use the ScrollScan API to get wallet data and balance
        console.log('Fetching data from ScrollScan for address:', walletAddressToUse);
        const response = await walletApi.getWalletDataFromScrollScan(walletAddressToUse);
        console.log('ScrollScan data response:', response);
        
        if (response.success) {
          // Set wallet address
          setWalletAddress(walletAddressToUse);
          
          // Set balance from ScrollScan API
          if (response.data.balance) {
            console.log(`Setting balance from ScrollScan API: ${response.data.balance}`);
            setWalletBalance(response.data.balance);
          } else {
            // Fallback to regular wallet API
            console.log('No balance in ScrollScan response, falling back to regular API');
            const balanceResponse = await walletApi.getWalletBalance();
            if (balanceResponse.success && balanceResponse.data) {
              let formattedBalance = balanceResponse.data.balance;
              if (formattedBalance && !formattedBalance.includes('ETH')) {
                formattedBalance = `${formattedBalance} ETH`;
              }
              setWalletBalance(formattedBalance);
            } else {
              setWalletBalance("0.00 ETH");
            }
          }
        } else {
          console.error("Failed to fetch wallet data from ScrollScan:", response);
          // Fallback to regular wallet API
          const balanceResponse = await walletApi.getWalletBalance();
          if (balanceResponse.success && balanceResponse.data) {
            let formattedBalance = balanceResponse.data.balance;
            if (formattedBalance && !formattedBalance.includes('ETH')) {
              formattedBalance = `${formattedBalance} ETH`;
            }
            setWalletBalance(formattedBalance);
            setWalletAddress(balanceResponse.data.wallet_address);
          } else {
            setWalletBalance("0.00 ETH");
          }
        }
      } catch (error) {
        console.error("Error fetching wallet data:", error);
        setWalletBalance("0.00 ETH");
      } finally {
        setIsLoadingWallet(false);
      }
    };

    fetchWalletBalance();
  }, [user?.wallet_address]);

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A";
    try {
      // Check if the date is valid
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "N/A";
      }
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      console.error("Date formatting error:", e);
      return "N/A";
    }
  };
  
  const calculateTimeRemaining = (): string => {
    if (!endDate) return isActive ? "Ongoing" : "No end date specified";
    
    const diffTime = endDate.getTime() - now.getTime();
    if (diffTime <= 0) return "Ended";
    
    try {
      return formatDistanceToNow(endDate, { addSuffix: true });
    } catch (e) {
      console.error("Time calculation error:", e);
      return "Date calculation error";
    }
  };

  // Auto-connect the ERC4337 wallet for corporate users
  const handleAutoConnect = async () => {
    if (isAutoConnecting || walletAddress) return;
    
    try {
      setIsAutoConnecting(true);
      
      // Try multiple approaches to get the wallet
      // First, try from user object if available
      if (user?.wallet_address) {
        console.log("Using wallet address from user object:", user.wallet_address);
        setWalletAddress(user.wallet_address);
        
        // Get wallet data from ScrollScan
        try {
          console.log("Fetching data from ScrollScan for address:", user.wallet_address);
          const scrollScanResponse = await walletApi.getWalletDataFromScrollScan(user.wallet_address);
          
          if (scrollScanResponse.success && scrollScanResponse.data.balance) {
            console.log(`Setting balance from ScrollScan API: ${scrollScanResponse.data.balance}`);
            setWalletBalance(scrollScanResponse.data.balance);
            return;
          } else {
            // Fallback to regular wallet API
            console.log("ScrollScan data unavailable, falling back to regular API");
            const balanceResponse = await walletApi.getWalletBalance();
            if (balanceResponse.success && balanceResponse.data) {
              let formattedBalance = balanceResponse.data.balance;
              if (formattedBalance && !formattedBalance.includes('ETH')) {
                formattedBalance = `${formattedBalance} ETH`;
              }
              setWalletBalance(formattedBalance);
            } else {
              setWalletBalance("0.00 ETH");
            }
          }
        } catch (error) {
          console.error("Error fetching from ScrollScan:", error);
          // Still try regular API
          try {
            const balanceResponse = await walletApi.getWalletBalance();
            if (balanceResponse.success && balanceResponse.data) {
              let formattedBalance = balanceResponse.data.balance;
              if (formattedBalance && !formattedBalance.includes('ETH')) {
                formattedBalance = `${formattedBalance} ETH`;
              }
              setWalletBalance(formattedBalance);
            } else {
              setWalletBalance("0.00 ETH");
            }
          } catch (error) {
            console.error("Error fetching balance:", error);
            setWalletBalance("0.00 ETH");
          }
        }
        
        return;
      }
      
      // If no user wallet address, try the API
      console.log("Fetching wallet from API for corporate user");
      const response = await walletApi.getWalletBalance();
      
      if (response.success && response.data) {
        setWalletBalance(response.data.balance || "0.00 ETH");
        setWalletAddress(response.data.wallet_address);
        console.log("Successfully got wallet from API:", response.data.wallet_address);
      } else {
        console.error("Failed to auto-connect corporate wallet (API success=false):", response);
        
        // Last resort: try to get wallet address from auth store again
        if (user?.wallet_address) {
          setWalletAddress(user.wallet_address);
          setWalletBalance("0.00 ETH");
          console.log("Falling back to user object wallet address");
        }
      }
    } catch (error) {
      console.error("Error auto-connecting wallet:", error);
      // Still try to use user.wallet_address as a fallback
      if (user?.wallet_address) {
        setWalletAddress(user.wallet_address);
        setWalletBalance("0.00 ETH");
        console.log("Falling back to user object wallet address after error");
      }
    } finally {
      setIsAutoConnecting(false);
    }
  };

  // Call auto-connect when the component mounts if user is corporate
  useEffect(() => {
    if (user?.role === 'corporate' && !walletAddress) {
      handleAutoConnect();
    }
  }, [user]);

  // Modify the wallet balance parsing to handle different formats
  const parseBalance = (balanceString: string | null): number => {
    if (!balanceString) return 0;
    
    // Convert to string in case we're passed a number
    const balanceStr = String(balanceString);
    
    // Remove 'ETH' and any other non-numeric characters except decimal points
    // First try to extract the number if it's in the format "0.05 ETH"
    const matched = balanceStr.match(/(\d+\.\d+|\d+)/);
    if (matched && matched[0]) {
      const parsed = parseFloat(matched[0]);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    // Fallback: just strip non-numeric characters and try to parse
    const cleanedBalance = balanceStr.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanedBalance);
    
    // For debugging
    console.log('Parsing balance:', { 
      original: balanceString, 
      cleaned: cleanedBalance, 
      parsed: parsed 
    });
    
    return isNaN(parsed) ? 0 : parsed;
  };

  // In the handleDonation function, update the balance comparison logic
  const handleDonation = async () => {
    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid donation amount",
        variant: "destructive"
      });
      return;
    }

    // Check if user has enough balance using our improved parsing
    const amount = parseFloat(donationAmount);
    const parsedBalance = parseBalance(walletBalance);
    
    console.log("Donation amount:", amount, "Wallet balance:", parsedBalance, "Original balance:", walletBalance);
    
    if (parsedBalance < amount) {
      toast({
        title: "Insufficient funds",
        description: `Your wallet balance (${parsedBalance.toFixed(4)} ETH) is too low for this donation (${amount.toFixed(4)} ETH).`,
        variant: "destructive"
      });
      return;
    }

    try {
      setIsDonating(true);
      
      const result = await quadraticFundingApi.donateToPool(poolId, amount);
      
      if (result.success) {
        toast({
          title: "Donation successful",
          description: `You have successfully donated ${amount.toFixed(4)} ETH to this pool`,
        });
        
        // Refresh pool data
        const poolResponse = await quadraticFundingApi.getPool(poolId);
        if (poolResponse.success && poolResponse.data) {
          setPool(poolResponse.data);
        }
        
        // Refresh wallet balance after successful donation
        if (user?.wallet_address) {
          // Use ScrollScan API for accurate balance
          console.log('Refreshing wallet data from ScrollScan after donation');
          const scrollScanResponse = await walletApi.getWalletDataFromScrollScan(user.wallet_address);
          
          if (scrollScanResponse.success && scrollScanResponse.data.balance) {
            console.log(`Updated balance from ScrollScan: ${scrollScanResponse.data.balance}`);
            setWalletBalance(scrollScanResponse.data.balance);
          } else {
            // Fallback to regular API
            console.log('ScrollScan update failed, using regular API');
            const walletResponse = await walletApi.getWalletBalance();
            if (walletResponse.success && walletResponse.data) {
              let formattedBalance = walletResponse.data.balance;
              if (formattedBalance && !formattedBalance.includes('ETH')) {
                formattedBalance = `${formattedBalance} ETH`;
              }
              setWalletBalance(formattedBalance);
            }
          }
        } else {
          // No wallet address, use regular API
          const walletResponse = await walletApi.getWalletBalance();
          if (walletResponse.success && walletResponse.data) {
            let formattedBalance = walletResponse.data.balance;
            if (formattedBalance && !formattedBalance.includes('ETH')) {
              formattedBalance = `${formattedBalance} ETH`;
            }
            setWalletBalance(formattedBalance);
          }
        }
        
        // Reset donation amount
        setDonationAmount("");
      } else {
        throw new Error(result.error?.message || "Failed to process donation");
      }
    } catch (error) {
      console.error("Donation error:", error);
      toast({
        title: "Donation failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsDonating(false);
    }
  };

  // Add a new function to handle distribution (Refactored)
  const handleDistributeFunds = async (isManualDistribution = false) => {
    try {
      if (!poolId || !canDistribute || (!distributionEligible && !isManualDistribution)) return;

      // If it's a manual distribution, show a confirmation dialog
      if (isManualDistribution && !window.confirm(
        "Warning: You are about to manually distribute funds even though the pool has not ended yet. " +
        "This will end the pool immediately and distribute funds to all eligible projects. " +
        "This action cannot be undone. Do you want to continue?"
      )) {
        return;
      }

      setIsDistributing(true);

      // Call the API to distribute funds using the correct API object and method
      const result = await quadraticFundingApi.distributeQuadraticFunding(
        parseInt(poolId, 10), 
        isManualDistribution // Pass isManualDistribution as forceDistribution parameter
      );

      if (result.success) {
        toast({
          title: "Funds distribution initiated",
          description: "The distribution process has started successfully."
        });

        // Refresh the pool data locally or refetch
        setPool((prevPool: any) => ({ ...prevPool, is_distributed: true, distributed_at: new Date().toISOString() }));
        // Optionally: router.refresh() if backend update is fast enough

      } else {
        toast({
          title: "Distribution failed",
          description: result.error?.message || "An error occurred while initiating distribution.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Error distributing funds:", error);
      toast({
        title: "Distribution Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsDistributing(false);
    }
  };

  const renderWalletContent = () => {
    if (isLoadingWallet || isAutoConnecting) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      );
    }
    
    // Prioritize checking if we have user.wallet_address as a fallback
    const effectiveWalletAddress = walletAddress || user?.wallet_address;
    
    if (effectiveWalletAddress) {
      return (
        <>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Wallet Address:</span>
            <span className="font-medium text-xs truncate max-w-[180px]">{effectiveWalletAddress}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Wallet Balance:</span>
            <span className="font-medium">
              {walletBalance || `${parseBalance(walletBalance).toFixed(4)} ETH`}
            </span>
          </div>
          
          {parseBalance(walletBalance) <= 0.01 && (
            <Alert variant="warning" className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Low balance</AlertTitle>
              <AlertDescription className="text-xs text-amber-700">
                Your wallet balance is low. You'll need to top up before donating.
              </AlertDescription>
              <Link href="/dashboard/wallet" className="flex items-center text-xs font-medium text-amber-700 mt-2 hover:text-amber-900">
                Top up wallet
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Alert>
          )}
          
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Your contribution will be used for quadratic matching based on community support.
            </p>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="0.00"
                  className="pl-7"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">ETH</span>
              </div>
              <Button 
                onClick={handleDonation}
                disabled={
                  isDonating || 
                  !donationAmount || 
                  parseFloat(donationAmount) <= 0 ||
                  parseBalance(walletBalance) < parseFloat(donationAmount)
                }
              >
                {isDonating ? "Donating..." : "Donate"}
              </Button>
            </div>
          </div>
        </>
      );
    } else if (user?.role === 'corporate') {
      return (
        <div className="space-y-4">
          <Alert variant="warning" className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Corporate Wallet Issue</AlertTitle>
            <AlertDescription className="text-xs text-amber-700">
              We couldn't load your corporate wallet. Your account should have a wallet automatically created.
              Please try refreshing the page or visit the wallet page to check your wallet status.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2 items-center pt-2">
            <Button 
              variant="secondary" 
              className="text-sm w-full"
              onClick={handleAutoConnect}
              disabled={isAutoConnecting}
            >
              {isAutoConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CircleDollarSign className="h-4 w-4 mr-2" />
                  Retry Wallet Connection
                </>
              )}
            </Button>
            <Link href="/dashboard/wallet" className="w-full">
              <Button variant="outline" className="text-sm w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Wallet Page
              </Button>
            </Link>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Wallet not connected</AlertTitle>
            <AlertDescription>
              You need to connect your wallet before you can donate.
            </AlertDescription>
          </Alert>
          <div className="flex justify-center pt-2">
            <ConnectWallet />
          </div>
        </div>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Skeleton className="h-9 w-44" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-7 w-72" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="py-6">
        <Link href="/dashboard/corporate/pools">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Pools
          </Button>
        </Link>
        <div className="py-12 text-center">
          <h2 className="text-xl font-semibold mb-2">Pool Not Found</h2>
          <p className="text-muted-foreground">
            The funding pool you're looking for doesn't exist or you don't have permission to view it.
          </p>
        </div>
      </div>
    );
  }

  // --- Calculate funding percentage ---
  const totalFunds = parseFloat(pool.total_funds || "0");
  const allocatedFunds = parseFloat(pool.allocated_funds || "0");
  const fundingPercentage = totalFunds > 0 ? Math.round((allocatedFunds / totalFunds) * 100) : 0;
  const currency = pool.currency || 'ETH'; // Assuming ETH if not specified

  return (
    <div className="min-h-screen bg-black-50">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pools
          </Button>
        </div>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Manual Distribution Alert - REMOVED */}
        
        <div className="space-y-6">
          {/* Pool Header Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl flex items-center">
                    <CircleDollarSign className="h-6 w-6 mr-2 text-blue-600" />
                    {pool.name}
                  </CardTitle>
                  <CardDescription className="mt-1">Theme: {pool.theme || "General"}</CardDescription>
                </div>
                {/* Updated Pool Status Badge */}
                <Badge variant={isActive ? "success" : hasEnded ? "secondary" : isScheduled ? "outline" : "destructive"}>
                  {isActive ? "Active" : hasEnded ? (isDistributed ? "Completed" : "Ended") : isScheduled ? "Scheduled" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">{pool.description}</p>
              
              {/* Pool Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Total Funding */}
                  <div className="bg-blue-50 rounded-lg p-4 flex flex-col">
                    <span className="text-xs text-blue-600 font-medium mb-1">Total Funding</span>
                    <div className="flex items-center">
                      <CircleDollarSign className="h-5 w-5 mr-1 text-blue-600" />
                      <span className="text-xl font-bold">${parseFloat(pool.total_funds || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  {/* Projects */}
                  <div className="bg-purple-50 rounded-lg p-4 flex flex-col">
                    <span className="text-xs text-purple-600 font-medium mb-1">Projects</span>
                    <div className="flex items-center">
                      <Users className="h-5 w-5 mr-1 text-purple-600" />
                      <span className="text-xl font-bold">{projects.length}</span>
                    </div>
                  </div>
              </div>
              
              <Separator className="my-4"/>
              
              {/* Pool Period & Status Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">Period</h3>
                  <div className="flex items-center text-gray-600 text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    <div>
                      <p>Start: {formatDate(pool.start_date)}</p>
                      <p>End: {formatDate(pool.end_date)}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-1">Status</h3>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-4 w-4 mr-2 text-gray-500" />
                      <p>{calculateTimeRemaining()}</p>
                    </div>
                    {/* Display Distribution Status */}
                     <div className="flex items-center text-gray-600">
                        {isDistributed ? 
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> : 
                          <Clock className="h-4 w-4 mr-2 text-orange-500" /> 
                        }
                        <p>{isDistributed ? 
                            `Distributed on ${formatDate(pool.distributed_at)}` : 
                            (hasEnded ? "Awaiting Distribution" : "Distribution Pending")}
                        </p>
                     </div>
                    {pool.company_id && (
                      <div className="flex items-center text-gray-600">
                        <Building className="h-4 w-4 mr-2 text-gray-500" />
                        <p>Sponsored by {pool.company_name || "Company"}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Tabs Section */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Featured Projects</CardTitle>
                    <CardDescription>
                      Projects currently receiving funding from this pool
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {projects.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No projects in this funding pool yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {projects.slice(0, 3).map((project) => (
                          <div key={project.id} className="border rounded-lg p-4">
                            <div className="flex justify-between mb-2">
                              <h3 className="font-medium">{project.name}</h3>
                              <Badge variant="outline">{project.charity_name || "Charity"}</Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {project.description}
                            </p>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center text-sm text-gray-500">
                                <CircleDollarSign className="h-4 w-4 mr-1" />
                                <span>${parseFloat(project.funds_raised || 0).toLocaleString()} raised</span>
                              </div>
                              <Link href={`/dashboard/projects/${project.id}`}>
                                <Button variant="ghost" size="sm">View Project</Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                        
                        {projects.length > 3 && (
                          <div className="text-center mt-2">
                            <Link href={`/dashboard/corporate/pools/projects/${pool.id}`}>
                              <Button variant="link">
                                View all {projects.length} projects
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Settings Tab */}
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Pool Settings</CardTitle>
                  <CardDescription>
                    Configure settings for this funding pool
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Distribution Settings */}
                    {canDistribute && (
                      <div id="distribution-controls" className="bg-white p-4 rounded-lg border">
                        <h3 className="text-lg font-medium mb-2">Distribution Controls</h3>
                        
                        {isDistributed ? (
                          <Alert className="bg-green-50 border-green-200 mb-4">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertTitle>Funds Distributed</AlertTitle>
                            <AlertDescription>
                              This pool has already been distributed on {formatDate(pool.distributed_at)}.
                              {pool.distribution_tx_hash && (
                                <a 
                                  href={`https://scrollscan.com/tx/${pool.distribution_tx_hash}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-green-700 underline flex items-center mt-1"
                                >
                                  View transaction <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              )}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            {distributionEligible ? (
                              <div className="space-y-3">
                                <Alert className="bg-blue-50 border-blue-200">
                                  <Info className="h-4 w-4 text-blue-600" />
                                  <AlertTitle>Ready for Distribution</AlertTitle>
                                  <AlertDescription>
                                    This pool has ended and is ready for funds distribution.
                                  </AlertDescription>
                                </Alert>
                                
                                <Button 
                                  className="w-full"
                                  onClick={() => handleDistributeFunds(false)} 
                                  disabled={isDistributing}
                                >
                                  {isDistributing ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Distributing...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Distribute Funds
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Alert className="bg-amber-50 border-amber-200">
                                  <AlertCircle className="h-4 w-4 text-amber-600" />
                                  <AlertTitle>Manual Distribution</AlertTitle>
                                  <AlertDescription>
                                    This pool has not ended yet. You can manually distribute funds, but this will immediately end the pool and prevent further donations.
                                  </AlertDescription>
                                </Alert>
                                
                                <Button 
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => handleDistributeFunds(true)} 
                                  disabled={isDistributing || !manualDistributionEligible}
                                >
                                  {isDistributing ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Distributing...
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="h-4 w-4 mr-2" />
                                      Manually Distribute Funds
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    
                    <div className="py-2 text-center">
                      <p className="text-muted-foreground">Additional settings coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
} 