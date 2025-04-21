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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { projectsApi, proposalsApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ProposalsPage() {
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch all projects for the charity admin
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        console.log("=== Proposals Page: fetchProjects START ===");
        setIsLoading(true);
        setError(null);
        
        console.log("Calling projectsApi.getCharityProjects()");
        const response = await projectsApi.getCharityProjects();
        console.log("getCharityProjects response:", response);
        
        if (response.success && response.data) {
          // Check if data is an array (direct from backend) or has projects property (from our error handler)
          const projectsList = Array.isArray(response.data) 
            ? response.data 
            : (response.data.projects || []);
            
          console.log("Projects list:", projectsList);
          setProjects(projectsList);
          
          // For each project, fetch its proposals
          const allProposals: any[] = [];
          
          if (projectsList.length > 0) {
            console.log("Fetching proposals for each project");
            await Promise.all(
              projectsList.map(async (project: any) => {
                try {
                  if (project.project_id || project.id) {
                    const projectId = (project.project_id || project.id).toString();
                    console.log(`Fetching proposals for project ${projectId}`);
                    const proposalsResponse = await proposalsApi.getProjectProposals(projectId);
                    console.log(`Proposals response for project ${projectId}:`, proposalsResponse);
                    
                    if (proposalsResponse.success && proposalsResponse.data && proposalsResponse.data.proposals) {
                      // Add project info to each proposal
                      const projectProposals = proposalsResponse.data.proposals.map((proposal: any) => ({
                        ...proposal,
                        project_name: project.name,
                        project_id: projectId,
                      }));
                      
                      console.log(`Found ${projectProposals.length} proposals for project ${projectId}`);
                      allProposals.push(...projectProposals);
                    }
                  }
                } catch (err) {
                  console.error(`Error fetching proposals for project ${project.project_id || project.id}:`, err);
                }
              })
            );
          } else {
            console.log("No projects found, skipping proposal fetching");
          }
          
          // Sort all proposals by creation date (newest first)
          allProposals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          console.log("All proposals:", allProposals);
          
          setProposals(allProposals);
        } else if (response.error) {
          console.error("Error in response:", response.error);
          setError(response.error.message || "Failed to load projects");
        } else {
          console.error("Unexpected response format:", response);
          setError("Unexpected response format from API");
        }
      } catch (err: any) {
        console.error("Error fetching projects:", err);
        setError(err.response?.data?.error?.message || "Failed to load projects");
      } finally {
        setIsLoading(false);
        console.log("=== Proposals Page: fetchProjects END ===");
      }
    };
    
    fetchProjects();
  }, []);
  
  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'success';
      case 'pending_verification':
      case 'transfer_initiated':
        return 'warning';
      case 'rejected':
      case 'processing_error':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  
  // Format status text
  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };
  
  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Withdrawal Proposals</h1>
          <p className="text-gray-500">
            Manage fund withdrawal requests for your projects
          </p>
        </div>
        
        <Button onClick={() => router.push('/dashboard/charity/proposals/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Proposal
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            {error.includes("not associated with a charity") && (
              <div className="mt-2">
                <p>You need to create or be assigned to a charity before you can manage proposals.</p>
                <Button 
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => router.push('/dashboard/charity/create')}
                >
                  Create a Charity
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>All Withdrawal Proposals</CardTitle>
          <CardDescription>
            View and track the status of all your withdrawal requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center border-b pb-3">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-3 bg-gray-200 rounded w-32"></div>
                  </div>
                  <div className="h-8 bg-gray-200 rounded w-24"></div>
                </div>
              ))}
            </div>
          ) : proposals.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="truncate max-w-[200px]">
                            {proposal.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{proposal.project_name}</TableCell>
                      <TableCell>{formatCurrency(proposal.amount)} ETH</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(proposal.status)}>
                          {formatStatus(proposal.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(proposal.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/charity/proposals/${proposal.id}`)}
                        >
                          Details
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No proposals found</h3>
              <p className="text-gray-500 mb-4">
                You haven't created any withdrawal proposals yet.
              </p>
              <Button onClick={() => router.push('/dashboard/charity/proposals/new')}>
                Create your first proposal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
} 