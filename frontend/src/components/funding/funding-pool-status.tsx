"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  CircleDollarSign,
  Database,
  Loader2,
  CalendarDays,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { quadraticFundingApi } from "@/lib/api"; // Assuming this has getPool(id)
import { formatCurrency } from "@/lib/utils";
import { Button } from "../ui/button";

interface FundingPoolStatusProps {
  className?: string;
  poolId?: number; // Made optional, component needs poolId to fetch data
}

export function FundingPoolStatus({ className, poolId }: FundingPoolStatusProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [poolData, setPoolData] = useState<any>(null); // State to hold pool details
  const [poolBalance, setPoolBalance] = useState<string>("0"); // Still fetch blockchain balance
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Function to fetch data
  const fetchData = async () => {
    if (!poolId) {
      setError("No Pool ID provided to status component.");
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);

      // Fetch pool details and balance
      // TODO: Add getPool to quadraticFundingApi if it doesn't exist
      // Or use a different API endpoint if pool details are elsewhere
      const [balanceResponse, poolResponse] = await Promise.all([
        quadraticFundingApi.getPoolBalance(), // Keep fetching balance if relevant
        poolId ? quadraticFundingApi.getPool(poolId) : Promise.resolve({ success: false, error: 'No Pool ID' }) // Fetch pool details
      ]);

      if (balanceResponse.success) {
        setPoolBalance(balanceResponse.data.pool_balance);
      } else {
        setError("Failed to load pool balance");
      }

      if (poolResponse.success) {
        setPoolData(poolResponse.data); // Store pool details
      } else {
        setError(error => error || `Failed to load pool data: ${poolResponse.error || 'Unknown error'}`);
        setPoolData(null);
      }
    } catch (err) {
      console.error("Error fetching funding pool data:", err);
      setError("Failed to load funding pool data");
      setPoolData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch and refetch on poolId change or refreshKey change
  useEffect(() => {
    fetchData();
  }, [refreshKey, poolId]);

  // Auto-refresh can be kept if desired
  useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // --- UI Rendering --- 

  if (!poolId) {
      return (
        <Card className={className}>
           <CardHeader><CardTitle>Pool Status</CardTitle></CardHeader>
           <CardContent><Alert variant="warning"><AlertDescription>Please select a pool.</AlertDescription></Alert></CardContent>
        </Card>
      );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle><Skeleton className="h-6 w-40" /></CardTitle>
          <CardDescription><Skeleton className="h-4 w-56" /></CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Loading pool status...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !poolData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
           <CardTitle>Pool Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Failed to load pool data."}</AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k+1)} className="mt-2">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // Use poolData for display
  const startDate = poolData.start_date ? new Date(poolData.start_date) : null;
  const endDate = poolData.end_date ? new Date(poolData.end_date) : null;
  const now = new Date();
  const isPoolActive = poolData.is_active && startDate && endDate && now >= startDate && now <= endDate;
  const isEnded = endDate && now > endDate;
  // Assumes poolData might have an `is_distributed` flag from the DB
  const isDistributed = poolData.is_distributed || false;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle>Pool Status: {poolData.name}</CardTitle>
        <CardDescription>
          Overview of the selected funding pool.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Display general pool info */} 
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center">
              <CircleDollarSign className="h-6 w-6 mr-3 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Pool Funds (DB)</p>
                <p className="text-xl font-semibold">{formatCurrency(poolData.total_funds || 0)}</p>
                 {/* Optionally show blockchain balance too */} 
                 {/* <p className="text-xs text-muted-foreground">Blockchain Balance: {formatCurrency(poolBalance)}</p> */} 
              </div>
            </div>
             <Badge variant={isPoolActive ? "success" : isEnded ? "secondary" : "outline"}>
                {isPoolActive ? "Active" : isEnded ? "Ended" : poolData.is_active ? "Scheduled" : "Inactive"}
              </Badge>
          </div>

          <Separator />

          {/* Display Dates and Distribution Status */} 
           <div className="space-y-2 text-sm">
             {startDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><CalendarDays className="inline h-4 w-4 mr-1"/> Start Date</span>
                  <span>{startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
             )}
             {endDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center"><CalendarDays className="inline h-4 w-4 mr-1"/> End Date</span>
                  <span>{endDate.toLocaleDateString()} {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
             )}
              <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center">
                      {isDistributed ? <CheckCircle2 className="inline h-4 w-4 mr-1 text-green-600"/> : <XCircle className="inline h-4 w-4 mr-1 text-muted-foreground"/>}
                      Distribution Status
                  </span>
                  <Badge variant={isDistributed ? "success" : "outline"}>
                    {isDistributed ? "Completed" : "Pending"}
                  </Badge>
              </div>
           </div>

          {/* REMOVED: Round Progress Bar */}

        </div>
      </CardContent>
    </Card>
  );
} 