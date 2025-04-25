"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PoolCard } from "@/components/funding/pool-card";
import { Separator } from "@/components/ui/separator";
import { quadraticFundingApi } from "@/lib/api";
import { Loader2, Info, Wallet } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BlurContainer } from "@/components/ui/blur-container";
import { ethToMyr, formatMyr } from "@/lib/currency";

interface PoolRound {
  id: string;
  start_time: string;
  end_time: string;
  is_distributed: boolean;
  active_project_count?: number;
}

interface Pool {
  id: string;
  name: string;
  description: string;
  theme: string;
  is_active: boolean;
  sponsor_name?: string;
  logo_url?: string;
  total_funding_amount: number;
  allocated_funding: number;
  current_round?: PoolRound;
  is_shariah_compliant?: boolean;
}

export default function PoolsPage() {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [pools, setPools] = useState<Pool[]>([]);
  const [filteredPools, setFilteredPools] = useState<Pool[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);

  // Fetch pools data from API
  useEffect(() => {
    const fetchPools = async () => {
      try {
        setIsLoading(true);
        const response = await quadraticFundingApi.getPools();
        
        // Transform the response data to match our Pool interface
        if (response.success && response.data) {
          // Check if the response has pools in data.pools (as expected from the backend structure)
          const poolsData = Array.isArray(response.data.pools) ? response.data.pools : 
                         Array.isArray(response.data) ? response.data : [];
          
          console.log("Pools data:", poolsData); // Debug log
          
          const formattedPools = poolsData.map((pool: any) => ({
            id: pool.id,
            name: pool.name,
            description: pool.description,
            theme: pool.theme || 'General',
            is_active: pool.is_active || false,
            sponsor_name: pool.sponsor_name,
            logo_url: pool.logo_url,
            total_funding_amount: pool.total_funding_amount || pool.total_funds || 0,
            allocated_funding: pool.allocated_funding || pool.allocated_funds || 0,
            is_shariah_compliant: pool.is_shariah_compliant || false,
            current_round: pool.current_round ? {
              id: pool.current_round.id,
              start_time: pool.current_round.start_time,
              end_time: pool.current_round.end_time,
              is_distributed: pool.current_round.is_distributed,
              active_project_count: pool.current_round.active_project_count || 0
            } : undefined
          }));
          
          setPools(formattedPools);
          setFilteredPools(formattedPools);
          
          // Extract unique themes for filter dropdown
          const themeSet = new Set<string>();
          formattedPools.forEach((pool: Pool) => {
            if (pool.theme) {
              themeSet.add(pool.theme);
            }
          });
          const themes = Array.from(themeSet);
          setAvailableThemes(themes);
        } else {
          console.error("Invalid pool data format:", response);
          setPools([]);
          setFilteredPools([]);
        }
      } catch (error) {
        console.error("Failed to fetch pools:", error);
        setPools([]);
        setFilteredPools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPools();
  }, []);

  // Filter pools based on search term, active status, and theme
  const filterPools = useCallback(() => {
    if (!pools.length) return;

    let filtered = [...pools];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(pool => 
        pool.name.toLowerCase().includes(term) || 
        pool.description.toLowerCase().includes(term) ||
        (pool.sponsor_name && pool.sponsor_name.toLowerCase().includes(term))
      );
    }

    // Apply active/inactive filter
    if (activeFilter === "active") {
      filtered = filtered.filter(pool => {
        // Only check if the pool has an active round with a future end date 
        const hasActiveRound = pool.current_round && 
          new Date(pool.current_round.end_time) > new Date() &&
          !pool.current_round.is_distributed;
        return hasActiveRound;
      });
    } else if (activeFilter === "inactive") {
      filtered = filtered.filter(pool => {
        // Inactive if no round or round has ended or is distributed
        const hasActiveRound = pool.current_round && 
          new Date(pool.current_round.end_time) > new Date() &&
          !pool.current_round.is_distributed;
        return !hasActiveRound;
      });
    }

    // Apply theme filter
    if (themeFilter !== "all") {
      filtered = filtered.filter(pool => pool.theme === themeFilter);
    }

    setFilteredPools(filtered);
  }, [pools, searchTerm, activeFilter, themeFilter]);

  // Apply filters when dependencies change
  useEffect(() => {
    filterPools();
  }, [filterPools, searchTerm, activeFilter, themeFilter]);

  return (
    <DashboardLayout>
      <div className="container py-6 max-w-7xl">
        <BlurContainer intensity="strong" className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Funding Pools</h1>
              <p className="text-muted-foreground">
                Explore themed funding pools and support projects that matter to you
              </p>
            </div>
            
            <div className="flex mt-4 md:mt-0">
              <Link href="/dashboard/wallet">
                <Button className="flex items-center gap-2 bg-primary hover:bg-primary/90">
                  <Wallet className="h-4 w-4" />
                  Access Wallet
                </Button>
              </Link>
            </div>
          </div>
        </BlurContainer>

        <BlurContainer intensity="strong" className="mt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800">How it works</h3>
              <p className="text-sm text-blue-700">
                Browse available funding pools below. Click on any pool to see the projects inside it. Your donations will be matched with quadratic funding to maximize impact!
              </p>
            </div>
          </div>
        </BlurContainer>

        <BlurContainer intensity="strong" className="my-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Input
              placeholder="Search pools by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            
            <div className="flex flex-wrap gap-3">
              <Select value={themeFilter} onValueChange={setThemeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Themes</SelectItem>
                  {availableThemes.map(theme => (
                    <SelectItem key={theme} value={theme}>
                      {theme}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </BlurContainer>

        <BlurContainer className="mt-6">
          <Tabs defaultValue="all" onValueChange={setActiveFilter}>
            <TabsList>
              <TabsTrigger value="all">All Pools</TabsTrigger>
              <TabsTrigger value="active">Active Rounds</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
            
            <Separator className="my-4" />

            <TabsContent value="all" className="mt-4">
              {renderPoolsGrid()}
            </TabsContent>
            
            <TabsContent value="active" className="mt-4">
              {renderPoolsGrid()}
            </TabsContent>
            
            <TabsContent value="inactive" className="mt-4">
              {renderPoolsGrid()}
            </TabsContent>
          </Tabs>
        </BlurContainer>
      </div>
    </DashboardLayout>
  );

  function renderPoolsGrid() {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading pools...</span>
        </div>
      );
    }

    if (filteredPools.length === 0) {
      return (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium">No pools found</h3>
          <p className="text-muted-foreground mt-1">
            Try adjusting your filters or search term
          </p>
        </div>
      );
    }

    return (
      <AnimatePresence>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPools.map((pool) => (
            <motion.div
              key={pool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <PoolCard pool={{
                id: pool.id,
                name: pool.name,
                description: pool.description,
                theme: pool.theme,
                is_active: pool.is_active,
                sponsor_name: pool.sponsor_name,
                logo_url: pool.logo_url,
                total_funds: Number(pool.total_funding_amount || 0),
                allocated_funds: Number(pool.allocated_funding || 0),
                start_date: pool.current_round?.start_time,
                end_date: pool.current_round?.end_time,
                is_distributed: pool.current_round?.is_distributed,
                project_count: pool.current_round?.active_project_count,
                is_shariah_compliant: pool.is_shariah_compliant
              }} />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    );
  }
} 