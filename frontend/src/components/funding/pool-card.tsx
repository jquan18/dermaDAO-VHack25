"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import { ChevronRight, CircleDollarSign, Users, BarChart, Layers, Calendar } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface PoolCardProps {
  pool: {
    id: string;
    name: string;
    description: string;
    theme: string;
    is_active: boolean;
    start_date?: string | null;
    end_date?: string | null;
    is_distributed?: boolean;
    logo_url?: string;
    banner_image?: string;
    sponsor_name?: string;
    total_funds: number;
    allocated_funds: number;
    project_count?: number;
  };
}

export function PoolCard({ pool }: PoolCardProps) {
  const now = new Date();
  const startDate = pool.start_date ? new Date(pool.start_date) : null;
  const endDate = pool.end_date ? new Date(pool.end_date) : null;
  const isActiveNow = pool.is_active && startDate && endDate && now >= startDate && now <= endDate;
  const hasEnded = pool.is_active && endDate && now > endDate;
  const isDistributed = pool.is_distributed || false;
  
  const fundingPercentage = pool.total_funds > 0
    ? Math.min(100, Math.round((pool.allocated_funds / pool.total_funds) * 100))
    : 0;

  let statusBadge;
  if (isActiveNow) {
    statusBadge = <Badge variant="success">Active</Badge>;
  } else if (hasEnded) {
     statusBadge = <Badge variant={isDistributed ? "secondary" : "outline"}>{isDistributed ? "Completed" : "Ended"}</Badge>;
  } else if (pool.is_active && startDate && now < startDate) {
     statusBadge = <Badge variant="outline">Scheduled</Badge>;
  } else {
    statusBadge = <Badge variant="secondary">Inactive</Badge>;
  }

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md h-full flex flex-col">
      <div className="relative h-36 w-full overflow-hidden bg-muted">
         {(pool.banner_image || pool.logo_url) ? (
           <Image
             src={pool.banner_image || pool.logo_url!}
             alt={pool.name}
             fill
             className="object-cover"
           />
         ) : (
             <div className="absolute inset-0 bg-gradient-to-br from-muted to-primary/10 flex items-center justify-center">
                 <Layers className="w-12 h-12 text-primary/30" />
             </div>
         )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-3 left-3">
            {statusBadge}
          </div>
      </div>
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="line-clamp-2 font-semibold text-lg">{pool.name}</CardTitle>
        </div>
        <CardDescription className="flex items-center text-sm flex-wrap gap-x-2">
          {pool.sponsor_name && (
            <span className="text-xs">by {pool.sponsor_name}</span>
          )}
          <Badge variant="outline" className="font-normal text-xs">
            {pool.theme}
          </Badge>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {pool.description}
        </p>
        
        <div className="grid gap-3 text-sm">
        <div className="grid gap-3">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center">
              <CircleDollarSign className="h-4 w-4 mr-1 text-muted-foreground" />
              <span>Total Funding</span>
            </div>
            <span className="font-medium">${(pool.total_funds || 0).toLocaleString()}</span>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Allocated</span>
              <span className="font-medium">${(pool.allocated_funds || 0).toLocaleString()}</span>
            </div>
            <Progress value={fundingPercentage} className="h-2" />
          </div>
        </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0">
        <Button asChild className="w-full">
          <Link href={`/dashboard/pools/${pool.id}`}>
            View Pool
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
} 