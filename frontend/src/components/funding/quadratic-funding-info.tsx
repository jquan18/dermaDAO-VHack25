"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoIcon, CircleDollarSign, ExternalLink } from "lucide-react";
import { quadraticFundingApi } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";

interface QuadraticFundingInfoProps {
  className?: string;
  showLearnMore?: boolean;
  poolId: number;
}

export function QuadraticFundingInfo({ className, showLearnMore = true, poolId }: QuadraticFundingInfoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [poolData, setPoolData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPoolData = async () => {
      if (poolId === undefined) {
        setError("No pool ID provided");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const response = await quadraticFundingApi.getPool(poolId);
        
        if (response.success) {
          setPoolData(response.data);
        } else {
          setError("Failed to load funding pool data");
        }
      } catch (err) {
        console.error("Error fetching funding pool data:", err);
        setError("An error occurred while loading funding pool data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoolData();
  }, [poolId]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-36" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !poolData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Quadratic Funding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground">{error || "No active funding round"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isActive = new Date(poolData.end_time) > new Date();
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CircleDollarSign className="mr-2 h-5 w-5 text-primary" />
          Quadratic Funding
        </CardTitle>
        <CardDescription>
          Your donations have more impact with quadratic matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-primary/5 p-4">
          <div className="flex items-start gap-2">
            <InfoIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium">How it works</h4>
              <p className="text-sm text-muted-foreground mt-1">
                When verified users donate to projects, their contribution is counted for quadratic matching.
                The more individual donors a project has, the more matching funds it receives.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Round:</span>
            <span className="font-medium">
              {isActive ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-yellow-600">Completed</span>
              )}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Round Period:</span>
            <span className="font-medium">
              {formatDateTime(poolData.start_time)} - {formatDateTime(poolData.end_time)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Participating Projects:</span>
            <span className="font-medium">{poolData.projects?.length || 0}</span>
          </div>
        </div>
      </CardContent>
      {showLearnMore && (
        <CardFooter className="border-t bg-secondary/5 px-6">
          <Link href="/how-it-works#quadratic-funding" passHref>
            <Button variant="link" className="p-0 h-auto text-primary">
              Learn more about quadratic funding
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
} 