"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Search, 
  Plus, 
  Filter, 
  ArrowUpDown, 
  AlertTriangle, 
  Layers, 
  CircleDollarSign,
  Calendar
} from "lucide-react";
import { projectsApi } from "@/lib/api";
import { formatCurrency, formatDate, calculateProgress } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string;
  wallet_address: string;
  funding_goal: number;
  is_active: boolean;
  verification_score: number;
  start_date: string;
  end_date: string;
  created_at: string;
  raised?: number;
  donors_count?: number;
};

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Fetch projects
  const fetchProjects = async () => {
    if (!user?.charity_id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await projectsApi.getCharityProjects(user.charity_id);
      setProjects(response.data);
    } catch (err: any) {
      console.error("Error fetching projects:", err);
      setError(err.response?.data?.error?.message || "Failed to load projects");
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (user?.charity_id) {
      fetchProjects();
    }
  }, [user?.charity_id]);
  
  // Filter and sort projects
  const filteredProjects = projects.filter(project => {
    // Search filter
    const matchesSearch = searchTerm === "" ||
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && project.is_active) ||
      (statusFilter === "inactive" && !project.is_active);
    
    return matchesSearch && matchesStatus;
  });
  
  // Sort filtered projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case "name":
        aValue = a.name;
        bValue = b.name;
        break;
      case "funding_goal":
        aValue = a.funding_goal;
        bValue = b.funding_goal;
        break;
      case "raised":
        aValue = a.raised || 0;
        bValue = b.raised || 0;
        break;
      case "verification_score":
        aValue = a.verification_score;
        bValue = b.verification_score;
        break;
      case "end_date":
        aValue = new Date(a.end_date || a.created_at).getTime();
        bValue = new Date(b.end_date || b.created_at).getTime();
        break;
      case "created_at":
      default:
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
    }
    
    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
  
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };
  
  // Add image imports for hardcoded project images
  const projectImages = [
    "/landing/flood_relief.jpg",
    "/landing/gas_leak_pipeline.jpg",
    "/landing/baby.jpg",
    "/landing/old_folks.jpg",
    "/landing/smiling_kids.jpg",
    "/landing/water.jpg",
    "/landing/wildlife.jpg",
    "/landing/old_man_harold.jpg",
  ];

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-gray-600">Manage your charity's projects</p>
        </div>
        <Button onClick={() => router.push("/dashboard/charity/projects/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>
      
      {/* Filters and Search */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search projects..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-40">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-48">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Date Created</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="funding_goal">Funding Goal</SelectItem>
                <SelectItem value="raised">Amount Raised</SelectItem>
                <SelectItem value="verification_score">Verification Score</SelectItem>
                <SelectItem value="end_date">End Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortOrder}
            title={sortOrder === "asc" ? "Ascending" : "Descending"}
          >
            <ArrowUpDown className={`h-4 w-4 ${sortOrder === "asc" ? "rotate-0" : "rotate-180"}`} />
          </Button>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-200"></div>
              <CardContent className="p-5 space-y-4">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-2 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* No projects message */}
      {!isLoading && sortedProjects.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border">
          <Layers className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No projects found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first project to get started"}
          </p>
          <Button 
            className="mt-4" 
            onClick={() => router.push("/dashboard/charity/projects/new")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </div>
      )}
      
      {/* Projects grid */}
      {!isLoading && sortedProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProjects.map((project, idx) => (
            <Card key={project.id} className="overflow-hidden h-full flex flex-col">
              <div className="relative h-40 bg-gray-100">
                {/* Display project image, fallback to placeholder if out of images */}
                {projectImages[idx % projectImages.length] ? (
                  <Image
                    src={projectImages[idx % projectImages.length]}
                    alt={project.name}
                    layout="fill"
                    objectFit="cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-primary/20 to-primary/5">
                    <Layers className="h-16 w-16 text-primary/30" />
                  </div>
                )}
                {/* Status badge */}
                <div className="absolute top-3 left-3">
                  <Badge variant={project.is_active ? "default" : "secondary"}>
                    {project.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {/* Verification score */}
                <div className="absolute top-3 right-3">
                  <Badge 
                    variant={project.verification_score >= 70 ? "success" : 
                            project.verification_score >= 40 ? "warning" : 
                            "destructive"}
                    className="bg-white/90"
                  >
                    Score: {project.verification_score}%
                  </Badge>
                </div>
              </div>
              
              <CardContent className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg mb-2">{project.name}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{project.description}</p>
                
                <div className="space-y-3 mt-auto">
                  <div className="flex items-center text-sm text-gray-500">
                    <CircleDollarSign className="h-4 w-4 mr-2 text-primary/70" />
                    <span className="mr-1">Goal:</span>
                    <span className="font-medium text-gray-700">{formatCurrency(project.funding_goal, "ETH")}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-2 text-primary/70" />
                    <span className="mr-1">Ends:</span>
                    <span className="font-medium text-gray-700">
                      {project.end_date ? formatDate(project.end_date) : "No end date"}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Raised:</span>
                      <span className="font-medium">
                        {formatCurrency(project.raised || 0, "ETH")} 
                        ({calculateProgress(project.raised || 0, project.funding_goal)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${calculateProgress(project.raised || 0, project.funding_goal)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="px-5 py-4 border-t bg-gray-50">
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => router.push(`/dashboard/charity/projects/${project.id}`)}
                >
                  Manage
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
} 