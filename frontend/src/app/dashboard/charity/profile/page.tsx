"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Check,
  FileText,
  Upload,
  ShieldCheck,
  Building,
  Info,
  ExternalLink,
} from "lucide-react";
import { charityApi } from "@/lib/api";
import { WorldcoinVerification } from "@/components/auth/WorldcoinVerification";

export default function CharityProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [charity, setCharity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [country, setCountry] = useState("");
  
  // File upload
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Verification state
  const [verificationStatus, setVerificationStatus] = useState<any>(null);
  
  // Fetch charity details
  const fetchCharityDetails = async () => {
    if (!user?.charity_id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await charityApi.getCharityDetails(user.charity_id);
      const charityData = response.data;
      
      setCharity(charityData);
      
      // Set form values
      setName(charityData.name || "");
      setDescription(charityData.description || "");
      setWebsite(charityData.website || "");
      setRegistrationNumber(charityData.registration_number || "");
      setCountry(charityData.country || "");
      
      // Fetch verification status
      fetchVerificationStatus();
    } catch (err: any) {
      console.error("Error fetching charity details:", err);
      setError(err.response?.data?.error?.message || "Failed to load charity details");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch verification status
  const fetchVerificationStatus = async () => {
    if (!user?.charity_id) return;
    
    try {
      const response = await charityApi.getVerificationStatus(user.charity_id);
      setVerificationStatus(response.data);
    } catch (err) {
      console.error("Error fetching verification status:", err);
    }
  };
  
  useEffect(() => {
    if (user?.charity_id) {
      fetchCharityDetails();
    }
  }, [user?.charity_id]);
  
  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.charity_id) {
      setError("Charity ID not found");
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      
      const charityData = {
        name,
        description,
        website,
        registration_number: registrationNumber,
        country,
      };
      
      const response = await charityApi.updateCharity(user.charity_id, charityData);
      
      setSuccess("Charity profile updated successfully");
    } catch (err: any) {
      console.error("Error updating charity profile:", err);
      setError(err.response?.data?.error?.message || "Failed to update charity profile");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleFileUpload = async () => {
    if (!file || !user?.charity_id) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      
      const formData = new FormData();
      formData.append("file", file);
      
      // Simulating upload progress
      const uploadInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(uploadInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);
      
      const response = await charityApi.uploadDocument(user.charity_id, formData);
      
      clearInterval(uploadInterval);
      setUploadProgress(100);
      
      setSuccess("Documentation uploaded successfully");
      setFile(null);
      
      // Refresh verification status after upload
      fetchVerificationStatus();
      
      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress(0);
      }, 2000);
    } catch (err: any) {
      console.error("Error uploading documentation:", err);
      setError(err.response?.data?.error?.message || "Failed to upload documentation");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-64 bg-gray-200 rounded w-full"></div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!charity && !isLoading) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "Failed to load charity profile. Please try again."}
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Charity Profile</h1>
        <p className="text-gray-600">
          Manage your organization's information and verification documents
        </p>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Information Card */}
        <div className="md:col-span-2">
          <form onSubmit={handleProfileUpdate}>
            <Card>
              <CardHeader>
                <CardTitle>Organization Information</CardTitle>
                <CardDescription>
                  Update your charity's profile information
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Global Health Initiative"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your organization's mission and work..."
                    className="min-h-[120px]"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.org"
                      type="url"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="registration">Registration Number</Label>
                    <Input
                      id="registration"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="12345-ABC"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                      <SelectItem value="Germany">Germany</SelectItem>
                      <SelectItem value="France">France</SelectItem>
                      <SelectItem value="India">India</SelectItem>
                      <SelectItem value="Japan">Japan</SelectItem>
                      <SelectItem value="Brazil">Brazil</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
        
        {/* Verification Status Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>
                Current verification status and score
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle
                      className="text-gray-200"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="46"
                      cx="50"
                      cy="50"
                    />
                    <circle
                      className={`
                        ${verificationStatus?.verification?.score >= 70 ? 'text-green-500' : 
                          verificationStatus?.verification?.score >= 40 ? 'text-amber-500' : 
                          'text-red-500'}
                      `}
                      strokeWidth="8"
                      strokeDasharray={`${(verificationStatus?.verification?.score || 0) * 2.89} 289`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="46"
                      cx="50"
                      cy="50"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-3xl font-bold">{verificationStatus?.verification?.score || 0}%</div>
                    <div className="text-sm text-gray-500">Score</div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <Badge variant={verificationStatus?.verification?.is_verified ? "success" : "warning"}>
                    {verificationStatus?.verification?.is_verified ? "Verified" : "Pending Verification"}
                  </Badge>
                  {verificationStatus?.verification?.verified_at && (
                    <p className="text-xs text-gray-500 mt-2">
                      Verified on {new Date(verificationStatus.verification.verified_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              
              {verificationStatus?.suggestions && verificationStatus.suggestions.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Improvement Suggestions:</h3>
                  <ul className="text-sm space-y-1">
                    {verificationStatus.suggestions.map((suggestion: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Documentation Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle>Documentation</CardTitle>
              <CardDescription>
                Upload supporting documentation for verification
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="document">Upload Document</Label>
                <div className="border-2 border-dashed rounded-md p-6 text-center bg-gray-50">
                  <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-2">
                    Upload registration documents, annual reports, or other verification materials
                  </p>
                  <Input
                    id="document"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.jpg,.png"
                  />
                  <Label htmlFor="document" className="cursor-pointer">
                    <div className="bg-primary text-white py-2 px-4 rounded-md inline-flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      <span>Choose File</span>
                    </div>
                  </Label>
                  
                  {file && (
                    <div className="mt-3 text-left">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium truncate max-w-[200px]">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                      
                      {uploadProgress > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 text-right">
                            {uploadProgress}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <Button 
                onClick={handleFileUpload}
                disabled={!file || isSubmitting || uploadProgress > 0}
                className="w-full"
              >
                {isSubmitting ? "Uploading..." : "Upload Document"}
              </Button>
            </CardContent>
          </Card>
          
          {/* Worldcoin Verification */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShieldCheck className="h-5 w-5 mr-2" />
                Quadratic Funding Verification
              </CardTitle>
              <CardDescription>
                Verify your identity with Worldcoin to participate in quadratic funding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorldcoinVerification />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
} 