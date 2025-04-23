"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Clock,
  Edit,
  Users,
  CircleDollarSign,
  ChevronRight,
  CalendarDays,
  Landmark,
  ShieldCheck,
  FileText,
  Layers,
  BarChart3,
  Plus,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { projectsApi, donationsApi, proposalsApi, walletApi } from "@/lib/api";
import { formatCurrency, formatDate, calculateProgress } from "@/lib/utils";
import { AIVerificationBadge } from '@/components/projects/ai-verification-badge';

type ProjectDetailProps = {
  params: {
    id: string;
  };
};

export default function ProjectDetailPage({ params }: ProjectDetailProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const projectId = params.id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Recent donations
  const [recentDonations, setRecentDonations] = useState<any[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(false);
  
  // Transactions
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  // Copy wallet address
  const [copied, setCopied] = useState(false);
  
  // Wallet balance
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  
  // Quadratic funding total
  const [quadraticFundingTotal, setQuadraticFundingTotal] = useState(0);
  
  // Fetch project details
  const fetchProject = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await projectsApi.getProject(projectId);
      setProject(response.data);
      
      // Fetch wallet balance
      setIsLoadingBalance(true);
      const walletData = await walletApi.getWalletDataFromScrollScan(response.data.wallet_address);
      console.log('Wallet data:', walletData);
      const balance = walletData.data?.balance || '0.00';
      setWalletBalance(balance);
      
      // Update project funding status with the wallet balance
      if (response.data) {
        setProject((prev: any) => ({
          ...prev,
          funding: {
            ...prev?.funding,
            wallet_balance: response.data.balance || '0.00',
            currency: response.data.currency || 'ETH',
          }
        }));
      }
      
      setIsLoadingBalance(false);
    } catch (err: any) {
      console.error("Error fetching project:", err);
      setError(err.response?.data?.error?.message || "Failed to load project details");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch transactions for project
  const fetchTransactions = async () => {
    try {
      setTransactionsLoading(true);
      console.log(`Fetching transactions for project ID: ${projectId}`);
      
      const response = await fetch(`/api/projects/${projectId}/transactions`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Transactions API response:', data);
        setTransactions(data.data.transactions || []);
      } else {
        console.error('Error fetching transactions:', data.error?.message || 'Failed to fetch transactions');
        setTransactions([]);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };
  
  // Fetch recent donations
  const fetchRecentDonations = async () => {
    try {
      setDonationsLoading(true);
      console.log(`Fetching donations for project ID: ${projectId}`);
      
      let allDonations: any[] = [];
      
      // Fetch regular donations from our API
      try {
        const response = await donationsApi.getProjectDonations(projectId);
        console.log('Database Donations API response:', response);
        
        if (response.success && response.data && Array.isArray(response.data.donations)) {
          const dbDonations = response.data.donations;
          console.log(`Found ${dbDonations.length} database donations:`, dbDonations);
          
          const formattedDbDonations = dbDonations.map((donation: any) => ({
            id: donation.id || donation.transaction_hash,
            amount: parseFloat(donation.amount).toFixed(4), // Use 4 decimals for consistency
            donor: donation.donor_name || donation.donor || 'Anonymous',
            timestamp_ms: donation.created_at ? new Date(donation.created_at).getTime() : 0,
            status: donation.status || 'completed',
            transaction_hash: donation.transaction_hash,
            is_quadratic_funding: false,
            created_at: donation.created_at // Keep original for potential use
          }));
          allDonations = allDonations.concat(formattedDbDonations);
        } else {
          console.warn("Failed to fetch or parse database donations");
        }
      } catch (dbError) {
        console.error("Error fetching database donations:", dbError);
      }
      
      // Fetch quadratic funding allocations from ScrollScan
      if (project?.wallet_address) {
        try {
          console.log(`Fetching transactions for wallet: ${project.wallet_address}`);
          const walletData = await walletApi.getWalletDataFromScrollScan(project.wallet_address);
          console.log('Wallet transactions data:', walletData);
          
          if (walletData.success && walletData.data && Array.isArray(walletData.data.transactions)) {
            const transactions = walletData.data.transactions;
            console.log(`Found ${transactions.length} transactions`);
            
            // Filter for transactions from the quadratic funding pool address
            const quadraticPoolAddress = '0xbe7a74b66eba3e612041467f04bcb86d18951044'.toLowerCase();
            const quadraticTransactions = transactions.filter((tx: any) => 
              tx.from && tx.from.toLowerCase() === quadraticPoolAddress
            );
            
            console.log(`Found ${quadraticTransactions.length} quadratic funding transactions:`, quadraticTransactions);
            
            const formattedQfDonations = quadraticTransactions.map((tx: any) => ({
              id: `qf-${tx.hash}`,
              amount: parseFloat(tx.value).toFixed(4), // Use 4 decimals
              donor: 'Quadratic Funding Pool',
              timestamp_ms: tx.timestamp ? tx.timestamp * 1000 : 0,
              status: 'completed',
              transaction_hash: tx.hash,
              is_quadratic_funding: true,
              created_at: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : null // Store ISO string
            }));
            allDonations = allDonations.concat(formattedQfDonations);
          } else {
             console.warn("Failed to fetch or parse Scrollscan transactions");
          }
        } catch (qfError) {
          console.error("Error fetching quadratic funding transactions:", qfError);
        }
      }
      
      // Sort all donations by timestamp (newest first)
      allDonations.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
      
      console.log('Combined and sorted donations:', allDonations);
      setRecentDonations(allDonations);
      
      // Calculate quadratic funding total from the combined list
      const quadraticTotal = allDonations
        .filter((d: any) => d.is_quadratic_funding)
        .reduce((sum: number, d: any) => sum + parseFloat(d.amount), 0);
      console.log(`Quadratic funding total: ${quadraticTotal.toFixed(4)} ETH`);
      setQuadraticFundingTotal(quadraticTotal);
      
      // Calculate total raised including quadratic funding
      let totalRaised = allDonations.reduce((sum: number, d: any) => sum + parseFloat(d.amount), 0);
      console.log(`Total raised (from combined list): ${totalRaised.toFixed(4)} ETH`);
      
      // Update project funding status with total raised
      setProject((prev: any) => ({
        ...prev,
        funding: {
          ...prev?.funding,
          raised: totalRaised.toFixed(4)
        }
      }));
      
    } catch (err) {
      console.error("Error in fetchRecentDonations main block:", err);
      setRecentDonations([]);
    } finally {
      setDonationsLoading(false);
    }
  };
  
  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchRecentDonations();
      fetchTransactions();
    }
  }, [projectId]);
  
  // Copy wallet address to clipboard
  const copyWalletAddress = () => {
    if (project?.wallet_address) {
      navigator.clipboard.writeText(project.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-64 bg-gray-200 rounded w-full"></div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "Failed to load project details. Please try again."}
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }
  
  // Calculate days remaining
  const calculateDaysRemaining = () => {
    if (!project.end_date) return "No end date";
    
    const endDate = new Date(project.end_date);
    const now = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) return "Ended";
    if (daysRemaining === 0) return "Ends today";
    return `${daysRemaining} days remaining`;
  };
  
  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <div className="flex items-center text-gray-500 text-sm gap-2">
              <Badge variant={project.is_active ? "default" : "secondary"}>
                {project.is_active ? "Active" : "Inactive"}
              </Badge>
              <span>•</span>
              <span>Created {formatDate(project.created_at)}</span>
              <span>•</span>
              <span>{calculateDaysRemaining()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/dashboard/charity/projects/${projectId}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          
          <Button onClick={() => router.push(`/dashboard/charity/proposals/new?project=${projectId}`)}>
            <Plus className="h-4 w-4 mr-2" />
            New Proposal
          </Button>
        </div>
      </div>
      
      <Tabs 
        defaultValue="overview" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-5 md:grid-cols-6 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="donations">Donations</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="verification" className="hidden md:block">Verification</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Description</h3>
                  <p className="text-gray-600">{project.description}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Wallet Address</h3>
                  <div className="flex items-center space-x-2">
                    <code className="bg-gray-100 p-2 rounded text-sm flex-1 overflow-auto">
                      {project.wallet_address}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={copyWalletAddress}
                      className="flex-shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-medium text-gray-500">Wallet Balance</div>
                    {isLoadingBalance ? (
                      <div className="text-lg font-semibold">Loading...</div>
                    ) : (
                      <div className="text-lg font-semibold">{Number(walletBalance).toFixed(3)} ETH</div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    This is your project&apos;s Ethereum wallet address. Share it with donors for direct contributions.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Funding Goal</h3>
                    <p className="text-xl font-semibold">{formatCurrency(project.funding_goal)} ETH</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Duration</h3>
                    <p className="text-xl font-semibold">
                      {project.duration_days ? `${project.duration_days} days` : "No end date"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Funding Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="relative h-32 w-32 mx-auto">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-2xl font-bold">
                        {calculateProgress(project.funding?.raised || 0, project.funding_goal)}%
                      </div>
                    </div>
                    <svg className="h-full w-full" viewBox="0 0 100 100">
                      <circle
                        className="text-gray-200"
                        strokeWidth="10"
                        stroke="currentColor"
                        fill="transparent"
                        r="40"
                        cx="50"
                        cy="50"
                      />
                      <circle
                        className="text-primary"
                        strokeWidth="10"
                        strokeDasharray={`${calculateProgress(project.funding?.raised || 0, project.funding_goal) * 2.51} 251.2`}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="40"
                        cx="50"
                        cy="50"
                      />
                    </svg>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Raised</span>
                    <span className="font-medium">{formatCurrency(project.funding?.raised || 0)} ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Goal</span>
                    <span className="font-medium">{formatCurrency(project.funding_goal)} ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Unique Donors</span>
                    <span className="font-medium">{project.funding?.donors_count || 0}</span>
                  </div>
                  
                  {project.funding?.quadratic_match > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Quadratic Match</span>
                      <span className="font-medium">{formatCurrency(project.funding?.quadratic_match)} ETH</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Donations</CardTitle>
                  <CardDescription>Latest contributions to this project</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setActiveTab("donations")}
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {donationsLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex justify-between items-center border-b pb-3">
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-3 bg-gray-200 rounded w-32"></div>
                        </div>
                        <div className="h-5 bg-gray-200 rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                ) : recentDonations.length > 0 ? (
                  <div className="space-y-4">
                    {recentDonations.map((donation) => (
                      <div key={donation.id} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {donation.donor || 'Anonymous Donor'}
                            {donation.is_quadratic_funding && (
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-200">
                                Quadratic Funding
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {donation.timestamp_ms ? formatDate(new Date(donation.timestamp_ms)) : 'Date unknown'}
                          </div>
                          {donation.transaction_hash && (
                            <a
                              href={`https://sepolia.scrollscan.com/tx/${donation.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center mt-1"
                            >
                              {donation.transaction_hash.slice(0, 6)}...{donation.transaction_hash.slice(-4)}
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="font-semibold">{formatCurrency(donation.amount)} ETH</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No donations yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Project Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <CircleDollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Funding Goal</div>
                    <div className="font-medium">{formatCurrency(project.funding_goal)} ETH</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">End Date</div>
                    <div className="font-medium">
                      {project.end_date ? formatDate(project.end_date) : "No end date"}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Landmark className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Milestones</div>
                    <div className="font-medium">{project.milestones?.length || 0} milestones</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Verification Score</div>
                    <div className="font-medium">{project.verification_score || 0}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Milestones Tab */}
        <TabsContent value="milestones" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Project Milestones</CardTitle>
                <CardDescription>Progress tracking and fund allocation breakdown</CardDescription>
              </div>
              <Button 
                variant="outline"
                onClick={() => router.push(`/dashboard/charity/projects/${projectId}/milestones`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Milestones
              </Button>
            </CardHeader>
            <CardContent>
              {project.milestones && project.milestones.length > 0 ? (
                <div className="space-y-8">
                  {project.milestones.map((milestone: any, index: number) => (
                    <div key={milestone.id} className="relative">
                      {/* Milestone timeline marker */}
                      <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center w-10">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center z-10
                          ${milestone.status === 'completed' ? 'bg-green-100 text-green-700' : 
                            milestone.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                            'bg-gray-100 text-gray-500'}
                        `}>
                          {milestone.status === 'completed' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>
                        {index < project.milestones.length - 1 && (
                          <div className={`
                            w-0.5 flex-1 my-2
                            ${milestone.status === 'completed' ? 'bg-green-500' : 
                              milestone.status === 'in_progress' ? 'bg-blue-300' : 
                              'bg-gray-200'}
                          `}></div>
                        )}
                      </div>
                      
                      {/* Milestone content */}
                      <div className="ml-14 pb-6">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-medium">{milestone.title}</h3>
                          <Badge variant={
                            milestone.status === 'completed' ? 'success' : 
                            milestone.status === 'in_progress' ? 'default' : 
                            'secondary'
                          }>
                            {milestone.status === 'completed' ? 'Completed' : 
                             milestone.status === 'in_progress' ? 'In Progress' : 
                             'Pending'}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{milestone.description}</p>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-500">
                            Allocation: <span className="font-medium">{milestone.percentage}%</span>
                          </div>
                          <div className="text-gray-500">
                            Funds: <span className="font-medium">
                              {formatCurrency((project.funding_goal * milestone.percentage) / 100)} ETH
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Layers className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900">No milestones defined</h3>
                  <p className="text-gray-500 mb-4">Define milestones to track project progress</p>
                  <Button 
                    onClick={() => router.push(`/dashboard/charity/projects/${projectId}/milestones`)}
                  >
                    Add Milestones
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Donations Tab */}
        <TabsContent value="donations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Donation History</CardTitle>
              <CardDescription>All contributions to this project</CardDescription>
            </CardHeader>
            <CardContent>
              {donationsLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-3">
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                        <div className="h-3 bg-gray-200 rounded w-32"></div>
                      </div>
                      <div className="h-5 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : recentDonations.length > 0 ? (
                <div className="space-y-4">
                  {recentDonations.map((donation) => (
                    <div key={donation.id} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {donation.donor || 'Anonymous Donor'}
                          {donation.is_quadratic_funding && (
                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-200">
                              Quadratic Funding
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {donation.timestamp_ms ? formatDate(new Date(donation.timestamp_ms)) : 'Date unknown'}
                        </div>
                        {donation.transaction_hash && (
                          <a
                            href={`https://sepolia.scrollscan.com/tx/${donation.transaction_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center mt-1"
                          >
                            {donation.transaction_hash.slice(0, 6)}...{donation.transaction_hash.slice(-4)}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="font-semibold">{formatCurrency(donation.amount)} ETH</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900">No donations yet</h3>
                  <p className="text-gray-500">
                    Share your project to attract donations
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-gray-50 border-t">
              <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-gray-200 p-2 rounded-full">
                    <Users className="h-5 w-5 text-gray-700" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Donors</div>
                    <div className="font-medium">{project.funding?.donors_count || 0}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-200 p-2 rounded-full">
                    <CircleDollarSign className="h-5 w-5 text-gray-700" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Raised</div>
                    <div className="font-medium">{formatCurrency(project.funding?.raised || 0)} ETH</div>
                  </div>
                </div>
                {quadraticFundingTotal > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">QF</Badge>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Quadratic Funding</div>
                      <div className="font-medium">{formatCurrency(quadraticFundingTotal)} ETH</div>
                    </div>
                  </div>
                )}
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Transactions</CardTitle>
              <CardDescription>All blockchain transactions for this project's wallet</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-3">
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                        <div className="h-3 bg-gray-200 rounded w-32"></div>
                      </div>
                      <div className="h-5 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : transactions.length > 0 ? (
                <div className="space-y-4 divide-y">
                  {transactions.map((tx) => (
                    <div key={tx.hash} className="pt-4 first:pt-0 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          {tx.isIncoming ? (
                            <div className="bg-green-100 p-1.5 rounded-full">
                              <ArrowDownLeft className="h-4 w-4 text-green-600" />
                            </div>
                          ) : (
                            <div className="bg-red-100 p-1.5 rounded-full">
                              <ArrowUpRight className="h-4 w-4 text-red-600" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">
                              {tx.isIncoming ? 'Received from' : 'Sent to'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {tx.isIncoming ? tx.from.slice(0, 6) + '...' + tx.from.slice(-4) : tx.to.slice(0, 6) + '...' + tx.to.slice(-4)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-1">
                          <a
                            href={`https://sepolia.scrollscan.com/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center"
                          >
                            {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                          <div className="text-xs text-gray-500">
                            {formatDate(new Date(tx.timestamp * 1000).toISOString())}
                          </div>
                        </div>
                      </div>
                      <div className={`font-semibold ${tx.isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.isIncoming ? '+' : '-'}{parseFloat(tx.value).toFixed(4)} ETH
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900">No transactions yet</h3>
                  <p className="text-gray-500">
                    Your project's wallet has no transaction history yet
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-gray-50 border-t">
              <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-gray-200 p-2 rounded-full">
                    <CircleDollarSign className="h-5 w-5 text-gray-700" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Wallet Balance</div>
                    <div className="font-medium">{walletBalance} ETH</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-200 p-2 rounded-full">
                    <BarChart3 className="h-5 w-5 text-gray-700" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Transactions</div>
                    <div className="font-medium">{transactions.length}</div>
                  </div>
                </div>
                <a
                  href={`https://sepolia.scrollscan.com/address/${project?.wallet_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center"
                >
                  View in ScrollScan
                  <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Withdrawal Proposals</CardTitle>
                <CardDescription>Requests to withdraw funds for project implementation</CardDescription>
              </div>
              <Button onClick={() => router.push(`/dashboard/charity/proposals/new?project=${projectId}`)}>
                <Plus className="h-4 w-4 mr-2" />
                New Proposal
              </Button>
            </CardHeader>
            <CardContent>
              {project.proposals && project.proposals.length > 0 ? (
                <div className="divide-y">
                  {project.proposals.map((proposal: any) => (
                    <div key={proposal.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <h3 className="font-medium">{proposal.description}</h3>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            Submitted on {formatDate(proposal.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(proposal.amount)} ETH</div>
                            <Badge variant={
                              proposal.status === 'approved' || proposal.status === 'completed' ? 'success' :
                              proposal.status === 'pending_verification' ? 'warning' :
                              proposal.status === 'rejected' ? 'destructive' :
                              'outline'
                            }>
                              {proposal.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/charity/proposals/${proposal.id}`)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900">No proposals yet</h3>
                  <p className="text-gray-500 mb-4">
                    Create a withdrawal proposal to access project funds
                  </p>
                  <Button onClick={() => router.push(`/dashboard/charity/proposals/new?project=${projectId}`)}>
                    Create Proposal
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Verification Tab */}
        <TabsContent value="verification" className="space-y-6">
          <Card className="border-none">
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>Current verification status and suggestions for improvement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <AIVerificationBadge 
                score={project.verification_score || 0} 
                notes={project.verification_notes || null}
              />
              
              {/* Improvement Suggestions based on score */}
              {project.verification_score < 80 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Improvement Suggestions</h3>
                  <div className="space-y-2">
                    {project.verification_score < 70 && (
                      <div className="flex items-start gap-2">
                        <div className="bg-amber-100 p-1 rounded-full mt-0.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </div>
                        <p className="text-gray-600">Add more specific details about project implementation.</p>
                      </div>
                    )}
                    {project.verification_score < 80 && (
                      <div className="flex items-start gap-2">
                        <div className="bg-amber-100 p-1 rounded-full mt-0.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </div>
                        <p className="text-gray-600">Include evidence of past successes or similar projects.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-gray-50 border-t">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => router.push(`/dashboard/charity/verification/${projectId}`)} // Assuming such a page exists
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Improve Verification Score
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
} 