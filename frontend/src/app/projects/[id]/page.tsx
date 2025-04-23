"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { projectsApi, walletApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, ExternalLink, ArrowUpRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AIVerificationBadge } from '@/components/projects/ai-verification-badge';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

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
        const response = await walletApi.getWalletDataFromScrollScan(walletAddress);
        if (response.success && response.data && response.data.transactions) {
          setTransactions(response.data.transactions);
        } else {
          console.error("Failed to load transactions:", response.error);
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
      } finally {
        setLoadingTransactions(false);
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
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading project details...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container max-w-6xl py-8">
        <Card>
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
      </div>
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
    return `https://scrollscan.com/tx/${hash}`;
  };

  return (
    <div className="container max-w-6xl py-8">
      <Card className="mb-8">
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
              <span>{formatCurrency(raised)}</span>
              <span>{formatCurrency(goal)}</span>
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
              <div className="prose max-w-none">
                <p>{project.description}</p>
              </div>
              
              {project.pool && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Funding Pool</h3>
                  <Card>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <p className="font-mono bg-gray-100 p-2 rounded break-all">
                    {project.wallet_address}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This is the project's blockchain wallet address where donations are sent.
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="transactions" className="pt-4">
              {loadingTransactions ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Loading transactions...</span>
                </div>
              ) : transactions.length > 0 ? (
                <div>
                  <h3 className="text-lg font-medium mb-4">Transaction History</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>From/To</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx, index) => {
                        const isIncoming = tx.to?.toLowerCase() === project.wallet_address.toLowerCase();
                        const value = parseFloat(tx.value || "0");
                        const formattedValue = value > 0 ? formatCurrency(value) : "0";
                        
                        return (
                          <TableRow key={tx.hash || index}>
                            <TableCell>
                              {isIncoming ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <ArrowUpRight className="h-4 w-4 mr-1" />
                                  In
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  <ArrowUpRight className="h-4 w-4 mr-1 rotate-180" />
                                  Out
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{formattedValue}</TableCell>
                            <TableCell>
                              {isIncoming 
                                ? truncateAddress(tx.from) 
                                : truncateAddress(tx.to)}
                            </TableCell>
                            <TableCell>
                              {tx.timestamp 
                                ? new Date(tx.timestamp * 1000).toLocaleDateString() 
                                : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <a 
                                href={getBlockExplorerUrl(tx.hash)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-600 hover:text-blue-800"
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View
                              </a>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground italic">No transactions found for this project.</p>
                  {project.wallet_address && (
                    <p className="mt-2 text-sm">
                      Wallet address: <span className="font-mono">{truncateAddress(project.wallet_address)}</span>
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="verification" className="pt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Project Verification Status</h3>
                  <p className="mt-1">
                    {project.is_verified 
                      ? "This project has been verified and is eligible to receive donations." 
                      : "This project is pending verification."}
                  </p>
                </div>
                
                <AIVerificationBadge 
                  score={project.verification_score || 0} 
                  notes={project.verification_notes || null}
                />
                
                <Separator className="my-6" />
                
                <div className="flex flex-col md:flex-row gap-4">
                  {!project.is_verified && (
                    <Button 
                      className="flex-1"
                      variant="outline"
                      onClick={handleApproveProject}
                      disabled={isVoting}
                    >
                      {isVoting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve Project
                        </>
                      )}
                    </Button>
                  )}
                  <Button 
                    className="flex-1"
                    onClick={() => router.push(`/dashboard/donations?project=${projectId}`)}
                  >
                    Donate to this Project
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 