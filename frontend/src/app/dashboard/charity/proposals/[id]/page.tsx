"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  RefreshCw,
  Building,
  Building2,
  DollarSign,
  Landmark,
  Timer,
  AlertCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { proposalsApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ProposalExecuteButton } from "@/components/proposals/proposal-execute-button";
import { ProposalVoteForm } from "@/components/proposals/proposal-vote-form";
import { cn } from "@/lib/utils";

type ProposalDetailProps = {
  params: {
    id: string;
  };
};

export default function ProposalDetailPage({ params }: ProposalDetailProps) {
  const router = useRouter();
  const proposalId = params.id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch proposal details
  const fetchProposal = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await proposalsApi.getProposalDetails(proposalId);
      
      if (response.success && response.data) {
        console.log("Proposal data:", response.data);
        setProposal(response.data);
      } else {
        setError("Failed to load proposal details");
      }
    } catch (err: any) {
      console.error("Error fetching proposal:", err);
      setError(err.response?.data?.error?.message || "Failed to load proposal details");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchProposal();
  }, [proposalId]);
  
  // Refresh status
  const handleRefreshStatus = async () => {
    try {
      setIsRefreshing(true);
      await fetchProposal();
    } catch (err) {
      console.error("Error refreshing status:", err);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'success' as const;
      case 'pending_verification':
      case 'transfer_initiated':
        return 'default' as const;
      case 'rejected':
      case 'processing_error':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };
  
  // Format status text
  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Get status percentage for progress bar
  const getStatusPercentage = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return 25;
      case 'approved':
        return 50;
      case 'transfer_initiated':
        return 75;
      case 'completed':
        return 100;
      case 'rejected':
      case 'processing_error':
        return 100;
      default:
        return 0;
    }
  };
  
  // Get status info based on current status
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return {
          icon: Clock,
          title: 'Verification In Progress',
          description: 'Your withdrawal request is being verified by our AI system.',
          color: 'text-yellow-500',
        };
      case 'approved':
        return {
          icon: CheckCircle2,
          title: 'Proposal Approved',
          description: 'Your withdrawal request has been approved and is awaiting fund transfer.',
          color: 'text-green-500',
        };
      case 'transfer_initiated':
        return {
          icon: Building,
          title: 'Bank Transfer Initiated',
          description: 'Funds are being transferred to your bank account.',
          color: 'text-blue-500',
        };
      case 'completed':
        return {
          icon: CheckCircle2,
          title: 'Transfer Completed',
          description: 'Funds have been successfully transferred to your bank account.',
          color: 'text-green-500',
        };
      case 'rejected':
        return {
          icon: AlertTriangle,
          title: 'Proposal Rejected',
          description: 'Your withdrawal request was not approved. Please review the verification notes for more information.',
          color: 'text-red-500',
        };
      case 'processing_error':
        return {
          icon: AlertTriangle,
          title: 'Processing Error',
          description: 'There was an error processing your withdrawal request. Please contact support.',
          color: 'text-red-500',
        };
      default:
        return {
          icon: Clock,
          title: 'Unknown Status',
          description: 'The status of your withdrawal request is unknown.',
          color: 'text-gray-500',
        };
    }
  };
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="mb-6 flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold">Withdrawal Proposal</h1>
            <p className="text-gray-500">Loading proposal details...</p>
          </div>
        </div>
        
        <div className="space-y-6 animate-pulse">
          <Card>
            <CardHeader>
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-24 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }
  
  if (error || !proposal) {
    return (
      <DashboardLayout>
        <div className="mb-6 flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold">Withdrawal Proposal</h1>
            <p className="text-gray-500">Error loading proposal</p>
          </div>
        </div>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || "Failed to load proposal details"}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }
  
  // Get status info
  const statusInfo = getStatusInfo(proposal.status);
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Proposal Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefreshStatus}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh Status
            </Button>
          </div>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="space-y-3 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading proposal details...</p>
            </div>
          </div>
        ) : proposal ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Proposal details card */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex justify-between">
                  <div>
                    <CardTitle>Withdrawal Request</CardTitle>
                    <CardDescription>
                      Proposal ID: {proposal.id}
                      {proposal.contract_proposal_id !== null && (
                        <span className="ml-2">(Contract ID: {proposal.contract_proposal_id})</span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusBadgeVariant(proposal.status)}>
                    {formatStatus(proposal.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Project</div>
                    <div className="font-medium">{proposal.project_name}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Amount</div>
                    <div className="font-medium text-xl">
                      {formatCurrency(proposal.amount)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Recipient Type</div>
                    <div className="font-medium capitalize flex items-center">
                      {proposal.transfer_type === 'bank' ? (
                        <>
                          <Building className="h-4 w-4 mr-1" />
                          Bank Transfer
                        </>
                      ) : (
                        <>
                          <Landmark className="h-4 w-4 mr-1" />
                          Crypto Transfer
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Date Requested</div>
                    <div className="font-medium">{formatDate(proposal.created_at)}</div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Description</div>
                  <div className="bg-secondary p-3 rounded-md">
                    {proposal.description}
                  </div>
                </div>
                
                {proposal.milestone_name && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Linked Milestone</div>
                    <div className="bg-secondary p-3 rounded-md flex justify-between items-center">
                      <div>
                        <div className="font-medium">{proposal.milestone_name}</div>
                        <div className="text-sm text-muted-foreground">{proposal.milestone_description?.substring(0, 100)}...</div>
                      </div>
                      <Badge variant="outline">{proposal.milestone_percentage}%</Badge>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Evidence</div>
                  <a 
                    href={`https://ipfs.io/ipfs/${proposal.evidence_ipfs_hash}`} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    View Documentation
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </div>
                
                {proposal.transaction_hash && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Transaction Hash</div>
                    <a 
                      href={`https://sepolia.scrollscan.com/tx/${proposal.transaction_hash}`} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-primary hover:underline break-all"
                    >
                      {proposal.transaction_hash}
                      <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                    </a>
                  </div>
                )}
                
                {['approved', 'pending_transfer'].includes(proposal.status) && (
                  <ProposalExecuteButton 
                    proposal={proposal}
                    onExecuted={handleRefreshStatus}
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>
            
            {/* Voting card */}
            <ProposalVoteForm 
              proposalId={proposal.id.toString()}
              contractProposalId={proposal.contract_proposal_id}
              aiScore={proposal.ai_verification_score}
              aiNotes={proposal.ai_verification_notes}
            />
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Not found</AlertTitle>
            <AlertDescription>Proposal not found or has been deleted.</AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
} 