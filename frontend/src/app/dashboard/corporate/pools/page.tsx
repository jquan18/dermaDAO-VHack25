"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  PlusCircle, 
  CircleDollarSign, 
  Users, 
  CalendarDays, 
  ArrowUpRight, 
  LineChart, 
  TrendingUp,
  Lightbulb,
  ArrowRight
} from "lucide-react";
import { quadraticFundingApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";

// Define interface for pool data
interface Pool {
  id: string | number;
  name: string;
  theme?: string;
  description?: string;
  is_active: boolean;
  total_funds?: string;
  project_count?: number;
  end_date?: string;
}

export default function CorporatePools() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    activePools: 0,
    totalFunded: "0",
    projectsSupported: 0,
    uniqueContributors: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        if (user && user.id) {
          // Fetch all pools and then filter by the current user's ID as sponsor
          const response = await quadraticFundingApi.getPools(1, 100, { sponsor_id: user.id });
          
          // The API returns the array of pools directly in response.data
          if (response.success && Array.isArray(response.data)) {
            const poolsData = response.data as Pool[];
            setPools(poolsData);
            
            // Calculate stats from real data
            const activePools = poolsData.filter(pool => pool.is_active).length;
            
            // Update stats
            setStats({
              activePools,
              totalFunded: poolsData.reduce((sum: number, pool: Pool) => 
                sum + parseFloat(pool.total_funds || "0"), 0).toLocaleString(),
              projectsSupported: poolsData.reduce((sum: number, pool: Pool) => 
                sum + (pool.project_count || 0), 0),
              uniqueContributors: 156 // This would come from a separate API call in a real implementation
            });
          } else {
            console.error("Failed to fetch pools or response data is not an array:", response);
            setPools([]);
          }
        } else {
          console.error("User not loaded yet or missing ID");
          setPools([]);
        }
      } catch (error) {
        console.error("Error fetching pools:", error);
        setPools([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

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
    <div className="py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funding Pools</h1>
          <p className="text-muted-foreground mt-1">
            Manage your sponsored quadratic funding pools
          </p>
        </div>
        <Link href="/dashboard/corporate/pools/create">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Pool
          </Button>
        </Link>
      </div>

      {/* Stats Section */}
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

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64 mt-1" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pools.length === 0 ? (
        <>
          <Card className="bg-gray-50 border border-dashed border-gray-200">
            <CardContent className="py-8">
              <div className="text-center space-y-3">
                <CircleDollarSign className="h-10 w-10 mx-auto text-gray-400" />
                <h3 className="text-lg font-medium">No Funding Pools Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Create your first quadratic funding pool to start supporting projects aligned with your corporate values.
                </p>
                <Link href="/dashboard/corporate/pools/create">
                  <Button className="mt-2">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Your First Pool
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          {/* First Pool Creation Guide */}
        </>
      ) : (
        <div className="space-y-4">
          {pools.map((pool) => (
            <Card key={pool.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{pool.name}</CardTitle>
                    <CardDescription>{pool.theme}</CardDescription>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    pool.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {pool.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm text-gray-600 line-clamp-2 mb-4">{pool.description}</p>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4 text-gray-500" />
                    <span>${parseFloat(typeof pool.total_funds === 'string' ? pool.total_funds : "0").toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>{pool.project_count || 0} Projects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-gray-500" />
                    <span>
                      {pool.end_date 
                        ? new Date(pool.end_date).toLocaleDateString() 
                        : 'No end date'}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Link href={`/dashboard/corporate/pools/${pool.id}`} className="w-full">
                  <Button variant="secondary" className="w-full">
                    View Details
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 