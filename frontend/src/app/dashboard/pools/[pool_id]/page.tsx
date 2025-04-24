'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CircleDollarSign, 
  Users, 
  Calendar, 
  Search, 
  AlertCircle,
  Loader2, 
  ChevronLeft,
  Filter,
  BarChart3
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { BlurContainer } from '@/components/ui/blur-container';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

// Helper function to normalize API responses
function normalizeResponse(response) {
  // Case 1: Standard format with { success, data }
  if (response && typeof response.success === 'boolean') {
    return response;
  }
  
  // Case 2: Response is the data directly
  if (response && typeof response === 'object' && !response.success) {
    return { success: true, data: response };
  }
  
  // Case 3: Axios raw response with data property
  if (response && response.data) {
    // If data has success property, return data
    if (typeof response.data.success === 'boolean') {
      return response.data;
    }
    // If data is the actual data
    return { success: true, data: response.data };
  }
  
  // Default - something's wrong
  console.error('Unexpected API response format:', response);
  return { success: false, error: { message: 'Unexpected API response format' } };
}

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

// Project Card Component
function ProjectCard({ project }) {
  // Add safety check for null/undefined project
  if (!project) return null;
  
  const progress = project.funding_progress?.raised 
    ? Math.min(100, Math.round((Number(project.funding_progress.raised || 0) / Number(project.funding_goal || 0) || 0) * 100))
    : 0;
    
  return (
    <motion.div variants={item}>
      <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
        <div className="relative w-full pt-[56.25%]">
          {project.image_url ? (
            <Image
              src={project.image_url}
              alt={project.name || 'Project Image'}
              fill
              className="object-cover rounded-t-lg"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 flex items-center justify-center rounded-t-lg">
              <CircleDollarSign className="h-16 w-16 text-primary/40" />
            </div>
          )}
          {project.category && (
            <Badge className="absolute top-2 right-2" variant="secondary">
              {project.category}
            </Badge>
          )}
        </div>
        
        <CardHeader className="pb-2">
          <CardTitle className="text-xl line-clamp-1">{project.name || 'Unnamed Project'}</CardTitle>
          <CardDescription className="line-clamp-2">
            {project.charity_name || "Charity Organization"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-grow">
          <div className="bg-white/20 backdrop-blur-sm rounded-md p-3 mb-4">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {project.description || 'No description available'}
            </p>
          </div>
          
          <div className="bg-white/30 backdrop-blur-md rounded-md p-3 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Raised</span>
              <span className="font-medium">
                {project.funding_progress?.raised ? Number(project.funding_progress.raised).toFixed(2) : "0.00"} ETH
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm">
              <span>{progress}% of {Number(project.funding_goal || 0)} ETH</span>
              <span className="text-muted-foreground">
                {project.contributions_count || 0} contributions
              </span>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="pt-0">
          <Button asChild className="w-full">
            <Link href={`/dashboard/donations/${project.id}`}>
              Donate to Project
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// Pool Details Component (Refactored)
function PoolInfo({ pool }) {
  if (!pool) return null;

  const totalFunds = Number(pool.total_funds || 0);
  const allocatedFunds = Number(pool.allocated_funds || 0);
  const fundingPercentage = totalFunds > 0
    ? Math.min(100, Math.round((allocatedFunds / totalFunds) * 100))
    : 0;
    
  const currency = pool.currency || 'ETH';
  
  // Calculate status based on pool dates
  const now = new Date();
  const startDate = pool.start_date ? new Date(pool.start_date) : null;
  const endDate = pool.end_date ? new Date(pool.end_date) : null;
  const isActive = pool.is_active && startDate && endDate && now >= startDate && now <= endDate;
  const hasEnded = pool.is_active && endDate && now > endDate;
  const isDistributed = pool.is_distributed || false;
  const isScheduled = pool.is_active && startDate && now < startDate;

  const formatPoolDate = (dateString: string | null | undefined): string => {
      if (!dateString) return "N/A";
      try {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch (e) {
        return "Invalid Date";
      }
  };

  return (
    <BlurContainer>
      <Card className="mb-8 shadow-sm overflow-hidden border-0 bg-transparent">
        {/* Optional Banner Image */}
        {pool.banner_image && (
          <div className="relative w-full h-40 md:h-48 bg-muted">
            <Image
              src={pool.banner_image}
              alt={`${pool.name} Banner`}
              fill
              className="object-cover"
            />
          </div>
        )}

        <CardHeader className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-4">
              {pool.logo_image && (
                <div className="relative w-16 h-16 rounded-md overflow-hidden border flex-shrink-0">
                  <Image 
                    src={pool.logo_image} 
                    alt={`${pool.name} Logo`}
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">{pool.name}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-2 mt-1">
                  <Badge variant={isActive ? "success" : hasEnded ? (isDistributed ? "secondary" : "outline") : "outline"} className="capitalize">
                    {isActive ? "Active" : hasEnded ? (isDistributed ? "Completed" : "Ended") : "Scheduled"}
                  </Badge>
                  <span className="text-muted-foreground">Theme: {pool.theme}</span>
                  {pool.company_name && <span className="text-muted-foreground">By: {pool.company_name}</span>}
                </CardDescription>
              </div>
            </div>
            {/* Action Button - Example */}
             <Button asChild>
               <Link href={`/dashboard/donations?pool=${pool.id}`}>
                 Donate to Projects
               </Link>
             </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{pool.description}</p>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {/* Projects */}
            <div className="bg-white/30 backdrop-blur-md rounded-lg p-3 text-center">
               <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Projects</p>
               <p className="text-xl font-semibold">{pool?.projects?.length || 0}</p> 
            </div>
            {/* Total Funds */}
            <div className="bg-white/30 backdrop-blur-md rounded-lg p-3 text-center">
               <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Funds</p>
               <p className="text-xl font-semibold">{totalFunds.toFixed(2)} {currency}</p> 
            </div>
            {/* Allocated */}
            <div className="bg-white/30 backdrop-blur-md rounded-lg p-3 text-center">
               <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Allocated</p>
               <p className="text-xl font-semibold">{allocatedFunds.toFixed(2)} {currency}</p> 
            </div>
            {/* Duration/Status */}
            <div className="bg-white/30 backdrop-blur-md rounded-lg p-3 text-center">
               <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
               <p className="text-base font-medium">
                  {isActive && endDate ? `Ends ${formatDistanceToNow(endDate, { addSuffix: true })}` : 
                   hasEnded ? (isDistributed ? "Completed" : "Ended") : 
                   isScheduled && startDate ? `Starts ${formatPoolDate(pool.start_date)}` : 
                   pool.is_active ? "Active (No End Date)" : "Inactive"}
               </p>
            </div>
          </div>
          
          {/* Funding Allocation Progress Bar */}
          <div className="bg-white/30 backdrop-blur-md rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold">Funding Allocation</h3>
            <Progress value={fundingPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {allocatedFunds.toFixed(4)} {currency} allocated
              </span>
              <span>
                {fundingPercentage}% of total funds ({totalFunds.toFixed(4)} {currency})
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </BlurContainer>
  );
}

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const poolId = params.pool_id as string;
  
  const [pool, setPool] = useState(null);
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('default');
  const [debugInfo, setDebugInfo] = useState(null); // For debugging purposes
  
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        console.log('Fetching pool data for ID:', poolId);
        
        // Fetch pool details
        let poolResponse = await api.getPool(poolId);
        console.log('Pool API raw response:', poolResponse);
        
        // Normalize the response
        poolResponse = normalizeResponse(poolResponse);
        console.log('Pool API normalized response:', poolResponse);
        
        if (!poolResponse.success) {
          throw new Error(poolResponse.error?.message || 'Failed to fetch pool data');
        }
        
        setPool(poolResponse.data);
        
        // Fetch projects in this pool
        console.log('Fetching projects for pool ID:', poolId);
        let projectsResponse = await api.getPoolProjects(poolId);
        console.log('Projects API raw response:', projectsResponse);
        
        // Normalize the response
        projectsResponse = normalizeResponse(projectsResponse);
        console.log('Projects API normalized response:', projectsResponse);
        
        // Store the raw response for debugging
        setDebugInfo({
          poolResponse,
          projectsResponse
        });
        
        if (!projectsResponse.success) {
          throw new Error(projectsResponse.error?.message || 'Failed to fetch projects data');
        }
        
        // Handle both array and object responses
        let projectsData = projectsResponse.data;
        
        // If data is an object with projects property, use that
        if (projectsData && !Array.isArray(projectsData) && projectsData.projects && Array.isArray(projectsData.projects)) {
          projectsData = projectsData.projects;
        }
        
        if (Array.isArray(projectsData)) {
          console.log(`Found ${projectsData.length} projects in this pool`);
          setProjects(projectsData);
          setFilteredProjects(projectsData);
        } else {
          console.warn('Expected projects data to be an array, but got:', projectsData);
          setProjects([]);
          setFilteredProjects([]);
        }
      } catch (error) {
        console.error('Error fetching pool data:', error);
        toast({
          variant: 'destructive',
          title: 'Error fetching pool',
          description: error.message || 'Could not load pool information. Please try again later.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [poolId, toast]);
  
  useEffect(() => {
    if (!projects.length) return;
    
    let filtered = [...projects];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        project.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    filtered = filtered.sort((a, b) => {
      switch (sortOption) {
        case 'raised_high':
          return (b.funding_progress?.raised || 0) - (a.funding_progress?.raised || 0);
        case 'raised_low':
          return (a.funding_progress?.raised || 0) - (b.funding_progress?.raised || 0);
        case 'contributions':
          return (b.contributions_count || 0) - (a.contributions_count || 0);
        case 'name_asc':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    
    setFilteredProjects(filtered);
  }, [projects, searchTerm, sortOption]);
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[500px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading pool information...</span>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!pool) {
    return (
      <DashboardLayout>
        <BlurContainer className="text-center py-16">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Pool not found</h2>
          <p className="text-muted-foreground mt-2">The pool you are looking for does not exist.</p>
          <Button onClick={() => router.push('/dashboard/pools')} className="mt-6">
            Back to Pools
          </Button>
        </BlurContainer>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Only render in development mode for debugging */}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <details>
              <summary className="cursor-pointer font-medium">Debug Information</summary>
              <pre className="mt-2 text-xs overflow-auto max-h-60">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </div>
        )}
        
        <BlurContainer intensity="light" className="mb-6">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              className="mr-2" 
              onClick={() => router.push('/dashboard/pools')}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Pools
            </Button>
            <h1 className="text-3xl font-bold">Pool Details</h1>
          </div>
        </BlurContainer>
        
        <PoolInfo pool={pool} />
        
        <BlurContainer intensity="light" className="mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <h2 className="text-2xl font-semibold mb-4 sm:mb-0">Projects in this Pool</h2>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-4">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className="w-full sm:w-44">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="raised_high">Funding: High to Low</SelectItem>
                  <SelectItem value="raised_low">Funding: Low to High</SelectItem>
                  <SelectItem value="contributions">Most Contributions</SelectItem>
                  <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </BlurContainer>
        
        <BlurContainer>
          {filteredProjects.length > 0 ? (
            <motion.div 
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No projects found in this pool.</p>
              {searchTerm && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchTerm('')} 
                  className="mt-4"
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        </BlurContainer>
      </div>
    </DashboardLayout>
  );
}