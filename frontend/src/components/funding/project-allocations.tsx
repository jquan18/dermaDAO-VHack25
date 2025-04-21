"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  CircleDollarSign, 
  Users, 
  ArrowUpDown,
  Search,
  Info
} from "lucide-react";
import { quadraticFundingApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ProjectAllocation {
  id: number;
  charity_id: number;
  pool_id: number | null;
  name: string;
  description: string;
  ipfs_hash: string | null;
  funding_goal: number | null; // Assuming this now represents total raised
  duration_days: number | null;
  is_active: boolean;
  wallet_address: string;
  verification_score: number;
  verification_notes: string | null;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  charity_name: string;
  vote_count: number; // Assuming API provides this for sorting/display
  // Removed round-specific fields like allocated_amount, unique_contributors per round etc.
  // These might be replaced by overall pool/project stats if needed.
}

interface ProjectAllocationsProps {
  className?: string;
}

export function ProjectAllocations({ className }: ProjectAllocationsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectAllocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Default sort might change depending on available data (e.g., vote_count or funding_goal)
  const [sortField, setSortField] = useState<keyof ProjectAllocation>("funding_goal");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        // API call no longer needs roundId
        const response = await quadraticFundingApi.getProjects(); // Assuming this endpoint returns all relevant projects now

        if (response.success) {
          // Ensure the data matches the updated ProjectAllocation interface
          setProjects((response.data || []).map(p => ({ ...p, funding_goal: p.funding_goal ?? 0 })) );
        } else {
          setError("Failed to load project allocations");
        }
      } catch (err) {
        console.error("Error fetching project allocations:", err);
        setError("An error occurred while loading project allocations");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleSort = (field: keyof ProjectAllocation) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.charity_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const fieldA = a[sortField];
    const fieldB = b[sortField];

    let comparison = 0;
    if (fieldA > fieldB) {
      comparison = 1;
    } else if (fieldA < fieldB) {
      comparison = -1;
    }

    return sortDirection === "desc" ? comparison * -1 : comparison;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-72" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Project Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <p className="text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CircleDollarSign className="mr-2 h-5 w-5 text-primary" />
          Project Funding Overview
        </CardTitle>
        <CardDescription>
          Overview of projects eligible for funding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search projects..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-10"
              onClick={() => handleSort("funding_goal")}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort by Funds
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-10"
              onClick={() => handleSort("vote_count")}
            >
              <Users className="h-3.5 w-3.5" />
              Sort by Votes
            </Button>
          </div>

          {sortedProjects.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('vote_count')}>Votes</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('funding_goal')}>Total Funds Raised</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{getInitials(project.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{project.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {project.charity_name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         {project.vote_count ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(project.funding_goal ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border p-6 text-center">
              <Info className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No projects found matching your criteria.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 