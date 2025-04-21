"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { 
  CircleDollarSign, 
  LineChart, 
  Users, 
  TrendingUp, 
  Calendar, 
  PlusCircle, 
  Lightbulb,
  ArrowRight
} from "lucide-react";
import { api } from "@/services/api";

export default function CorporateDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    activePools: 0,
    totalFunded: "0",
    projectsSupported: 0,
    uniqueContributors: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pools, setPools] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        
        // Get company information
        const companyResponse = await api.companyApi.getMyCompany();
        const company = companyResponse.success ? companyResponse.data : null;
        
        // Get pools for the company
        const poolsResponse = await api.poolsApi.getPools(1, 10, { company_id: company?.id });
        const poolsData = poolsResponse.success ? poolsResponse.data.pools : [];
        
        // Update pools state
        setPools(poolsData);
        
        // Calculate stats from real data
        const activePools = poolsData.filter(pool => pool.is_active).length;
        
        // For now, use placeholder values for remaining stats
        // In a real implementation, these would be calculated from API responses
        setStats({
          activePools,
          totalFunded: poolsData.reduce((sum, pool) => sum + parseFloat(pool.total_funds || "0"), 0).toLocaleString(),
          projectsSupported: poolsData.reduce((sum, pool) => sum + (pool.project_count || 0), 0),
          uniqueContributors: 156 // This would come from a separate API call in a real implementation
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Active Pools",
      value: stats.activePools,
      icon: CircleDollarSign,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Funded",
      value: `$${stats.totalFunded}`,
      icon: LineChart,
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      title: "Projects Supported",
      value: stats.projectsSupported,
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
    {
      title: "Unique Contributors",
      value: stats.uniqueContributors,
      icon: TrendingUp,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">
          Manage your corporate social impact through themed funding pools
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className={`${stat.bgColor} border-none`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Funding Pools</CardTitle>
            <CardDescription>Overview of your active and recently completed pools</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading recent pools...</div>
            ) : pools.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No funding pools found. Create your first pool to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {pools.slice(0, 3).map((pool) => (
                  <div key={pool.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-medium">{pool.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {pool.is_active ? "Active" : "Inactive"} • 
                        ${parseFloat(pool.total_funds || "0").toLocaleString()} funded • 
                        {pool.project_count || 0} projects
                      </p>
                    </div>
                    <Link href={`/dashboard/corporate/pools/${pool.id}`}>
                      <Button variant="outline" size="sm">View Details</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/dashboard/corporate/pools" className="w-full">
              <Button variant="outline" className="w-full">View All Pools</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/corporate/pools/create" className="block">
              <Button className="w-full justify-start" size="lg">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Funding Pool
              </Button>
            </Link>
            <Link href="/dashboard/corporate/impact" className="block">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <LineChart className="mr-2 h-4 w-4" />
                View Impact Reports
              </Button>
            </Link>
            <Link href="/dashboard/wallet" className="block">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <CircleDollarSign className="mr-2 h-4 w-4" />
                Fund Your Wallet
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Pool Deadlines</CardTitle>
          <CardDescription>Track important dates for your funding pools</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading deadlines...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-blue-500 mt-1" />
                  <div>
                    <p className="font-medium">Environmental Innovation Fund - Round End</p>
                    <p className="text-sm text-muted-foreground">May 15, 2023 (in 14 days)</p>
                  </div>
                </div>
                <Link href="/dashboard/corporate/pools/1">
                  <Button variant="ghost" size="sm"><ArrowRight className="h-4 w-4" /></Button>
                </Link>
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-blue-500 mt-1" />
                  <div>
                    <p className="font-medium">Healthcare Access Initiative - Final Decisions</p>
                    <p className="text-sm text-muted-foreground">May 22, 2023 (in 21 days)</p>
                  </div>
                </div>
                <Link href="/dashboard/corporate/pools/2">
                  <Button variant="ghost" size="sm"><ArrowRight className="h-4 w-4" /></Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex gap-4 items-start">
          <Lightbulb className="h-6 w-6 text-blue-500 mt-1" />
          <div>
            <h3 className="text-lg font-medium text-blue-800 mb-2">Create Your First Funding Pool</h3>
            <p className="text-blue-700 mb-4">
              You can create themed funding pools aligned with your corporate ESG goals. Your contributions will be matched with donation volume for maximum impact.
            </p>
            <Link href="/dashboard/corporate/pools/create">
              <Button>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 