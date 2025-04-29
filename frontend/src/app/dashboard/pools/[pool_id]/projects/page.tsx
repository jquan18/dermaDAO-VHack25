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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  AlertCircle,
  Loader2, 
  CircleDollarSign,
  Filter,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '@/services/api';

// Helper function to normalize API responses
function normalizeResponse(response: any) {
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
function ProjectCard({ project }: { project: any }) {
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
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {project.description || 'No description available'}
          </p>
          
          <div className="space-y-3">
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
            <Link href={`/dashboard/projects/${project.id}`}>
              View Project
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// Projects filter and list component
export default function ProjectsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const poolId = params.pool_id as string;
  
  const [pool, setPool] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [debugInfo, setDebugInfo] = useState<{ poolResponse: any; projectsResponse: any } | null>(null); // For debugging
  
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        console.log('Fetching pool data for ID:', poolId);
        
        // Fetch pool details
        let poolResponse: any = await api.getPool(poolId);
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
        let projectsResponse: any = await api.getPoolProjects(poolId);
        console.log('Projects API raw response:', projectsResponse);
        
        // Normalize the response
        projectsResponse = normalizeResponse(projectsResponse);
        console.log('Projects API normalized response:', projectsResponse);
        
        // Store the raw response for debugging
        setDebugInfo({ poolResponse, projectsResponse });
        
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
      } catch (error: any) {
        console.error('Error fetching pool data:', error);
        toast({
          variant: 'destructive',
          title: 'Error fetching projects',
          description: error.message || 'Could not load project information. Please try again later.',
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
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(project => 
        project.category === categoryFilter
      );
    }
    
    // Apply sorting
    filtered = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most-funded':
          return (b.funding_progress?.raised || 0) - (a.funding_progress?.raised || 0);
        case 'least-funded':
          return (a.funding_progress?.raised || 0) - (b.funding_progress?.raised || 0);
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'most-contributions':
          return (b.contributions_count || 0) - (a.contributions_count || 0);
        default:
          return 0;
      }
    });
    
    setFilteredProjects(filtered);
  }, [projects, searchTerm, sortBy, categoryFilter]);
  
  // Extract unique categories from projects
  const categories = ['all'];
  const categorySet = new Set();
  projects.forEach(project => {
    if (project.category && !categorySet.has(project.category)) {
      categorySet.add(project.category);
      categories.push(project.category);
    }
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading projects...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
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
      
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="w-full sm:w-auto flex-grow">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="most-funded">Most funded</SelectItem>
              <SelectItem value="least-funded">Least funded</SelectItem>
              <SelectItem value="most-contributions">Most contributions</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
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
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold">No projects found</h3>
          <p className="text-muted-foreground mt-2">
            {searchTerm || categoryFilter !== 'all'
              ? "Try adjusting your filters to see more results."
              : "This pool doesn't have any projects yet."}
          </p>
          {(searchTerm || categoryFilter !== 'all') && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
              }} 
              className="mt-4"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
} 