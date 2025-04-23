"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [role, setRole] = useState("user");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    charityName: "",
    charityDescription: "",
    companyName: "",
    companyDescription: "",
    companyWebsite: "",
  });
  
  useEffect(() => {
    // Check if role is provided in URL
    const roleParam = searchParams.get("role");
    if (roleParam && (roleParam === "user" || roleParam === "charity_admin" || roleParam === "corporate")) {
      setRole(roleParam);
    }
  }, [searchParams]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await register(
        formData.name,
        formData.email,
        formData.password,
        role,
        role === "charity_admin" ? formData.charityName : undefined,
        role === "charity_admin" ? formData.charityDescription : undefined,
        role === "corporate" ? {
          companyName: formData.companyName,
          companyDescription: formData.companyDescription,
          companyWebsite: formData.companyWebsite
        } : undefined
      );
      
      toast({
        title: "Registration successful",
        description: "Welcome to DermaDAO!",
        variant: "default",
      });
      
      // Redirect based on role
      if (role === "charity_admin") {
        router.push("/dashboard");
      } else if (role === "corporate") {
        router.push("/dashboard/corporate");
      } else {
        router.push("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.response?.data?.error?.message || "Unable to create account",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-3xl font-bold text-primary">DermaDAO</h1>
          </Link>
          <p className="text-gray-600 mt-2">
            Transparent charity funding on blockchain
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Create an Account</CardTitle>
            <CardDescription className="text-center">
              Join DermaDAO to make a difference
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={role} onValueChange={(value) => setRole(value)}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="user">Donor</TabsTrigger>
                <TabsTrigger value="charity_admin">Charity</TabsTrigger>
                <TabsTrigger value="corporate">Corporate</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="name">
                    Full Name
                  </label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="email">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <TabsContent value="charity_admin" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="charityName">
                      Charity Organization Name
                    </label>
                    <Input
                      id="charityName"
                      name="charityName"
                      placeholder="Global Relief Initiative"
                      value={formData.charityName}
                      onChange={handleChange}
                      required={role === "charity_admin"}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="charityDescription">
                      Organization Description
                    </label>
                    <textarea
                      id="charityDescription"
                      name="charityDescription"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                      placeholder="Tell us about your charity organization and its mission"
                      value={formData.charityDescription}
                      onChange={handleChange}
                      required={role === "charity_admin"}
                    />
                  </div>
                  
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                    <p>
                      <strong>Note:</strong> Charity accounts require verification
                      through Worldcoin before they can create projects.
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="corporate" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="companyName">
                      Company Name
                    </label>
                    <Input
                      id="companyName"
                      name="companyName"
                      placeholder="Acme Corporation"
                      value={formData.companyName}
                      onChange={handleChange}
                      required={role === "corporate"}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="companyWebsite">
                      Company Website
                    </label>
                    <Input
                      id="companyWebsite"
                      name="companyWebsite"
                      type="url"
                      placeholder="https://www.example.com"
                      value={formData.companyWebsite}
                      onChange={handleChange}
                      required={role === "corporate"}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="companyDescription">
                      Company Description
                    </label>
                    <textarea
                      id="companyDescription"
                      name="companyDescription"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                      placeholder="Tell us about your company and its mission"
                      value={formData.companyDescription}
                      onChange={handleChange}
                      required={role === "corporate"}
                    />
                  </div>
                  
                  <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-md">
                    <p>
                      <strong>Corporate Benefits:</strong> Create and sponsor your own themed funding pools. Track your impact with transparent reporting. Manage your ESG initiatives effectively.
                    </p>
                  </div>
                </TabsContent>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </Tabs>
          </CardContent>
          <CardFooter>
            <div className="text-center w-full text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 