"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConnectWallet } from "@/components/blockchain/connect-wallet";
import { AlertCircle, CheckCircle, Clock, Search, Shield, ShieldCheck, ShieldX, Bot, Loader2 } from "lucide-react";
import { projectsApi } from "@/lib/api";
import { useBlockchain } from "@/hooks/use-blockchain";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Project = {
  id: number;
  name: string;
  description: string;
  charity_id: number;
  charity_name: string;
  wallet_address: string;
  is_active: boolean;
  is_verified: boolean;
  verification_notes: string;
  created_at: string;
};

export default function ProjectsVerification() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { isWalletConnected, blockchain } = useBlockchain();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [verificationInput, setVerificationInput] = useState({
    verified: false,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluatingProjectId, setEvaluatingProjectId] = useState<number | null>(null);
  
  useEffect(() => {
    // Redirect if not admin
    if (isAuthenticated && user && user.role !== 'admin') {
      router.push('/dashboard');
    }
    
    const fetchProjects = async () => {
      try {
        const response = await projectsApi.getAllProjects(1, 50);
        setProjects(response.data.projects);
      } catch (error) {
        console.error("Error fetching projects:", error);
        // For demo, use mock data
        setProjects(mockProjects);
      }
    };
    
    fetchProjects();
  }, [user, router, isAuthenticated]);
  
  const pendingProjects = projects.filter(project => !project.is_verified);
  const verifiedProjects = projects.filter(project => project.is_verified);
  
  const filteredPendingProjects = searchTerm 
    ? pendingProjects.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.charity_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : pendingProjects;
    
  const filteredVerifiedProjects = searchTerm 
    ? verifiedProjects.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.charity_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : verifiedProjects;

  const handleVerifyProject = async () => {
    if (!selectedProject) return;
    if (!isWalletConnected) {
      setError("Please connect your wallet first to perform blockchain operations.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Update the project verification in the database
      await projectsApi.verifyProject(
        selectedProject.id.toString(),
        verificationInput.verified,
        verificationInput.notes
      );
      
      // Call blockchain service to verify project
      await blockchain.verifyProject(
        selectedProject.id,
        verificationInput.verified
      );
      
      // Update local state
      setProjects(projects.map(project => 
        project.id === selectedProject.id 
          ? { 
              ...project, 
              is_verified: verificationInput.verified,
              verification_notes: verificationInput.notes 
            } 
          : project
      ));
      
      // Reset form and close dialog
      setSelectedProject(null);
      setVerificationInput({
        verified: false,
        notes: "",
      });
      setIsDialogOpen(false);
      
    } catch (error: any) {
      console.error("Error verifying project:", error);
      setError(error.message || "Failed to update project verification status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openVerifyDialog = (project: Project) => {
    setSelectedProject(project);
    setVerificationInput({
      verified: project.is_verified,
      notes: project.verification_notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleAiEvaluateProject = async (projectId: number) => {
    if (!isWalletConnected) {
      setError("Please connect your wallet first to perform operations.");
      return;
    }
    
    setIsEvaluating(true);
    setEvaluatingProjectId(projectId);
    setError(null);
    
    try {
      // Call the AI evaluation endpoint
      const result = await projectsApi.aiEvaluateProject(projectId.toString());
      
      if (result.success) {
        // Update the project in the local state with the new AI evaluation results
        setProjects(projects.map(project => 
          project.id === projectId 
            ? { 
                ...project, 
                verification_score: result.data.verification_score,
                verification_notes: result.data.verification_notes 
              } 
            : project
        ));
        
        toast({
          title: "AI Evaluation Complete",
          description: `Project received a score of ${result.data.verification_score}/100`,
          variant: "default"
        });
      } else {
        setError(result.error?.message || "Failed to evaluate project");
      }
    } catch (error: any) {
      console.error("Error evaluating project:", error);
      setError(error.message || "Failed to evaluate project with AI");
    } finally {
      setIsEvaluating(false);
      setEvaluatingProjectId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Project Verification</h2>
          <ConnectWallet />
        </div>
        
        <div className="flex items-center space-x-2">
          <Search className="h-5 w-5 text-gray-500" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Verification <Badge variant="outline" className="ml-2">{pendingProjects.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="verified">
              Verified <Badge variant="outline" className="ml-2">{verifiedProjects.length}</Badge>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Projects Pending Verification</CardTitle>
                <CardDescription>
                  Review and verify these projects to make them eligible for donations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredPendingProjects.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No projects pending verification
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Charity</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPendingProjects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell>{project.charity_name}</TableCell>
                          <TableCell>{formatDate(project.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Pending</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => openVerifyDialog(project)}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleAiEvaluateProject(project.id)}
                                disabled={isEvaluating && evaluatingProjectId === project.id}
                              >
                                {isEvaluating && evaluatingProjectId === project.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Evaluating...
                                  </>
                                ) : (
                                  <>
                                    <Bot className="h-4 w-4 mr-1" />
                                    AI Evaluate
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="verified">
            <Card>
              <CardHeader>
                <CardTitle>Verified Projects</CardTitle>
                <CardDescription>
                  Projects that have been verified and are eligible for donations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredVerifiedProjects.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No verified projects yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Charity</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVerifiedProjects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell>{project.charity_name}</TableCell>
                          <TableCell>{formatDate(project.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant="success">Verified</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => openVerifyDialog(project)}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                Update
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleAiEvaluateProject(project.id)}
                                disabled={isEvaluating && evaluatingProjectId === project.id}
                              >
                                {isEvaluating && evaluatingProjectId === project.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Evaluating...
                                  </>
                                ) : (
                                  <>
                                    <Bot className="h-4 w-4 mr-1" />
                                    AI Evaluate
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Verification Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedProject ? `Verify Project: ${selectedProject.name}` : 'Verify Project'}
              </DialogTitle>
              <DialogDescription>
                Update the verification status of this project
              </DialogDescription>
            </DialogHeader>
            
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <Label htmlFor="verified" className="flex-1">Verified Status</Label>
                <Switch
                  id="verified"
                  checked={verificationInput.verified}
                  onCheckedChange={(checked) => 
                    setVerificationInput(prev => ({ ...prev, verified: checked }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Verification Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about the verification..."
                  value={verificationInput.notes}
                  onChange={(e) => 
                    setVerificationInput(prev => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleVerifyProject}
                disabled={isSubmitting || !isWalletConnected}
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : verificationInput.verified ? (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Verify Project
                  </>
                ) : (
                  <>
                    <ShieldX className="h-4 w-4 mr-2" />
                    Mark as Unverified
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Mock data for testing
const mockProjects: Project[] = [
  {
    id: 1,
    name: "Clean Water Initiative",
    description: "Providing clean water to rural communities",
    charity_id: 1,
    charity_name: "Global Health Foundation",
    wallet_address: "0x123abc...",
    is_active: true,
    is_verified: false,
    verification_notes: "",
    created_at: "2023-06-01T10:00:00Z"
  },
  {
    id: 2,
    name: "Education for All",
    description: "Building schools in underserved areas",
    charity_id: 2,
    charity_name: "Education Forward",
    wallet_address: "0x456def...",
    is_active: true,
    is_verified: true,
    verification_notes: "Project documentation verified and approved",
    created_at: "2023-05-15T14:30:00Z"
  },
  {
    id: 3,
    name: "Reforestation Project",
    description: "Planting trees in deforested regions",
    charity_id: 3,
    charity_name: "Earth Alliance",
    wallet_address: "0x789ghi...",
    is_active: true,
    is_verified: false,
    verification_notes: "",
    created_at: "2023-06-10T09:15:00Z"
  }
]; 