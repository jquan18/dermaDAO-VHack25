"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, CircleDollarSign, Users, CalendarDays, ArrowUpRight } from "lucide-react";
import { quadraticFundingApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";

export default function CorporatePools() {
  const [pools, setPools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchPools = async () => {
      try {
        setIsLoading(true);
        
        if (user && user.id) {
          // Fetch all pools and then filter by the current user's ID as sponsor
          const response = await quadraticFundingApi.getPools(1, 100, { sponsor_id: user.id });
          
          // The API returns the array of pools directly in response.data
          if (response.success && Array.isArray(response.data)) {
            setPools(response.data);
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
      fetchPools();
    }
  }, [user]);

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
                    <span>${parseFloat(pool.total_funds || 0).toLocaleString()}</span>
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