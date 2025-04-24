"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft, ExternalLink } from "lucide-react";
import { projectsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BlurContainer } from "@/components/ui/blur-container";

interface SuccessPageProps {
  params: {
    id: string;
  };
}

// Helper function to check if a project ID is valid
const isValidProjectId = (id: string | number) => {
  // If it's a string, try parsing it as an integer
  const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
  // Include 0 as a valid ID
  return !isNaN(numId) && numId >= 0;
};

// Helper function to truncate transaction hash for display
const truncateHash = (hash: string) => {
  if (!hash) return '';
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
};

// Helper function to get explorer URL for Scroll network
const getExplorerUrl = (txHash: string) => {
  // Use Scroll Sepolia explorer for testnet
  return `https://sepolia.scrollscan.com/tx/${txHash}`;
};

export default function DonationSuccessPage({ params }: SuccessPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [project, setProject] = useState<any>(null);
  const [transactionHash, setTransactionHash] = useState<string>('');

  useEffect(() => {
    // Retrieve transaction hash from localStorage
    if (typeof window !== 'undefined') {
      const hash = localStorage.getItem('lastDonationHash');
      if (hash) {
        setTransactionHash(hash);
      }
    }

    // Check if the ID is valid
    if (!isValidProjectId(params.id)) {
      console.error("Invalid project ID:", params.id);
      toast({
        title: "Error",
        description: "Invalid project ID",
        variant: "destructive",
      });
      router.push("/dashboard/donations");
      return;
    }

    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${params.id}`, {
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Project API direct fetch response:", data);
        
        if (!data.success || !data.data) {
          throw new Error(data.error?.message || "Failed to load project");
        }
        
        setProject(data.data);
      } catch (error) {
        console.error("Failed to fetch project details:", error);
        toast({
          title: "Error",
          description: "Failed to load project details",
          variant: "destructive",
        });
        router.push("/dashboard/donations");
      }
    };

    fetchProject();
  }, [params.id, router, toast]);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <BlurContainer intensity="light" className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/donations")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </BlurContainer>

        <div className="max-w-2xl mx-auto">
          <BlurContainer>
            <Card className="border-0 bg-transparent">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>
                <CardTitle className="text-2xl">Thank You for Your Donation!</CardTitle>
                <CardDescription>
                  Your contribution has been successfully processed
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                {project && (
                  <div className="bg-white/20 backdrop-blur-sm rounded-md p-4">
                    <p className="text-lg font-medium mb-2">Project Details</p>
                    <p className="text-gray-600">{project.name}</p>
                    <p className="text-sm text-gray-500">by {project.charity_name}</p>
                  </div>
                )}
                
                {transactionHash && (
                  <div className="bg-white/30 backdrop-blur-md rounded-md p-4">
                    <p className="text-md font-semibold mb-3">Transaction Details</p>
                    <div className="text-sm mb-3">
                      <span className="font-medium">Transaction Hash: </span>
                      <span className="font-mono">{truncateHash(transactionHash)}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(getExplorerUrl(transactionHash), '_blank')}
                    >
                      View on Explorer <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                <div className="space-y-4">
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/dashboard/donations/${params.id}`)}
                  >
                    View Project
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push("/dashboard/donations")}
                  >
                    Browse More Projects
                  </Button>
                </div>
              </CardContent>
            </Card>
          </BlurContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}