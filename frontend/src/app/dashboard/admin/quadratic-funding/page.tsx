"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { FundingPoolStatus } from "@/components/funding/funding-pool-status";
import { FundingDistribution } from "@/components/funding/funding-distribution";
import { ProjectAllocations } from "@/components/funding/project-allocations";
import { ExternalContributionForm } from "@/components/funding/external-contribution-form";
import { quadraticFundingApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCcw, ServerCrash, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuadraticFundingAdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPoolId, setSelectedPoolId] = useState<number | undefined>(undefined);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <DashboardLayout
      title="Quadratic Funding Admin"
      description="Manage quadratic funding pools, distributions, and contributions."
      headerActions={[]}
    >
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">QF Management</h2>
          <Button variant="ghost" size="icon" onClick={handleRefresh} aria-label="Refresh data">
            <RefreshCcw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {!selectedPoolId && (
           <Alert variant="info">
             <Info className="h-4 w-4" />
             <AlertTitle>Select Pool</AlertTitle>
             <AlertDescription>
               Please select a funding pool to manage. (Pool selection UI not implemented yet)
             </AlertDescription>
           </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <ServerCrash className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ExternalContributionForm poolId={selectedPoolId} onContributionRecorded={handleRefresh} />

        <Tabs defaultValue="allocations" className="w-full">
          <TabsList>
            <TabsTrigger value="allocations">Project Allocations</TabsTrigger>
          </TabsList>
          <TabsContent value="allocations" className="py-4">
            <ProjectAllocations key={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
} 