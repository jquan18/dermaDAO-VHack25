"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Info } from "lucide-react";
import { charityApi } from "@/lib/api";

export default function CreateCharityPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    website: "",
    registrationNumber: "",
    country: "",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const response = await charityApi.createCharity({
        name: formData.name,
        description: formData.description,
        website: formData.website,
        registration_number: formData.registrationNumber,
        country: formData.country,
      });
      
      // Redirect to charity dashboard
      router.push('/dashboard/charity/profile');
    } catch (err: any) {
      console.error("Error creating charity:", err);
      setError(err.response?.data?.error?.message || "Failed to create charity");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container py-6">
        <h1 className="text-3xl font-bold mb-6">Create a Charity</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Charity Information</CardTitle>
            <CardDescription>
              Please provide details about your charity to get started
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="mb-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">Important Information</AlertTitle>
                <AlertDescription className="text-blue-700">
                  Charities are now automatically verified upon registration. Once your charity is created, you can immediately start creating projects.
                </AlertDescription>
              </Alert>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Charity Name</Label>
                <Input 
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Charity Description</Label>
                <Textarea 
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input 
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  type="url"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registrationNumber">Charity Registration Number</Label>
                <Input 
                  id="registrationNumber"
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input 
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  required
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
          
          <CardFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Charity"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
} 