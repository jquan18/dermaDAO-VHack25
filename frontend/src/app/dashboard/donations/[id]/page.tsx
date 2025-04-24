"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import Cookies from 'js-cookie';
import { formatDistanceToNow } from 'date-fns';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BlurContainer } from "@/components/ui/blur-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ethToMyr, formatMyr, formatEth } from "@/lib/currency";

interface ProjectDetailProps {
  params: {
    id: string;
  };
}

interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string; // Formatted as ETH
    timestamp: number; // Note: API returns lowercase timestamp, not camelCase timeStamp
    blockNumber?: string;
    isIncoming?: boolean;
    isOutgoing?: boolean;
    gasUsed?: string;
    gasPrice?: string;
    isInternal?: boolean;
    source?: string;
}

// Helper function to check if a project ID is valid
const isValidProjectId = (id: string | number) => {
  const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
  return !isNaN(numId) && numId >= 0;
};

// Helper to shorten addresses
const shortenAddress = (address: string) => {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export default function DonatePage({ params }: ProjectDetailProps) {
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [ethAmount, setEthAmount] = useState(0);
  // const [walletBalance, setWalletBalance] = useState("0.00"); // Removed as it wasn't used

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  useEffect(() => {
    // Check if the ID is valid
    if (!isValidProjectId(params.id)) {
      console.error("Invalid project ID:", params.id);
      toast({
        title: "Error",
        description: "Invalid project ID",
        variant: "destructive",
      });
      router.push("/dashboard/donations");
      return;
    }

    const fetchProject = async () => {
      setIsLoadingProject(true);
      try {
        const response = await fetch(`/api/projects/${params.id}`, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})); // Catch JSON parsing errors
          throw new Error(errorData.error?.message || `HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !data.data) {
          throw new Error(data.error?.message || "Failed to load project");
        }

        setProject(data.data);
        // console.log("Project data set:", data.data);
      } catch (error: any) {
        console.error("Project fetch error:", error);
        toast({
          title: "Error Loading Project",
          description: error.message || "Failed to load project details",
          variant: "destructive",
        });
        // Don't redirect immediately, let the user see the error message
        // router.push("/dashboard/donations");
      } finally {
        setIsLoadingProject(false);
      }
    };

    fetchProject();
  }, [params.id, toast, router]);

  // Effect to fetch transactions once project is loaded
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!project?.id) return; // Don't fetch if project isn't loaded

      setIsLoadingTransactions(true);
      setTransactionError(null);
      try {
        // console.log(`Fetching transactions for project ${project.id}`);
        const response = await fetch(`/api/projects/${project.id}/transactions`);

        if (!response.ok) {
           const errorData = await response.json().catch(() => ({})); // Catch JSON parsing errors
          throw new Error(errorData.error?.message || `HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error?.message || "Failed to load transactions");
        }

        // Extract transactions array from the response
        const transactionsArray = data.data?.transactions || [];
        setTransactions(transactionsArray);
        console.log("Transactions data set:", transactionsArray);

      } catch (error: any) {
        console.error("Transaction fetch error:", error);
        setTransactionError(error.message || "Failed to load transaction history.");
        // Don't toast here, show error inline in the UI
        // toast({ title: "Error Loading Transactions", description: error.message, variant: "destructive" });
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    fetchTransactions();

  }, [project]); // Rerun when project state changes

  const handleDonate = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please connect your wallet to make a donation",
        variant: "destructive",
      });
      return;
    }

    if (!ethAmount || ethAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid donation amount",
        variant: "destructive",
      });
      return;
    }

    if (project?.id === undefined) {
      toast({
        title: "Error",
        description: "Project not found",
        variant: "destructive",
      });
      return;
    }

    if (!isValidProjectId(project.id)) {
      toast({
        title: "Error",
        description: "Invalid project ID",
        variant: "destructive",
      });
      console.error("Invalid project ID:", project.id);
      return;
    }

    setIsSubmitting(true);

    toast({
      title: "Processing Donation",
      description: "Your donation is being processed on the blockchain. This may take a moment...",
    });

    try {
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Cookies.get('token')}`,
        },
        body: JSON.stringify({
          project_id: project.id,
          amount: ethAmount // Using the converted ETH amount
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Donation error:", errorData);
        throw new Error(errorData.error?.message || `Error ${response.status}: Failed to process donation`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to process donation");
      }

      toast({
        title: "Donation Successful",
        description: (
          <div>
            <p>Your donation has been processed successfully!</p>
            <p className="mt-2 text-xs font-mono break-all">
              Transaction Hash: {data.data.transaction_hash}
            </p>
          </div>
        ),
        duration: 6000,
      });

      localStorage.setItem('lastDonationHash', data.data.transaction_hash);

      // Optionally, refetch transactions after successful donation
      // fetchTransactions(); // Consider calling the transaction fetch function again

      router.push(`/dashboard/donations/${project.id}/success`);
    } catch (error: any) {
      console.error("Donation error:", error);
      toast({
        title: "Error Processing Donation",
        description: error.message || "Failed to process donation",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    if (!value) return "RM0";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return formatMyr(ethToMyr(numValue));
  };

  const calculateProgress = (raised: number, goal: number) => {
      if (goal <= 0) return 0; // Avoid division by zero
    return Math.min(Math.round((raised / goal) * 100), 100);
  };

  if (isLoadingProject) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[calc(100vh-200px)]"> {/* Adjust height */} 
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // If project loading finished but project is still null (due to error)
  if (!project) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-8 text-center">
          <BlurContainer>
            <h1 className="text-2xl font-bold mb-4 text-red-600">Failed to Load Project</h1>
            <p className="text-gray-600 mb-4">Could not retrieve project details. Please try again later or go back.</p>
            <Button onClick={() => router.push("/dashboard/donations")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Projects
            </Button>
          </BlurContainer>
        </div>
      </DashboardLayout>
    );
  }

  // Base URL for Scrollscan transactions
  const scrollscanBaseUrl = "https://scrollscan.com/tx/";

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 space-y-8"> {/* Add spacing between sections */} 
        <BlurContainer intensity="strong" className="flex items-center">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/donations")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </BlurContainer>

        <div className="grid grid-cols-3 lg:grid-cols-1 gap-8"> {/* Adjust grid for transactions */} 
          {/* Project Details Card - Span 1 or 2 columns */}
          <BlurContainer className="lg:col-span-1">
            <Card className="border-0 bg-transparent">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>by {project.charity_name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white/20 backdrop-blur-sm rounded-md p-3 mb-4">
                  <p className="text-sm text-gray-600 break-words">{project.description}</p>
                </div>
                <div className="bg-white/30 backdrop-blur-md rounded-md p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Funding Goal</span>
                    <span className="font-medium">{formatCurrency(project.funding_goal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Raised</span> {/* Show actual raised amount */} 
                    <span className="font-medium">{formatCurrency(project.funding_progress?.raised || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span className="font-medium">
                      {calculateProgress(project.funding_progress?.raised || 0, project.funding_goal)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${calculateProgress(
                          project.funding_progress?.raised || 0,
                          project.funding_goal
                        )}%`,
                      }}
                    ></div>
                  </div>
                   {/* Display Wallet Address */}
                   {project.wallet_address && (
                        <div className="pt-4 text-sm text-gray-500">
                            <span>Project Wallet: </span>
                            <a 
                                href={`https://scrollscan.com/address/${project.wallet_address}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="font-mono hover:underline break-all"
                            >
                                {shortenAddress(project.wallet_address)}
                                <ExternalLink className="inline-block ml-1 h-3 w-3" />
                            </a>
                        </div>
                   )}
                </div>
              </CardContent>
            </Card>
          </BlurContainer>

          {/* Transaction History Card - Span 1 column */}
          <BlurContainer className="lg:col-span-1"> 
            <Card className="border-0 bg-transparent">
                <CardHeader>
                    <CardTitle>Recent Donations</CardTitle>
                    <CardDescription>Latest incoming transactions to the project wallet.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingTransactions ? (
                        <div className="flex justify-center items-center h-20">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : transactionError ? (
                        <div className="bg-white/20 backdrop-blur-sm rounded-md p-3">
                          <p className="text-sm text-red-500 text-center">{transactionError}</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="bg-white/20 backdrop-blur-sm rounded-md p-3">
                          <p className="text-sm text-gray-500 text-center">No transactions found for this project yet.</p>
                        </div>
                    ) : (
                        <div className="bg-white/30 backdrop-blur-md rounded-md p-3">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>From</TableHead>
                                      <TableHead className="text-right">Value</TableHead>
                                      <TableHead className="text-right">Age</TableHead>
                                      <TableHead className="text-right">Tx</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {transactions
                                      .filter(tx => tx.isIncoming)
                                      .slice(0, 5)
                                      .map((tx) => (
                                      <TableRow key={tx.hash}>
                                          <TableCell className="font-mono text-xs">{shortenAddress(tx.from)}</TableCell>
                                          <TableCell className="text-right text-xs">
                                              {formatMyr(ethToMyr(parseFloat(tx.value)))}
                                          </TableCell>
                                          <TableCell className="text-right text-xs whitespace-nowrap">
                                              {formatDistanceToNow(new Date(tx.timestamp * 1000), { addSuffix: true })}
                                          </TableCell>
                                          <TableCell className="text-right">
                                              <a href={`${scrollscanBaseUrl}${tx.hash}`} target="_blank" rel="noopener noreferrer" title="View on Scrollscan">
                                                  <ExternalLink className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                                              </a>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                        </div>
                    )}
                     <div className="pt-4 text-center text-xs text-gray-400">
                        Transaction data provided by Scrollscan.
                     </div>
                </CardContent>
            </Card>
          </BlurContainer>

           {/* Donation Card - Span 1 column */}
           <BlurContainer className="lg:col-span-1"> 
            <Card className="border-0 bg-transparent">
              <CardHeader>
                <CardTitle>Make a Donation</CardTitle>
                <CardDescription>Support this project with MYR</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (MYR)</Label>
                    <CurrencyInput
                      onChange={(ethValue, usdValue) => {
                        setAmount(usdValue.toString());
                        setEthAmount(ethValue);
                      }}
                      placeholder="0"
                      min={1}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleDonate}
                    disabled={isSubmitting || !isAuthenticated || !project} // Disable if project hasn't loaded
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Donate Now"
                    )}
                  </Button>
                  {!isAuthenticated && (
                    <p className="text-sm text-red-500 text-center">
                      Please connect your wallet to make a donation.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </BlurContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}