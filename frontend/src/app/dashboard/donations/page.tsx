"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectsApi, donationsApi } from "@/lib/api";
import { Loader2, Search, PieChart, BarChart3, CalendarDays, Landmark, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { QuadraticFundingInfo } from "@/components/funding/quadratic-funding-info";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// Define the Project interface
interface Project {
  id: string | number;
  name: string;
  description: string;
  funding_goal: number;
  funding_progress?: {
    raised: number;
  };
}

// Define the Donation interface
interface Donation {
  id: string | number;
  project_id: string | number;
  project_name: string;
  amount: number;
  created_at: string;
  transaction_hash?: string;
  matched_amount?: number;
  status: string;
  charity_name?: string;
}

// Define donation stats interface
interface DonationStats {
  total_donated: number;
  projects_supported: number;
  total_impact: number;
  matched_amount: number;
}

export default function DonationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [userDonations, setUserDonations] = useState<Donation[]>([]);
  const [donationStats, setDonationStats] = useState<DonationStats>({
    total_donated: 0,
    projects_supported: 0,
    total_impact: 0,
    matched_amount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        // Fetch user's donations
        const donationsResponse = await donationsApi.getUserDonations();
        if (donationsResponse.success && donationsResponse.data) {
          const fetchedDonations: Donation[] = donationsResponse.data.donations || [];
          setUserDonations(fetchedDonations);
          
          // Calculate stats
          const totalDonated = fetchedDonations.reduce((sum: number, donation: Donation) => sum + Number(donation.amount), 0);
          const totalMatched = fetchedDonations.reduce((sum: number, donation: Donation) => sum + Number(donation.matched_amount ?? 0), 0);
          const projectIds = new Set(fetchedDonations.map(donation => donation.project_id));
          
          setDonationStats({
            total_donated: totalDonated,
            projects_supported: projectIds.size,
            total_impact: totalDonated + totalMatched,
            matched_amount: totalMatched
          });
        }

        // Fetch all projects
        const projectsResponse = await projectsApi.getAllProjects();
        if (projectsResponse.success && projectsResponse.data) {
          const fetchedProjects = (projectsResponse.data.projects || []) as Project[];
          setProjects(fetchedProjects);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({
          title: "Error",
          description: "Failed to load your donation data. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [toast]);

  // Filter projects based on search term
  const filteredProjects = projects.filter((project) => {
    return (
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleDonate = (projectId: string | number) => {
    console.log("Attempting to donate to project with ID:", projectId);
    
    const idAsString = String(projectId);
    if (projectId === undefined || projectId === null || (isNaN(parseInt(idAsString)) && projectId !== 0)) {
      console.error("Invalid project ID:", projectId);
      toast({
        title: "Error",
        description: "This project has an invalid ID and cannot be donated to.",
        variant: "destructive",
      });
      return;
    }
    
    const numericId = parseInt(idAsString, 10);
    router.push(`/dashboard/donations/${numericId}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "ETH",
      minimumFractionDigits: 4,
      maximumFractionDigits: 8
    }).format(amount ?? 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const calculateProgress = (raised: number | undefined, goal: number) => {
    const currentRaised = raised ?? 0;
    if (goal <= 0) {
      return 0;
    }
    return Math.min(Math.round((currentRaised / goal) * 100), 100);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'donation':
        return 'bg-blue-100 text-blue-800';
      case 'matched':
        return 'bg-purple-100 text-purple-800';
      case 'quadratic':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Your Donation Dashboard</h1>
          <p className="text-muted-foreground">
            Track your contributions and the impact you've made
          </p>
        </div>

        {/* Directly render the impact stats and history without tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Donated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Landmark className="mr-2 h-4 w-4 text-primary" />
                <div className="text-2xl font-bold">{formatCurrency(donationStats.total_donated)}</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Projects Supported
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <BarChart3 className="mr-2 h-4 w-4 text-primary" />
                <div className="text-2xl font-bold">{donationStats.projects_supported}</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Matched Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <PieChart className="mr-2 h-4 w-4 text-primary" />
                <div className="text-2xl font-bold">{formatCurrency(donationStats.matched_amount)}</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                <div className="text-2xl font-bold">{formatCurrency(donationStats.total_impact)}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Donation History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Recent transactions from your wallet</CardDescription>
          </CardHeader>
          <CardContent>
            {userDonations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">You haven't made any donations yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userDonations.map((donation) => (
                  <div key={donation.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={getTypeBadgeClass('donation')}>
                          Donation
                        </Badge>
                        <Badge className={getStatusBadgeClass(donation.status || 'completed')}>
                          {donation.status ? (donation.status.charAt(0).toUpperCase() + donation.status.slice(1)) : 'Completed'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">{formatDate(donation.created_at)}</p>
                      <p className="text-sm font-medium mt-1">
                        Project: {donation.project_name}
                      </p>
                      {donation.charity_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          Charity: {donation.charity_name}
                        </p>
                      )}
                      {donation.transaction_hash && (
                        <>
                          <p className="text-xs text-gray-500 mt-1">
                            Block: {donation.transaction_hash.includes('_') ? 'Internal' : '9293797'}
                          </p>
                          <div className="flex items-center mt-1">
                            <a
                              href={`https://sepolia.scrollscan.com/tx/${donation.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center"
                            >
                              {truncateAddress(donation.transaction_hash)}
                              <ExternalLink size={12} className="ml-1" />
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-800">
                        -{formatCurrency(Number(donation.amount))}
                      </div>
                      {(donation.matched_amount ?? 0) > 0 && (
                        <div className="text-sm text-green-600 font-medium text-right">
                          +{formatCurrency(donation.matched_amount ?? 0)} matched
                        </div>
                      )}
                      <div className="mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/projects/${donation.project_id}`)}
                          className="text-xs"
                        >
                          View Project
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
} 