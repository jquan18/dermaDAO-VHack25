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
import { BlurContainer } from "@/components/ui/blur-container";
import { ethToMyr, formatMyr } from "@/lib/currency";
import { Switch } from "@/components/ui/switch";

export default function PoolDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const poolId = params?.id as string;
  const { toast } = useToast();
  const { user } = useAuthStore();
  
  const [pool, setPool] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("projects");
  const [donationAmount, setDonationAmount] = useState("");
  const [isDonating, setIsDonating] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [isShariah, setIsShariah] = useState(false);
  const [isUpdatingShariah, setIsUpdatingShariah] = useState(false);
  const [isManuallyDistributed, setIsManuallyDistributed] = useState(false);

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
          // Set Shariah compliance state
          setIsShariah(poolResponse.data.is_shariah_compliant || false);
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

  // Add the missing calculateProgress function
  const calculateProgress = (startDate: Date, endDate: Date): number => {
    const now = new Date();
    if (now < startDate) return 0;
    if (now > endDate) return 100;
    
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    return Math.round((elapsed / total) * 100);
  };

  // Auto-connect the ERC4337 wallet for corporate users
  const handleAutoConnect = async () => {
    if (isAutoConnecting || walletAddress) return;
    
    setIsAutoConnecting(true);
    try {
      // Try multiple approaches to get the wallet
      // First, try from user object if available
      if (user?.wallet_address) {
        console.log("Using wallet address from user object:", user.wallet_address);
        setWalletAddress(user.wallet_address);
        
        // Get wallet data from ScrollScan
        try {
          console.log("Fetching data from ScrollScan for address:", user.wallet_address);
          const scrollScanResponse = await walletApi.getWalletDataFromScrollScan(user.wallet_address, "sepolia");
          
          if (scrollScanResponse.success && scrollScanResponse.data && scrollScanResponse.data.balance) {
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
        
        // Set manually distributed state if this was a manual distribution
        if (isManualDistribution) {
          setIsManuallyDistributed(true);
        }
        
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

  // Add a function to update Shariah compliance status
  const handleShariaToggle = async (value: boolean) => {
    if (!isPoolSponsor && !isAdmin) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to update this pool.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUpdatingShariah(true);
      
      const result = await quadraticFundingApi.updatePool(poolId, {
        is_shariah_compliant: value
      });
      
      if (result.success) {
        setIsShariah(value);
        setPool((prevPool: any) => ({ ...prevPool, is_shariah_compliant: value }));
        
        toast({
          title: "Pool Updated",
          description: `The pool is now ${value ? "Shariah compliant" : "not Shariah compliant"}.`,
        });
      } else {
        throw new Error(result.error?.message || "Failed to update pool");
      }
    } catch (error) {
      console.error("Error updating pool:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
      // Reset to previous value
      setIsShariah(!value);
    } finally {
      setIsUpdatingShariah(false);
    }
  };

  // Add a function to handle impact report download
  const handleDownloadImpactReport = () => {
    // Create a link element to trigger the download
    const link = document.createElement('a');
    link.href = '/mock/Quadratic_Funding_Impact_Report_Disaster_Relief_v2.pdf'; 
    link.download = 'Quadratic_Funding_Impact_Report.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <header>
          <BlurContainer intensity="strong" className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => router.back()} title="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">Pool Details</h1>
                <Skeleton className="h-6 w-28" />
              </div>
            </div>
          </BlurContainer>
        </header>
        
        <main>
          <BlurContainer>
            <Card className="bg-transparent border-0">
              <CardHeader>
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </CardContent>
            </Card>
          </BlurContainer>
        </main>
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
      <header>
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 flex justify-between items-center">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pools
          </Button>
          <div></div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <BlurContainer>
          <div className="space-y-6">
            <Card className="border-0 bg-transparent">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl flex items-center">
                      {pool.name}
                    </CardTitle>
                    <CardDescription className="text-gray-500">Theme: {pool.theme || "General Funding"}</CardDescription>
                    <Badge 
                      variant={pool.is_shariah_compliant ? "success" : "outline"} 
                      className="mt-2"
                    >
                      {pool.is_shariah_compliant ? "Shariah Compliant" : "Non-Shariah"}
                    </Badge>
                  </div>
                  <Badge
                    variant={isActive ? "success" : hasEnded ? (isDistributed ? "secondary" : "outline") : "outline"}
                    className="capitalize"
                  >
                    {isActive ? "Active" : hasEnded ? (isDistributed ? "Completed" : "Ended") : "Scheduled"}
                  </Badge>
                </div>
                
                {isPoolSponsor && (
                  <div className="flex gap-2 mt-4">
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-md mb-6">
                  <p className="text-gray-850">{pool.description}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-blue-50/90 border-blue-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-600">Total Funding</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center">
                        <CircleDollarSign className="h-5 w-5 text-blue-500 mr-2" />
                        <div className="text-2xl font-bold">{formatMyr(ethToMyr(parseFloat(pool.total_funds || "0")))}</div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-purple-50/90 border-purple-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-purple-600">Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center">
                        <Users className="h-5 w-5 text-purple-500 mr-2" />
                        <div className="text-2xl font-bold">{projects.length || 0}</div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50/90 border-green-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-600">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-green-500 mr-2" />
                        <div className="text-md font-medium">
                          {hasEnded 
                            ? "Ended"
                            : isScheduled
                              ? `Starts ${formatDistanceToNow(new Date(pool.start_date), { addSuffix: true })}`
                              : `Ends ${pool.end_date ? formatDistanceToNow(new Date(pool.end_date), { addSuffix: true }) : "No end date"}`
                          }
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {isActive && pool.start_date && pool.end_date && (
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        Started {new Date(pool.start_date).toLocaleDateString()}
                      </span>
                      <span className="text-gray-500">
                        Ends {new Date(pool.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <Progress value={calculateProgress(new Date(pool.start_date), new Date(pool.end_date))} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0%</span>
                      <span>{calculateProgress(new Date(pool.start_date), new Date(pool.end_date))}% Complete</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </BlurContainer>

        {/* Tabs Section */}
        <BlurContainer intensity="strong">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 mt-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-2">
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            
            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-4">
              <Card className="border-0 bg-transparent">
                <CardHeader>
                  <CardTitle>Projects</CardTitle>
                  <CardDescription>Projects in this funding pool</CardDescription>
                </CardHeader>
                <CardContent>
                  {projects.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">No projects found in this pool.</p>
                      {isPoolSponsor && (
                        <Button variant="outline" asChild>
                          <Link href={`/dashboard/corporate/pools/${poolId}/projects/create`}>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Project
                          </Link>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {projects.map((project) => (
                        <div key={project.id} className="border rounded-lg p-4 bg-white/20 backdrop-blur-sm">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                              <h3 className="font-medium text-lg">{project.name}</h3>
                              <p className="text-sm text-gray-600 line-clamp-2 mt-1">{project.description}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" asChild>
                                <Link href={`/projects/${project.id}`}>
                                  View Details
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            
            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <Card className="border-0 bg-transparent">
                <CardHeader>
                  <CardTitle>Pool Settings</CardTitle>
                  <CardDescription>Manage pool settings and distribution</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Shariah compliance toggle section */}
                  {(isPoolSponsor || isAdmin) && (
                    <div className="bg-white/20 backdrop-blur-sm p-4 rounded-md">
                      <h3 className="text-lg font-medium mb-2">Shariah Compliance</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">
                            Mark this pool as Shariah compliant to indicate it follows Islamic finance principles.
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={isShariah}
                            onCheckedChange={handleShariaToggle}
                            disabled={isUpdatingShariah}
                          />
                          {isUpdatingShariah && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white/20 backdrop-blur-sm p-4 rounded-md">
                    {isDistributed ? (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertTitle>Funds Distributed</AlertTitle>
                        <AlertDescription>
                          This pool's funds have been successfully distributed according to the quadratic formula.
                          {pool.distribution_transaction_hash && (
                            <a 
                              href={`https://sepolia.scrollscan.com/tx/${pool.distribution_transaction_hash}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 flex items-center mt-2 text-sm"
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
                            
                            <div className="mt-4">
                              <Button 
                                variant="outline"
                                className="w-full flex items-center justify-center bg-white text-gray-800 border border-gray-300 hover:bg-gray-100"
                                onClick={handleDownloadImpactReport}
                              >
                                <LineChart className="h-4 w-4 mr-2" />
                                Purchase Impact Report
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </BlurContainer>
      </main>
    </div>
  );
}