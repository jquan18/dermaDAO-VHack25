"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  CheckSquare as VoteIcon,
  Users,
  SlidersHorizontal
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { formatCurrency, formatDate } from "@/lib/utils";
import { proposalsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export default function DonorProposalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [proposals, setProposals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch the projects user has donated to
  useEffect(() => {
    const fetchProposals = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // In a real implementation, we would have an API to get all proposals for projects
        // the user has donated to. For now, we'll simulate this by getting all proposals.
        
        // This would typically be:
        // const response = await proposalsApi.getDonorProposals();
        
        // For simulation, we'll get all proposals
        const allProposalsResponse = await proposalsApi.getAllProposals();
        
        if (allProposalsResponse.success) {
          setProposals(allProposalsResponse.data.proposals || []);
        } else if (allProposalsResponse.error) {
          setError(allProposalsResponse.error.message || "Failed to load proposals");
        }
      } catch (err: any) {
        console.error("Error fetching proposals:", err);
        setError(err.message || "An error occurred while loading proposals");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProposals();
  }, []);
  
  // Get status badge component based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_donor_approval":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-yellow-500 text-yellow-500">
            <VoteIcon size={14} />
            <span>Awaiting Votes</span>
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-green-500 text-green-500">
            <CheckCircle size={14} />
            <span>Approved</span>
          </Badge>
        );
      case "executed":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-blue-500 text-blue-500">
            <SlidersHorizontal size={14} />
            <span>Executed</span>
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-red-500 text-red-500">
            <XCircle size={14} />
            <span>Rejected</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock size={14} />
            <span>{status.replace(/_/g, " ")}</span>
          </Badge>
        );
    }
  };
  
  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Proposals for Your Donations</h1>
      </div>
      
      <div className="mb-6">
        <p className="text-muted-foreground">
          As a donor, you have the power to approve or reject withdrawal proposals for projects you've donated to.
          Each proposal requires approval from at least 51% of donors before funds can be released.
        </p>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>Loading proposals...</p>
        </div>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40">
            <p className="text-muted-foreground mb-4 text-center">
              No proposals found for projects you've donated to.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/donations">View Your Donations</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <Card key={proposal.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{proposal.project_name || "Project Proposal"}</CardTitle>
                    <CardDescription className="mt-1">
                      {formatDate(proposal.created_at)} 
                      · Amount: {formatCurrency(proposal.amount)} ETH
                    </CardDescription>
                  </div>
                  {getStatusBadge(proposal.status)}
                </div>
              </CardHeader>
              
              <CardContent className="pb-2">
                <p className="line-clamp-2 text-muted-foreground">
                  {proposal.description}
                </p>
                
                {proposal.status === 'pending_donor_approval' && (
                  <div className="mt-3 flex items-center text-sm text-muted-foreground">
                    <Users size={14} className="mr-1" />
                    <span>
                      {proposal.current_approvals || 0} of {proposal.required_approvals} approvals
                    </span>
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="flex justify-between pt-2">
                <div className="text-sm text-muted-foreground">
                  ID: {proposal.id}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center"
                  onClick={() => router.push(`/dashboard/charity/proposals/${proposal.id}`)}
                >
                  {proposal.status === 'pending_donor_approval' ? 'Vote Now' : 'View Details'}
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
} 