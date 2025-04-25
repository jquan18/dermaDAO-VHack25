"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import { CircleDollarSign, Info, Calendar, Users, BarChart3, Share2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { quadraticFundingApi } from "@/lib/api";

interface PoolDetailsProps {
  pool: {
    id: number;
    name: string;
    description: string;
    theme: string;
    sponsor_name?: string;
    sponsor_id?: number;
    admin_id?: number;
    total_funds?: number;
    is_active: boolean;
    round_duration?: number;
    start_date?: string | null;
    end_date?: string | null;
    is_distributed?: boolean;
    distributed_at?: string | null;
    distribution_tx_hash?: string | null;
    created_at: string;
    updated_at?: string;
    projects: Array<{
      id: number;
      name: string;
      description: string;
      charity_name: string;
      is_active: boolean;
      verification_score: number;
    }>;
    allocated_funds?: number;
    is_shariah_compliant?: boolean;
  };
  className?: string;
}

export function PoolDetails({ pool, className }: PoolDetailsProps) {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isDistributing, setIsDistributing] = useState<boolean>(false);
  const { user } = useAuth();
  const router = useRouter();
  
  // Determine pool status based on pool properties
  const now = new Date();
  const startDate = pool.start_date ? new Date(pool.start_date) : null;
  const endDate = pool.end_date ? new Date(pool.end_date) : null;
  const isScheduled = pool.is_active && startDate && now < startDate;
  const isActive = pool.is_active && startDate && endDate && now >= startDate && now <= endDate;
  const hasEnded = pool.is_active && endDate && now > endDate;
  const isDistributed = pool.is_distributed || false;
  
  // Can we distribute?
  const distributionEligible = hasEnded && !isDistributed;
  
  const activeProjects = pool.projects?.filter(p => p.is_active) || [];
  
  // Check user permissions
  const isCorporateUser = user?.role === 'corporate';
  const isPoolSponsor = user?.id === pool.sponsor_id;
  const isAdmin = user?.role === 'admin';
  const canDistribute = (isCorporateUser && isPoolSponsor) || isAdmin;
  
  const handleDistribute = async () => {
    if (!canDistribute || !distributionEligible) return;
    
    try {
      setIsDistributing(true);
      const response = await quadraticFundingApi.distributeQuadraticFunding(pool.id);
      
      if (response && response.success) {
        toast({
          title: "Funds distribution initiated",
          description: "Distribution process started successfully. Results will be updated shortly.",
          duration: 5000,
        });
        router.refresh();
      } else {
        toast({
          title: "Distribution failed",
          description: response.error?.message || "An error occurred while initiating distribution.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error("Distribution API call failed:", error);
      toast({
        title: "Distribution Error",
        description: error.message || "A network or server error occurred.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsDistributing(false);
    }
  };
  
  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center">
                <CircleDollarSign className="mr-2 h-6 w-6 text-primary" />
                {pool.name}
              </CardTitle>
              <CardDescription className="flex items-center mt-2">
                <Badge variant={isActive ? "success" : hasEnded ? "secondary" : isScheduled ? "outline" : "destructive"} className="mr-2">
                  {isActive ? "Active" : hasEnded ? (isDistributed ? "Completed" : "Ended") : isScheduled ? "Scheduled" : "Inactive"}
                </Badge>
                <span className="text-muted-foreground">Theme: {pool.theme}</span>
                {pool.is_shariah_compliant && (
                  <Badge variant="success" className="ml-2">Shariah Compliant</Badge>
                )}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {canDistribute && distributionEligible && (
                <Button
                  onClick={() => handleDistribute()}
                  disabled={isDistributing}
                  variant={"outline"}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  {isDistributing ? "Distributing..." : "Distribute Funds"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <p className="text-muted-foreground">{pool.description}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <Card className="bg-secondary/10">
              <CardContent className="p-4 flex items-center">
                <Users className="h-8 w-8 mr-3 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Projects</p>
                  <p className="text-xl font-semibold">{activeProjects.length}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/10">
              <CardContent className="p-4 flex items-center">
                <CircleDollarSign className="h-8 w-8 mr-3 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Funds</p>
                  <p className="text-xl font-semibold">
                    {pool.total_funds?.toFixed(4) || "0.0000"} ETH
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/10">
              <CardContent className="p-4 flex items-center">
                <BarChart3 className="h-8 w-8 mr-3 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Allocated</p>
                  <p className="text-xl font-semibold">
                    {pool.allocated_funds?.toFixed(4) || "0.0000"} ETH
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/10">
              <CardContent className="p-4 flex items-center">
                <Calendar className="h-8 w-8 mr-3 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-xl font-semibold">
                    {pool.start_date && pool.end_date ? 
                      `${Math.ceil((new Date(pool.end_date).getTime() - new Date(pool.start_date).getTime()) / (1000 * 3600 * 24))} days` 
                      : pool.round_duration ? `${Math.floor(pool.round_duration / 86400)} days` : "N/A"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {(pool.start_date || pool.end_date || pool.is_distributed !== undefined) && (
            <Card className="mt-6 bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <h3 className="font-semibold flex items-center">
                  <Info className="h-4 w-4 mr-2 text-primary" />
                  Pool Period & Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {pool.start_date ? formatDateTime(pool.start_date) : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {pool.end_date ? formatDateTime(pool.end_date) : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Distribution Status</p>
                    <Badge variant={isDistributed ? "success" : "outline"}>
                       {isDistributed ? `Completed ${pool.distributed_at ? formatDateTime(pool.distributed_at) : ''}` : "Pending"}
                    </Badge>
                  </div>
                </div>
                
                {canDistribute && distributionEligible && (
                  <Alert className="mt-4" variant="default">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This pool has ended and is ready for fund distribution.
                    </AlertDescription>
                  </Alert>
                )}
                {hasEnded && isDistributed && (
                  <Alert className="mt-4" variant="success">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                       Funds for this pool were distributed on {pool.distributed_at ? formatDateTime(pool.distributed_at) : 'N/A'}.
                       Tx: {pool.distribution_tx_hash ? pool.distribution_tx_hash.substring(0, 10) + '...' : 'N/A'}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects ({activeProjects.length})</TabsTrigger>
          <TabsTrigger value="about">About Quadratic Funding</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About This Pool</CardTitle>
              <CardDescription>
                Details about the {pool.name} funding pool
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">{pool.description}</p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold mb-2">How This Pool Works</h3>
                <p className="text-muted-foreground">
                  This is a quadratic funding pool with the theme "{pool.theme}". 
                  Projects in this pool that align with this theme are eligible to 
                  receive matching funds based on the number of contributors, not just 
                  the amount contributed. This system gives more weight to projects 
                  with broad community support.
                </p>
              </div>
              
              <Alert className="bg-secondary/10 border-primary/20">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Sponsor: </span>
                  {pool.sponsor_name || "DermaDAO Platform"}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Participating Projects</CardTitle>
              <CardDescription>
                Projects participating in this funding pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeProjects.length > 0 ? (
                <div className="space-y-4">
                  {activeProjects.map((project) => (
                    <Card key={project.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{project.name}</h3>
                            <p className="text-muted-foreground text-sm">
                              by {project.charity_name}
                            </p>
                          </div>
                          <Button asChild size="sm">
                            <Link href={`/dashboard/donations/${project.id}`}>
                              View Project
                            </Link>
                          </Button>
                        </div>
                        <p className="text-sm mt-2 line-clamp-2">{project.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No active projects in this pool yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About Quadratic Funding</CardTitle>
              <CardDescription>
                How quadratic funding works and why it matters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Quadratic Funding is a mathematical system designed to fund public goods 
                in a way that optimizes for democratic impact. It's a mechanism where 
                matching funds are distributed not simply based on the amount donated, 
                but weighted by the number of unique contributors.
              </p>
              
              <div>
                <h3 className="font-semibold mb-2">How It Works</h3>
                <p className="text-muted-foreground">
                  The core principle is that the matching amount given to a project is 
                  proportional to the square of the sum of the square roots of the individual 
                  contributions. In simple terms: projects with more individual supporters get 
                  more matching funds, even if the total amount donated is smaller.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Why It Matters</h3>
                <p className="text-muted-foreground">
                  Traditional donation matching gives power to large donors. Quadratic 
                  funding shifts power to the crowd - projects with broad community support 
                  receive more matching funds. This creates a more democratic and 
                  representative funding system.
                </p>
              </div>
              
              <div className="flex justify-center mt-4">
                <Button variant="outline" asChild>
                  <Link href="https://wtfisqf.com" target="_blank" rel="noopener noreferrer">
                    Learn More About Quadratic Funding
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 