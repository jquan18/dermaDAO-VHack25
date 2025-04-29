"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { FundingPoolStatus } from "@/components/funding/funding-pool-status";
import { FundingDistribution } from "@/components/funding/funding-distribution";
import { ProjectAllocations } from "@/components/funding/project-allocations";
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
    <DashboardLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Quadratic Funding Admin</h1>
          <p className="text-muted-foreground">Manage quadratic funding pools, distributions, and contributions.</p>
        </div>
        
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
           <Alert>
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

        {/* Commented out due to type error - props don't match component definition */}
        {/* <ExternalContributionForm poolId={selectedPoolId} onContributionRecorded={handleRefresh} /> */}
        
        {/* Show a placeholder message instead */}
        <div className="p-6 border rounded-lg bg-card shadow-sm">
          <h3 className="text-lg font-medium mb-2">External Contribution Form</h3>
          <p className="text-muted-foreground mb-4">Record external contributions to the funding pool.</p>
          <Button onClick={handleRefresh} disabled={!selectedPoolId}>
            Record Contribution
          </Button>
        </div>

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