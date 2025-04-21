'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { ProjectCard } from '@/components/funding/project-card';
import { api } from '@/services/api';
import { Loader2 } from 'lucide-react';
import { ArrowLeft, CalendarDays, Clock, Search, AlertCircle, ChevronRight } from 'lucide-react';

interface PoolRound {
  id: string;
  start_time: string;
  end_time: string;
  is_distributed: boolean;
  active_project_count: number;
  matching_amount: number;
}

interface Pool {
  id: string;
  name: string;
  description: string;
  theme: string;
  is_active: boolean;
  sponsor_name?: string;
  current_round?: PoolRound;
  sponsor_logo_url?: string;
  total_projects?: number;
}

interface Project {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  funding_goal: number;
  funding_progress?: {
    raised: number;
  };
  category?: string;
  tags?: string[];
}

interface ProjectsPageProps {
  params: {
    id: string;
  };
}

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

export default function PoolProjectsPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const poolId = params.id as string;
  
  const [pool, setPool] = useState<Pool | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fundingFilter, setFundingFilter] = useState('all');
  const [sortBy, setSortBy] = useState('most-contributions');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch pool details
        const poolResponse = await api.getPool(poolId);
        setPool(poolResponse.data);
        
        // Fetch projects associated with this pool
        const projectsResponse = await api.getPoolProjects(poolId);
        setProjects(projectsResponse.data);
        setFilteredProjects(projectsResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load pool information. Please try again later.',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [poolId, toast]);
  
  useEffect(() => {
    let result = [...projects];
    
    // Filter by search term
    if (searchTerm) {
      result = result.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Filter by funding status
    if (fundingFilter === 'funded') {
      result = result.filter(project => 
        project.funding_progress && 
        project.funding_progress.raised >= project.funding_goal
      );
    } else if (fundingFilter === 'in-progress') {
      result = result.filter(project => 
        !project.funding_progress || 
        project.funding_progress.raised < project.funding_goal
      );
    }
    
    // Sort projects
    result = result.sort((a, b) => {
      switch (sortBy) {
        case 'most-contributions':
          return (b.contributions_count || 0) - (a.contributions_count || 0);
        case 'most-funded':
          return (b.contributions_amount || 0) - (a.contributions_amount || 0);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    
    setFilteredProjects(result);
  }, [searchTerm, fundingFilter, sortBy, projects]);
  
  // Extract unique categories from projects
  const categorySet = new Set<string>();
  projects.forEach((project: any) => {
    if (project.category) {
      categorySet.add(project.category);
    }
  });
  const categories = ['all', ...Array.from(categorySet)];
  
  if (isLoading) {
    return (
      <div className="container py-20 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading pool information...</span>
      </div>
    );
  }
  
  if (!pool) {
    return (
      <div className="container py-20">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Pool Not Found</h2>
          <p className="text-muted-foreground">
            The funding pool you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => router.push('/dashboard/pools')} className="mt-4">
            Go Back to Pools
          </Button>
        </div>
      </div>
    );
  }
  
  const currency = pool.currency || 'ETH';
  
  return (
    <div className="container py-6 max-w-7xl">
      {/* Back button and header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          className="mb-4 pl-0 text-muted-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pools
        </Button>
        
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold tracking-tight">{pool.name}</h1>
            {pool.is_active && pool.current_round && 
              !pool.current_round.is_distributed && 
              new Date(pool.current_round.end_time) > new Date() && (
              <Badge variant="success" className="ml-2">Active</Badge>
            )}
          </div>
          <p className="text-muted-foreground max-w-3xl">{pool.description}</p>
        </div>
      </div>

      {/* Pool information card */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left: Sponsor info */}
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Sponsored by</h3>
              <div className="flex items-center space-x-3">
                {pool.sponsor_logo_url ? (
                  <Image 
                    src={pool.sponsor_logo_url} 
                    alt={pool.sponsor_name || "Sponsor"} 
                    width={48} 
                    height={48} 
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                    <span className="font-medium text-secondary-foreground">
                      {(pool.sponsor_name || "S").charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium">{pool.sponsor_name || "Anonymous Sponsor"}</p>
                  <p className="text-sm text-muted-foreground">{pool.theme} Impact</p>
                </div>
              </div>
            </div>
            
            {/* Middle: Round Timing */}
            {pool.current_round && (
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Current Round</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">
                      {formatDate(pool.current_round.start_time)} - {formatDate(pool.current_round.end_time)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {calculateTimeRemaining()}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Right: Matching Pool */}
            {pool.current_round && (
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Matching Pool</h3>
                <p className="text-lg font-bold">
                  ${pool.current_round.matching_amount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pool.current_round.active_project_count} active projects
                </p>
                
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="link" className="px-0 text-sm h-auto mt-1">
                      How matching works
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Quadratic Funding Explained</SheetTitle>
                      <SheetDescription>
                        Learn how your contribution makes a bigger impact
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-6 space-y-4">
                      <p>
                        Quadratic funding is a democratic way to fund public goods where the number
                        of contributors matters more than the amount contributed.
                      </p>
                      <h3 className="font-medium">How it works:</h3>
                      <ol className="list-decimal pl-5 space-y-2">
                        <li>You donate to projects you value</li>
                        <li>Your donation unlocks matching funds</li>
                        <li>Projects with more contributors get a larger share of the matching pool</li>
                      </ol>
                      <p className="text-sm text-muted-foreground">
                        This means even small donations have a big impact. Projects that are
                        valuable to many people receive more funding.
                      </p>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Projects section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Projects in this Pool</h2>
          
          <div className="flex items-center space-x-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full" onValueChange={setFundingFilter}>
          <TabsList>
            <TabsTrigger value="all">All Projects</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress</TabsTrigger>
            <TabsTrigger value="funded">Fully Funded</TabsTrigger>
          </TabsList>
          
          <Separator className="my-4" />
          
          <TabsContent value="all" className="mt-6">
            {renderProjectsGrid()}
          </TabsContent>
          
          <TabsContent value="in-progress" className="mt-6">
            {renderProjectsGrid()}
          </TabsContent>
          
          <TabsContent value="funded" className="mt-6">
            {renderProjectsGrid()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  function renderProjectsGrid() {
    if (filteredProjects.length === 0) {
      return (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="text-muted-foreground mt-1">
            Try adjusting your search or check back later
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate time remaining for pool round
  const calculateTimeRemaining = () => {
    if (!pool?.current_round) return null;
    
    const endTime = new Date(pool.current_round.end_time);
    const now = new Date();
    
    // If round has ended
    if (now > endTime) {
      return "Round ended";
    }
    
    const timeLeft = endTime.getTime() - now.getTime();
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return `${days}d ${hours}h remaining`;
  };
} 