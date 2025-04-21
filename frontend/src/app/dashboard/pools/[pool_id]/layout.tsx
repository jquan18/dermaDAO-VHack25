'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function PoolLayout({
  children
}: {
  children: React.ReactNode
}) {
  const params = useParams();
  const poolId = params.pool_id as string;
  
  return (
    <div className="space-y-6">
      <div className="flex-1 space-y-4">
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="sticky top-0 z-10 bg-background pb-2 border-b">
            <TabsList className="w-full justify-start gap-4 h-12">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" 
                asChild
              >
                <a href={`/dashboard/pools/${poolId}`}>Overview</a>
              </TabsTrigger>
              <TabsTrigger 
                value="projects" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                asChild
              >
                <a href={`/dashboard/pools/${poolId}/projects`}>Projects</a>
              </TabsTrigger>
              <TabsTrigger 
                value="distributions" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                asChild
              >
                <a href={`/dashboard/pools/${poolId}/distributions`}>Distributions</a>
              </TabsTrigger>
              <TabsTrigger 
                value="donations" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                asChild
              >
                <a href={`/dashboard/pools/${poolId}/donations`}>My Donations</a>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="overview" className="space-y-4">
            <Suspense fallback={<PoolSkeleton />}>
              {children}
            </Suspense>
          </TabsContent>
          
          <TabsContent value="projects" className="space-y-4">
            <Suspense fallback={<PoolSkeleton />}>
              {children}
            </Suspense>
          </TabsContent>
          
          <TabsContent value="distributions" className="space-y-4">
            <Suspense fallback={<PoolSkeleton />}>
              {children}
            </Suspense>
          </TabsContent>
          
          <TabsContent value="donations" className="space-y-4">
            <Suspense fallback={<PoolSkeleton />}>
              {children}
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PoolSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array(4).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array(6).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
} 