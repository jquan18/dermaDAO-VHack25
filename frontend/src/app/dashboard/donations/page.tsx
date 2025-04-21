"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectsApi } from "@/lib/api";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { QuadraticFundingInfo } from "@/components/funding/quadratic-funding-info";

// Define the Project interface based on usage
interface Project {
  id: string | number; // Based on usage, seems it can be string or number initially
  name: string;
  description: string;
  funding_goal: number;
  funding_progress?: { // Optional based on usage
    raised: number;
  };
  // Add other potential fields if known
}

export default function DonationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  // Apply the Project type to useState
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectsApi.getAllProjects();
        console.log("Projects response:", response);
        if (response.success && response.data) {
          // Add type assertion if the API response type isn't strictly Project[]
          const fetchedProjects = (response.data.projects || []) as Project[]; 
          // Log each project ID for debugging
          fetchedProjects.forEach((project: Project) => { // Add type here
            console.log(`Project: ${project.name}, ID: ${project.id}, Type: ${typeof project.id}`);
          });
          
          setProjects(fetchedProjects);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
        toast({
          title: "Error",
          description: "Failed to load projects. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [toast]);

  // Apply Project type to filter parameter
  const filteredProjects = projects.filter((project: Project) => {
    return (
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Apply type to projectId parameter
  const handleDonate = (projectId: string | number) => {
    console.log("Attempting to donate to project with ID:", projectId, "Type:", typeof projectId);
    
    // Keep validation logic, ensure it handles both string and number types if necessary
    const idAsString = String(projectId); // Convert to string for parseInt check
    if (projectId === undefined || projectId === null || (isNaN(parseInt(idAsString)) && projectId !== 0)) {
      console.error("Invalid project ID:", projectId);
      toast({
        title: "Error",
        description: "This project has an invalid ID and cannot be donated to.",
        variant: "destructive",
      });
      return;
    }
    
    // Convert to number for the route
    const numericId = parseInt(idAsString, 10); 
    router.push(`/dashboard/donations/${numericId}`);
  };

  // Add types to parameters
  const formatCurrency = (amount: number) => {
    // Consider handling potential undefined/null if amount can be missing
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "ETH", // Assuming ETH, adjust if needed
    }).format(amount ?? 0); // Provide default value if amount can be null/undefined
  };

  // Add types to parameters
  const calculateProgress = (raised: number | undefined, goal: number) => {
    // Handle potentially undefined raised amount and ensure goal is not zero
    const currentRaised = raised ?? 0;
    if (goal <= 0) {
      return 0; // Avoid division by zero
    }
    return Math.min(Math.round((currentRaised / goal) * 100), 100);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Donation Projects</h1>
          <p className="text-muted-foreground">
            Support charitable projects and make a difference
          </p>
        </div>

        <QuadraticFundingInfo />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search projects..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-gray-500">No projects found. Please try a different search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Add type to map parameter */}
            {filteredProjects.map((project: Project) => (
              <Card key={project.id} className="flex flex-col h-full">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">{project.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Goal</span>
                      <span className="font-medium">{formatCurrency(project.funding_goal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Raised</span>
                      <span className="font-medium">
                        {/* Pass potentially undefined raised value, provide fallback */} 
                        {formatCurrency(project.funding_progress?.raised ?? 0)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full"
                        style={{
                          width: `${calculateProgress(
                            project.funding_progress?.raised, // Pass potentially undefined
                            project.funding_goal
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleDonate(project.id)}
                  >
                    Donate Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 