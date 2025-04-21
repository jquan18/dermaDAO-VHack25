"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { formatCurrency, formatDate, calculateProgress } from "@/lib/utils";
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  AlertCircle,
  ArrowRightCircle,
  Layers,
  Plus,
  Users,
} from "lucide-react";
import { QuadraticFundingInfo } from "@/components/funding/quadratic-funding-info";
import { projectsApi, donationsApi, proposalsApi, bankAccountsApi, bankTransfersApi, walletApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

export default function CharityDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [dashboardData, setDashboardData] = useState({
    totalDonations: 0,
    activeProjects: 0,
    pendingProposals: 0,
    verifiedBankAccounts: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [charityData, setCharityData] = useState(null);
  const [charityStats, setCharityStats] = useState<any>({});
  const [projects, setProjects] = useState<any[]>([]);
  const [transferableAmount, setTransferableAmount] = useState(0);
  const [proposals, setProposals] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [recentDonations, setRecentDonations] = useState<any[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Only run this effect if we're authenticated as a charity admin
    if (!isLoading && isAuthenticated && user?.role === "charity_admin" && user?.charity_id) {
      fetchDashboardData();
    }
  }, [isLoading, isAuthenticated, user]);
  
  const fetchDashboardData = async () => {
    try {
      if (!user?.charity_id) return;
      
      // Fetch projects for this charity
      const projectsResponse = await projectsApi.getCharityProjects(user.charity_id);
      const charityProjects = projectsResponse?.projects || [];
      
      // Fetch wallet balances for each project
      for (const project of charityProjects) {
        try {
          const walletData = await walletApi.getWalletDataFromScrollScan(project.wallet_address);
          console.log(`Wallet data for project ${project.id}:`, walletData);
          project.wallet_balance = walletData.data?.balance || '0.00';
        } catch (err) {
          console.error(`Error fetching wallet data for project ${project.id}:`, err);
          project.wallet_balance = '0.00';
        }
      }
      
      setProjects(charityProjects);
      
      // Calculate total donations from projects
      let totalDonations = 0;
      let allDonations: any[] = [];
      
      for (const project of charityProjects) {
        try {
          const donationStats = await donationsApi.getProjectDonations(project.id);
          totalDonations += donationStats.data?.total_raised || 0;
          
          // Collect donations for the recent donations section
          if (donationStats.data?.donations && Array.isArray(donationStats.data.donations)) {
            allDonations = [...allDonations, ...donationStats.data.donations.map((donation: any) => ({
              ...donation,
              project_name: project.name,
              project_id: project.id
            }))];
          }
        } catch (err) {
          console.error(`Error fetching donations for project ${project.id}:`, err);
        }
      }
      
      // Sort donations by date and take the most recent 5
      const sortedDonations = allDonations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 5);
      
      setRecentDonations(sortedDonations);
      
      // Fetch proposals
      const activeProjectIds = charityProjects.map((p: any) => p.id);
      let allProposals: any[] = [];
      
      for (const projectId of activeProjectIds) {
        try {
          const projectProposals = await proposalsApi.getProjectProposals(projectId);
          if (projectProposals && Array.isArray(projectProposals.proposals)) {
            allProposals = [...allProposals, ...projectProposals.proposals];
          }
        } catch (err) {
          console.error(`Error fetching proposals for project ${projectId}:`, err);
        }
      }
      setProposals(allProposals);
      
      // Fetch bank accounts
      try {
        const bankAccountsResponse = await bankAccountsApi.listBankAccounts();
        setBankAccounts(bankAccountsResponse.accounts || []);
        
        // Update dashboard data
        setDashboardData({
          totalDonations,
          activeProjects: charityProjects.filter((p: any) => p.status === 'active').length,
          pendingProposals: allProposals.filter((p: any) => p.status === 'pending').length,
          verifiedBankAccounts: (bankAccountsResponse?.accounts || []).filter((a: any) => a.is_verified).length,
        });
      } catch (err) {
        console.error("Error fetching bank accounts:", err);
        setBankAccounts([]);
        
        // Update dashboard data without bank accounts info
        setDashboardData({
          totalDonations,
          activeProjects: charityProjects.filter((p: any) => p.status === 'active').length,
          pendingProposals: allProposals.filter((p: any) => p.status === 'pending').length,
          verifiedBankAccounts: 0,
        });
      }
      
      // Fetch transfers for the first project (as an example)
      if (activeProjectIds.length > 0) {
        try {
          const transfersResponse = await bankTransfersApi.listProjectTransfers(activeProjectIds[0]);
          setTransfers(transfersResponse.transfers || []);
        } catch (err) {
          console.error("Error fetching transfers:", err);
          setTransfers([]);
        }
      }
      
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  // Format charity name (derived from user state)
  const charityName = user?.charity_id ? `${user.name}'s Charity` : 'Your Charity';

  return (
    <DashboardLayout>
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back, {user?.name}</h1>
        <p className="text-gray-600">
          Dashboard for {charityName} | Last login: {formatDate(new Date().toString())}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Donations</p>
                <h3 className="text-2xl font-bold mt-1">{formatCurrency(dashboardData.totalDonations)}</h3>
              </div>
              <div className="bg-primary/10 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="mt-4 text-xs font-medium text-green-600 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" /> Recent activity
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Projects</p>
                <h3 className="text-2xl font-bold mt-1">{dashboardData.activeProjects}</h3>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Layers className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <Link href="/dashboard/charity/projects">
                <Button variant="ghost" size="sm" className="px-0 text-blue-600 hover:text-blue-700">
                  View All Projects
                  <ArrowRightCircle className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Proposals</p>
                <h3 className="text-2xl font-bold mt-1">{dashboardData.pendingProposals}</h3>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4">
              <Link href="/dashboard/charity/proposals">
                <Button variant="ghost" size="sm" className="px-0 text-yellow-600 hover:text-yellow-700">
                  Review Proposals
                  <ArrowRightCircle className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Verified Bank Accounts</p>
                <h3 className="text-2xl font-bold mt-1">{dashboardData.verifiedBankAccounts}</h3>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <Link href="/dashboard/charity/bank-accounts">
                <Button variant="ghost" size="sm" className="px-0 text-green-600 hover:text-green-700">
                  Manage Accounts
                  <ArrowRightCircle className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Recent Projects</h2>
          <Link href="/dashboard/charity/projects/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Project
            </Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="mb-4">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-500">Wallet Balance</div>
                    <div className="text-lg font-semibold">{Number(project.wallet_balance).toFixed(3)} ETH</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {project.wallet_address.slice(0, 6)}...{project.wallet_address.slice(-4)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">Funding Progress</div>
                    <div className="mt-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{formatCurrency(project.funding_progress?.raised || 0)} ETH raised</span>
                        <span>{formatCurrency(project.funding_goal)} ETH goal</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${calculateProgress(
                              project.funding_progress?.raised || 0,
                              project.funding_goal
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Status</div>
                    <div className="mt-1">
                      <Badge variant={project.is_active ? "success" : "secondary"}>
                        {project.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/dashboard/charity/projects/${project.id}`)}
                >
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Proposals and Transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Donations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Donations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDonations.length > 0 ? (
                recentDonations.map((donation) => (
                  <div key={donation.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <h4 className="font-medium">{donation.donor || "Anonymous"}</h4>
                      <p className="text-sm text-gray-500">
                        {donation.project_name} • {formatDate(donation.created_at)}
                      </p>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(donation.amount)} ETH</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No recent donations</p>
                </div>
              )}
            </div>
            
            <div className="mt-4 text-center">
              <Link href="/dashboard/charity/projects">
                <Button variant="outline" size="sm">View All Projects</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Proposals */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proposals.slice(0, 3).map((proposal) => (
                <div key={proposal.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <h4 className="font-medium">{proposal.description}</h4>
                    <p className="text-sm text-gray-500">
                      Created: {formatDate(proposal.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-semibold">{formatCurrency(proposal.amount)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      proposal.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-center">
              <Link href="/dashboard/charity/proposals">
                <Button variant="outline" size="sm">View All Proposals</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Transfers */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transfers.map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <h4 className="font-medium">{transfer.reference}</h4>
                    <p className="text-sm text-gray-500">
                      Initiated: {formatDate(transfer.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-semibold">{formatCurrency(transfer.amount)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      transfer.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      transfer.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-center">
              <Link href="/dashboard/charity/transfers">
                <Button variant="outline" size="sm">View All Transfers</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Main content cards */}
          {/* ... existing content ... */}
        </div>
        
        <div className="space-y-6">
          {/* Sidebar cards */}
          <QuadraticFundingInfo />
          {/* ... existing sidebar content ... */}
        </div>
      </div>
    </DashboardLayout>
  );
} 