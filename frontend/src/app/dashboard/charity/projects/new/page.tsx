"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, AlertTriangle, Info } from "lucide-react";
import { projectsApi } from "@/lib/api";
import { quadraticFundingApi } from "@/lib/api";
import { charityApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function NewProjectPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const [isLoadingCharity, setIsLoadingCharity] = useState(false);
  const [pools, setPools] = useState<any[]>([]);
  const [selectedPool, setSelectedPool] = useState<any>(null);
  
  // Add local state for charity ID as fallback
  const [localCharityId, setLocalCharityId] = useState<number | null>(null);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fundingGoal, setFundingGoal] = useState("");
  const [ipfsHash, setIpfsHash] = useState("");
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [isShariah, setIsShariah] = useState(false);

  // Fetch user's charity info if not already present
  useEffect(() => {
    const fetchCharityInfo = async () => {
      if (!user?.charity_id) {
        try {
          setIsLoadingCharity(true);
          setError(null);
          const response = await charityApi.getUserCharity();
          
          console.log("Charity info response:", response); // Log the full response for debugging
          
          if (response.success && response.data && response.data.charity) {
            // Update the auth store with charity_id if updateUser exists
            if (updateUser) {
              updateUser({
                ...user,
                charity_id: response.data.charity.id
              });
            }
            // Always set the local charity ID as fallback
            setLocalCharityId(response.data.charity.id);
          } else {
            console.error("Failed to fetch charity info:", response);
            
            // Provide more specific error message based on the error code
            let errorMessage = "Unable to retrieve charity information. Please ensure your account is linked to a charity organization.";
            if (response.error && response.error.code === 'NOT_CHARITY_ADMIN') {
              errorMessage = "Your account doesn't have charity admin privileges. Please contact support to update your role.";
            } else if (response.error && response.error.code === 'CHARITY_NOT_FOUND') {
              errorMessage = "No charity is associated with your account. Please create a charity first.";
            }
            setError(errorMessage);
          }
        } catch (err: any) {
          console.error("Error fetching charity info:", err);
          setError("Error connecting to server. Please try again later.");
        } finally {
          setIsLoadingCharity(false);
        }
      }
    };
    
    fetchCharityInfo();
  }, [user, updateUser]);
  
  // Fetch available pools
  useEffect(() => {
    const fetchPools = async () => {
      try {
        setIsLoadingPools(true);
        const response = await quadraticFundingApi.getPools(1, 100, { is_active: true });
        if (response.success && response.data) {
          // Fix: Extract pools correctly from the response
          const poolsData = response.data || [];
          console.log("Fetched pools:", poolsData);
          setPools(poolsData);
          
          // If there are no pools, set an error
          if (poolsData.length === 0) {
            setError("No active funding pools are available. Please contact the administrator.");
          }
        } else {
          console.error("Failed to fetch pools:", response);
          setError("Failed to load funding pools. Please try again later.");
        }
      } catch (err) {
        console.error("Error fetching pools:", err);
        setError("Error connecting to server. Please try again later.");
      } finally {
        setIsLoadingPools(false);
      }
    };
    
    fetchPools();
  }, []);

  // Update selected pool details when pool is selected
  useEffect(() => {
    if (selectedPoolId && pools.length > 0) {
      const pool = pools.find(p => p.id && p.id.toString() === selectedPoolId);
      if (pool) {
        console.log("Selected pool:", pool);
        setSelectedPool(pool);
      } else {
        console.warn("Selected pool ID not found in pools list:", selectedPoolId);
        setSelectedPool(null);
      }
    } else {
      setSelectedPool(null);
    }
  }, [selectedPoolId, pools]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use either the user's charity_id from auth store or the local fallback
    const effectiveCharityId = user?.charity_id || localCharityId;
    
    if (!effectiveCharityId) {
      setError("Unable to create project: Charity information not found");
      return;
    }

    if (!selectedPoolId) {
      setError("Please select a funding pool for your project");
      return;
    }
    
    // Validate required fields
    if (!name || !description || !fundingGoal) {
      setError("Please fill in all required fields");
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const projectData = {
        name,
        description,
        charity_id: effectiveCharityId,
        funding_goal: Number(fundingGoal),
        ipfs_hash: ipfsHash,
        pool_id: Number(selectedPoolId),
        is_shariah_compliant: isShariah
      };
      
      const response = await projectsApi.createProject(projectData);
      
      // Redirect to project details page
      router.push(`/dashboard/charity/projects/${response.projectId}`);
    } catch (err: any) {
      console.error("Error creating project:", err);
      setError(err.response?.data?.error?.message || "Failed to create project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create New Project</h1>
          <p className="text-gray-600">Create a new project for your charity with withdrawal proposal funding</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoadingCharity ? (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Loading</AlertTitle>
          <AlertDescription>Retrieving your charity information...</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Project Details</CardTitle>
                  <CardDescription>
                    Basic information about your project
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Shariah Compliant</span>
                  <Switch 
                    checked={isShariah} 
                    onCheckedChange={setIsShariah}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Clean Water Initiative"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="funding-goal">Funding Goal (ETH)</Label>
                    <Input
                      id="funding-goal"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={fundingGoal}
                      onChange={(e) => setFundingGoal(e.target.value)}
                      placeholder="0.5"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pool">Funding Pool <span className="text-red-500">*</span></Label>
                  <Select
                    value={selectedPoolId}
                    onValueChange={setSelectedPoolId}
                    required
                  >
                    <SelectTrigger id="pool">
                      <SelectValue placeholder="Select a funding pool" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingPools ? (
                        <SelectItem value="loading" disabled>Loading pools...</SelectItem>
                      ) : pools.length > 0 ? (
                        pools.map((pool) => (
                          <SelectItem key={pool.id} value={pool.id.toString()}>
                            {pool.name} - {pool.theme}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No pools available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedPool && (
                    <div className="mt-2 text-sm text-gray-500">
                      <p>{selectedPool.description}</p>
                      <div className="mt-1">
                        <Badge variant="outline" className="mr-2">
                          {selectedPool.end_date && selectedPool.start_date ? (
                            `Duration: ${Math.ceil(
                              (new Date(selectedPool.end_date).getTime() - new Date(selectedPool.start_date).getTime()) / 
                              (1000 * 60 * 60 * 24)
                            )} days`
                          ) : selectedPool.round_duration ? (
                            `Round duration: ${Math.floor((selectedPool.round_duration || 0) / 86400)} days`
                          ) : (
                            'No duration specified'
                          )}
                        </Badge>
                        {selectedPool.matching_ratio && (
                          <Badge variant="outline">
                            Matching ratio: {selectedPool.matching_ratio}x
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ipfs-hash">IPFS Hash (optional)</Label>
                  <Input
                    id="ipfs-hash"
                    value={ipfsHash}
                    onChange={(e) => setIpfsHash(e.target.value)}
                    placeholder="ipfs://Qm..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Project Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your project, its goals, and expected impact..."
                    className="min-h-[120px]"
                    required
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/charity/projects')}
              disabled={isSubmitting || isLoadingCharity}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoadingCharity}
            >
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      )}
    </DashboardLayout>
  );
} 