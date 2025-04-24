"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Building, Users, Wallet, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import { ConnectWallet } from "@/components/blockchain/connect-wallet";
import Link from "next/link";
import { charityApi, projectsApi, proposalsApi } from "@/lib/api";
import { BlurContainer } from "@/components/ui/blur-container";

// Add Project interface
interface Project {
  id: number;
  name: string;
  description: string;
  charity_id: number;
  charity?: {
    id: number;
    name: string;
  };
  verification_status?: string;
  status?: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuthStore();
  
  // Add debug logs
  console.log('Admin Dashboard State:', {
    user,
    isLoading,
    isAuthenticated,
    userRole: user?.role
  });
  
  const [stats, setStats] = useState({
    totalCharities: 0,
    pendingVerifications: 0,
    totalProjects: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    // Only check role after loading is complete and we have auth data
    if (!isLoading) {
      // Only redirect if we have user data but it's not an admin
      if (isAuthenticated && user && user.role !== "admin") {
        console.log('Redirecting - Not admin:', { user });
        router.push("/dashboard");
        return;
      }
      
      // Fetch stats if we're authenticated as admin
      if (isAuthenticated && user && user.role === "admin") {
        fetchStats();
      }
    }
  }, [user, router, isLoading, isAuthenticated]);

  // Fetch dashboard stats - using real API calls
  const fetchStats = async () => {
    try {
      // Fetch projects since that's the API we have available
      const projectsData = await projectsApi.getAllProjects(1, 100);
      
      // Debug: Log what we're receiving from the API
      console.log('Projects data:', projectsData);
      
      // Get project count from the response
      const totalProjects = projectsData?.total || projectsData?.projects?.length || 0;
      
      // Count pending verification projects
      let pendingVerifications = 0;
      if (projectsData?.projects) {
        pendingVerifications = projectsData.projects.filter(
          (project: Project) => project.verification_status === "pending" || 
                     project.status === "pending_verification"
        ).length || 0;
      }
      
      // Count unique charities from projects
      let totalCharities = 0;
      
      if (projectsData?.projects && Array.isArray(projectsData.projects)) {
        const charityIds = new Set();
        
        projectsData.projects.forEach((project: Project) => {
          // Debug: log charity_id for each project
          console.log(`Project: ${project.name}, charity_id: ${project.charity_id}`);
          
          if (project.charity_id) {
            charityIds.add(project.charity_id);
          } else if (project.charity && project.charity.id) {
            // Alternative structure
            charityIds.add(project.charity.id);
          }
        });
        
        console.log('Unique charity IDs found:', Array.from(charityIds));
        totalCharities = charityIds.size;
      }
      
      // Ensure we have at least 1 charity if there are projects
      if (totalProjects > 0 && totalCharities === 0) {
        console.log('Projects found but no charities detected, setting charity count to at least 1');
        totalCharities = 1;
      }
      
      // For total users, we would need a dedicated admin API
      // Using a placeholder for now
      const totalUsers = 0;
      
      // Debug the final stats before setting state
      console.log('Setting dashboard stats:', {
        totalCharities,
        pendingVerifications,
        totalProjects,
        totalUsers,
      });
      
      setStats({
        totalCharities,
        pendingVerifications,
        totalProjects,
        totalUsers,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      // Set default values in case of error
      setStats({
        totalCharities: 0,
        pendingVerifications: 0,
        totalProjects: 0,
        totalUsers: 0,
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <BlurContainer intensity="light" className="py-2">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage platform settings, verify charities, and monitor activity.
            </p>
          </div>
        </BlurContainer>

        <BlurContainer>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Charities
                </CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCharities}</div>
                <p className="text-xs text-muted-foreground">
                  Registered on the platform
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Verifications
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingVerifications}</div>
                <p className="text-xs text-muted-foreground">
                  Charities awaiting verification
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Projects
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProjects}</div>
                <p className="text-xs text-muted-foreground">
                  Active & completed projects
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  Registered platform users
                </p>
              </CardContent>
            </Card>
          </div>
        </BlurContainer>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <BlurContainer className="h-full">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link 
                    href="/dashboard/admin/charities"
                    className="block w-full px-4 py-2 text-left text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Verify Charities
                  </Link>
                  <Link 
                    href="/dashboard/admin/projects"
                    className="block w-full px-4 py-2 text-left text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Verify Projects
                  </Link>
                  <Link 
                    href="/dashboard/admin/quadratic-funding"
                    className="block w-full px-4 py-2 text-left text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  >
                    Manage Quadratic Funding
                  </Link>
                  <Link 
                    href="/dashboard/admin/users"
                    className="block w-full px-4 py-2 text-left text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  >
                    Manage Users
                  </Link>
                  <Link 
                    href="/dashboard/admin/transfers"
                    className="block w-full px-4 py-2 text-left text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  >
                    Review Transfers
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Admin Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Default admin login credentials:
                  </p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 text-sm">
                      <span className="font-medium">Username:</span>
                      <span className="col-span-3">admin</span>
                    </div>
                    <div className="grid grid-cols-4 text-sm">
                      <span className="font-medium">Password:</span>
                      <span className="col-span-3">admin</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Please change these default credentials immediately in the profile settings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </BlurContainer>

          <BlurContainer className="h-full">
            <div className="space-y-4">
              <ConnectWallet />
              
              <Card>
                <CardHeader>
                  <CardTitle>Blockchain Operations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your wallet to perform these operations:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-600" />
                      <span>Verify charity organizations</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-600" />
                      <span>Verify project proposals</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-600" />
                      <span>Distribute quadratic funding to projects</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-600" />
                      <span>Create new funding rounds</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-600" />
                      <span>Verify withdrawal proposals</span>
                    </li>
                  </ul>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-medium mb-2">Quadratic Funding Management</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      You can manage funding rounds and distributions from the Quadratic Funding page.
                    </p>
                    <Link 
                      href="/dashboard/admin/quadratic-funding"
                      className="block w-full px-4 py-2 text-center text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Manage Funding Rounds
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </BlurContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}