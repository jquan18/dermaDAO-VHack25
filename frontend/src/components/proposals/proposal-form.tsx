"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, FileText, Upload, ArrowLeft } from "lucide-react";
import { TransferTypeSelector } from "@/components/proposals/transfer-type-selector";
import { CryptoAddressInput } from "@/components/proposals/crypto-address-input";
import { projectsApi, proposalsApi, bankAccountsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

// Create schema with conditional validation based on transfer type
const proposalFormSchema = z.object({
  project_id: z.string().min(1, "Please select a project"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  evidence_ipfs_hash: z.string().min(5, "Please upload evidence or enter IPFS hash"),
  amount: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be greater than 0"
  ),
  transfer_type: z.enum(["bank", "crypto"]),
  bank_account_id: z.string().optional(),
  crypto_address: z.string().optional(),
  milestone_index: z.string().optional(),
}).refine(
  (data) => {
    // Validate that bank_account_id is provided when transfer_type is 'bank'
    if (data.transfer_type === 'bank') {
      return !!data.bank_account_id;
    }
    return true;
  },
  {
    message: "Bank account is required when using bank transfer",
    path: ["bank_account_id"]
  }
).refine(
  (data) => {
    // Validate that crypto_address is provided when transfer_type is 'crypto'
    if (data.transfer_type === 'crypto') {
      return !!data.crypto_address;
    }
    return true;
  },
  {
    message: "Wallet address is required when using crypto transfer",
    path: ["crypto_address"]
  }
);

interface ProposalFormProps {
  preselectedProjectId?: string;
}

export function ProposalForm({ preselectedProjectId }: ProposalFormProps) {
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Initialize form
  const form = useForm<z.infer<typeof proposalFormSchema>>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      project_id: preselectedProjectId || "",
      description: "",
      evidence_ipfs_hash: "",
      amount: "",
      transfer_type: "bank",
      bank_account_id: "",
      crypto_address: "",
      milestone_index: "",
    },
  });
  
  // Get current values for conditional rendering
  const transferType = form.watch('transfer_type');
  
  // Fetch projects and bank accounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch all projects
        const projectsResponse = await projectsApi.getCharityProjects();
        
        if (projectsResponse.success && projectsResponse.data) {
          // Check if data is an array (direct from backend) or has projects property (from our error handler)
          const projectsList = Array.isArray(projectsResponse.data) 
            ? projectsResponse.data 
            : (projectsResponse.data.projects || []);

          // Only show active and verified projects
          const activeProjects = projectsList.filter(
            (project: any) => project.is_active && project.verification_score > 0
          );
          setProjects(activeProjects);
          
          // If project is preselected from URL, fetch its details
          if (preselectedProjectId) {
            const preselectedProject = activeProjects.find(
              (p: any) => (p.project_id || p.id).toString() === preselectedProjectId
            );
            
            if (preselectedProject) {
              setSelectedProject(preselectedProject);
              
              // Fetch project details to get milestones
              try {
                const projectDetailResponse = await projectsApi.getProject(preselectedProjectId);
                if (projectDetailResponse.success && projectDetailResponse.data) {
                  setSelectedProject(projectDetailResponse.data);
                }
              } catch (err) {
                console.error("Error fetching project details:", err);
              }
            }
          }
        } else if (projectsResponse.error) {
          setError(projectsResponse.error.message || "Failed to load projects");
        }
        
        // Fetch bank accounts
        const bankAccountsResponse = await bankAccountsApi.listBankAccounts();
        
        if (bankAccountsResponse.success && bankAccountsResponse.data) {
          // Only show verified bank accounts
          const verifiedAccounts = bankAccountsResponse.data.bank_accounts.filter(
            (account: any) => account.is_verified
          );
          setBankAccounts(verifiedAccounts);
          
          // Auto-select the first bank account if available and using bank transfer
          if (verifiedAccounts.length > 0) {
            const firstAccountId = (verifiedAccounts[0].bank_account_id || verifiedAccounts[0].id)?.toString() || "";
            if (firstAccountId) {
              form.setValue("bank_account_id", firstAccountId);
            }
          }
        }
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.response?.data?.error?.message || "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [form, preselectedProjectId]);
  
  // Handle project selection change
  const handleProjectChange = async (projectId: string) => {
    try {
      if (!projectId) {
        setSelectedProject(null);
        return;
      }
      
      const projectResponse = await projectsApi.getProject(projectId);
      
      if (projectResponse.success && projectResponse.data) {
        setSelectedProject(projectResponse.data);
      } else if (projectResponse.error) {
        console.error("Error fetching project details:", projectResponse.error.message);
        // Try to use a project from the projects list instead
        const selectedProject = projects.find(p => (p.project_id || p.id).toString() === projectId);
        if (selectedProject) {
          setSelectedProject(selectedProject);
        }
      }
    } catch (err) {
      console.error("Error fetching project details:", err);
      // Try to use a project from the projects list instead
      const selectedProject = projects.find(p => (p.project_id || p.id).toString() === projectId);
      if (selectedProject) {
        setSelectedProject(selectedProject);
      }
    }
  };
  
  // Simulate file upload to IPFS
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    try {
      setIsUploading(true);
      
      // Simulate IPFS upload with a timeout
      // In a real app, you would upload to IPFS here
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a fake IPFS hash
      const fakeIpfsHash = `ipfs://Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      
      form.setValue("evidence_ipfs_hash", fakeIpfsHash);
      form.trigger("evidence_ipfs_hash");
      
      setIsUploading(false);
    } catch (err) {
      console.error("Error uploading file:", err);
      setIsUploading(false);
    }
  };
  
  // Handle form submission
  const onSubmit = async (data: z.infer<typeof proposalFormSchema>) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Create the proposal with transfer type
      const response = await proposalsApi.createProposalWithTransferType({
        project_id: parseInt(data.project_id),
        description: data.description,
        evidence_ipfs_hash: data.evidence_ipfs_hash,
        amount: parseFloat(data.amount),
        transfer_type: data.transfer_type,
        bank_account_id: data.transfer_type === 'bank' ? parseInt(data.bank_account_id || '0') : undefined,
        crypto_address: data.transfer_type === 'crypto' ? data.crypto_address : undefined,
        milestone_index: data.milestone_index ? parseInt(data.milestone_index) : undefined,
      });
      
      if (response.success) {
        // Redirect to the proposal list page
        router.push("/dashboard/charity/proposals");
      } else {
        setError(response.error?.message || "Failed to create proposal");
      }
    } catch (err: any) {
      console.error("Error creating proposal:", err);
      setError(err.response?.data?.error?.message || "Failed to create proposal");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>New Withdrawal Proposal</CardTitle>
        <CardDescription>
          Request to withdraw funds from your project
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select
                    disabled={isLoading || isSubmitting || !!preselectedProjectId}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleProjectChange(value);
                    }}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem
                          key={project.project_id || project.id}
                          value={(project.project_id || project.id).toString()}
                        >
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the project you want to withdraw funds from
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {selectedProject && (
              <div className="rounded-md bg-muted p-4">
                <h3 className="font-medium">Project Details</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {selectedProject.description?.substring(0, 100)}...
                </p>
                <div className="text-sm">
                  <span className="font-medium">Wallet address: </span>
                  <span className="font-mono text-xs">
                    {selectedProject.wallet_address}
                  </span>
                </div>
              </div>
            )}
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain the purpose of this withdrawal"
                      {...field}
                      rows={4}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide a clear explanation for this withdrawal request
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="evidence_ipfs_hash"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supporting Documentation</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        placeholder="IPFS hash (e.g., ipfs://Qm...)"
                        {...field}
                        disabled={isSubmitting || isUploading}
                      />
                    </FormControl>
                    <div className="relative">
                      <Input
                        type="file"
                        id="file-upload"
                        className="absolute inset-0 opacity-0 w-full cursor-pointer"
                        onChange={handleFileUpload}
                        disabled={isSubmitting || isUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="flex gap-2 items-center"
                        disabled={isSubmitting || isUploading}
                      >
                        {isUploading ? "Uploading..." : "Upload"}
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <FormDescription>
                    Upload supporting documentation (e.g., invoices, receipts)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (ETH)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      placeholder="0.01"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the amount of ETH to withdraw
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="transfer_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transfer Method</FormLabel>
                  <FormControl>
                    <TransferTypeSelector
                      value={field.value as "bank" | "crypto"}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Choose how you would like to receive the funds
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {transferType === 'bank' && (
              <FormField
                control={form.control}
                name="bank_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Account</FormLabel>
                    <Select
                      disabled={isLoading || isSubmitting || bankAccounts.length === 0}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a bank account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem
                            key={account.bank_account_id || account.id}
                            value={(account.bank_account_id || account.id).toString()}
                          >
                            {account.bank_name} - {account.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {bankAccounts.length === 0 && (
                      <Alert variant="warning" className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          You need to add and verify a bank account first.
                        </AlertDescription>
                      </Alert>
                    )}
                    <FormDescription>
                      Select the bank account to receive the funds
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {transferType === 'crypto' && (
              <FormField
                control={form.control}
                name="crypto_address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CryptoAddressInput
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={form.formState.errors.crypto_address?.message}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {selectedProject?.milestones?.length > 0 && (
              <FormField
                control={form.control}
                name="milestone_index"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Milestone (Optional)</FormLabel>
                    <Select
                      disabled={isSubmitting}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a milestone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">
                          No specific milestone
                        </SelectItem>
                        {selectedProject.milestones.map((milestone: any, index: number) => (
                          <SelectItem
                            key={milestone.id}
                            value={index.toString()}
                            disabled={milestone.status === 'completed'}
                          >
                            {milestone.title} ({milestone.percentage}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link this withdrawal to a specific project milestone
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="flex-1"
              >
                {isSubmitting ? "Creating..." : "Create Proposal"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
} 