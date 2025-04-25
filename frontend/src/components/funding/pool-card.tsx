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
import { BlurContainer } from "@/components/ui/blur-container";
import { ethToMyr, formatMyr } from "@/lib/currency";

// Consolidated theme styling data
interface ThemeStyles {
  gradient: string;
  progress: string;
  badge: {
    bg: string;
    text: string;
    border: string;
  };
}

// Get all theme-related styling data in one place
const getThemeData = (theme: string): ThemeStyles => {
  const themeMap: Record<string, ThemeStyles> = {
    "Environmental Sustainability": {
      gradient: "from-green-500/30 to-green-700/10",
      progress: "rgb(34, 197, 94)",
      badge: {
        bg: "rgba(34, 197, 94, 0.1)",
        text: "rgb(22, 101, 52)",
        border: "rgba(34, 197, 94, 0.3)"
      }
    },
    "Healthcare Access": {
      gradient: "from-sky-500/30 to-sky-700/10",
      progress: "rgb(14, 165, 233)",
      badge: {
        bg: "rgba(14, 165, 233, 0.1)",
        text: "rgb(7, 89, 133)",
        border: "rgba(14, 165, 233, 0.3)"
      }
    },
    "Education": {
      gradient: "from-amber-500/30 to-amber-700/10", 
      progress: "rgb(245, 158, 11)",
      badge: {
        bg: "rgba(245, 158, 11, 0.1)",
        text: "rgb(146, 64, 14)",
        border: "rgba(245, 158, 11, 0.3)"
      }
    },
    "Social Justice": {
      gradient: "from-purple-500/30 to-purple-700/10",
      progress: "rgb(168, 85, 247)",
      badge: {
        bg: "rgba(168, 85, 247, 0.1)",
        text: "rgb(107, 33, 168)",
        border: "rgba(168, 85, 247, 0.3)"
      }
    },
    "Disaster Relief": {
      gradient: "from-red-500/30 to-red-700/10",
      progress: "rgb(239, 68, 68)",
      badge: {
        bg: "rgba(239, 68, 68, 0.1)",
        text: "rgb(153, 27, 27)",
        border: "rgba(239, 68, 68, 0.3)"
      }
    },
    "Scientific Research": {
      gradient: "from-teal-500/30 to-teal-700/10",
      progress: "rgb(20, 184, 166)",
      badge: {
        bg: "rgba(20, 184, 166, 0.1)",
        text: "rgb(17, 94, 89)",
        border: "rgba(20, 184, 166, 0.3)"
      }
    },
    "Arts & Culture": {
      gradient: "from-orange-500/30 to-orange-700/10",
      progress: "rgb(249, 115, 22)",
      badge: {
        bg: "rgba(249, 115, 22, 0.1)",
        text: "rgb(154, 52, 18)",
        border: "rgba(249, 115, 22, 0.3)"
      }
    },
    "Poverty Alleviation": {
      gradient: "from-amber-700/30 to-amber-900/10",
      progress: "rgb(180, 83, 9)",
      badge: {
        bg: "rgba(180, 83, 9, 0.1)",
        text: "rgb(120, 53, 15)",
        border: "rgba(180, 83, 9, 0.3)"
      }
    },
    "Other": {
      gradient: "from-gray-500/30 to-gray-700/10",
      progress: "rgb(156, 163, 175)",
      badge: {
        bg: "rgba(156, 163, 175, 0.1)",
        text: "rgb(75, 85, 99)",
        border: "rgba(156, 163, 175, 0.3)"
      }
    }
  };
  
  // Default theme styling if the theme doesn't match any in our map
  const defaultTheme: ThemeStyles = {
    gradient: "from-primary/20 to-primary/5",
    progress: undefined,
    badge: {
      bg: "rgba(100, 116, 139, 0.1)",
      text: "rgb(51, 65, 85)",
      border: "rgba(100, 116, 139, 0.3)"
    }
  };
  
  return themeMap[theme] || defaultTheme;
};

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

  // Get theme-specific styling data
  const themeData = getThemeData(pool.theme);

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
             <div className={`absolute inset-0 bg-gradient-to-br ${themeData.gradient} flex items-center justify-center`}>
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
          <Badge 
            variant="outline" 
            className="font-normal text-xs"
            style={{
              backgroundColor: themeData.badge.bg,
              color: themeData.badge.text,
              borderColor: themeData.badge.border,
            }}
          >
            {pool.theme}
          </Badge>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <div className="bg-white/20 backdrop-blur-sm rounded-md p-3 mb-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {pool.description}
          </p>
        </div>
        
        <div className="bg-white/30 backdrop-blur-md rounded-md p-3">
          <div className="grid gap-3 text-sm">
          <div className="grid gap-3">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center">
                <CircleDollarSign className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>Total Funding</span>
              </div>
              <span className="font-medium">{formatMyr(ethToMyr(pool.total_funds || 0))}</span>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Allocated</span>
                <span className="font-medium">{formatMyr(ethToMyr(pool.allocated_funds || 0))}</span>
              </div>
              <Progress 
                value={fundingPercentage} 
                className="h-2" 
                indicatorColor={themeData.progress}
                style={{ backgroundColor: "rgba(229, 231, 235, 0.3)" }}
              />
            </div>
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