"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import LoadingScreen from "@/components/common/loading-screen";
import { MainLayout } from "@/components/layout/main-layout";
import Iridescence from "@/components/ui/iridescence";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated, user } = useAuthStore();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log("Auth state in login page:", { isAuthenticated, userRole: user?.role });
      
      // Redirect based on user role
      if (user.role === "charity_admin") {
        console.log("Redirecting to charity dashboard");
        router.push("/dashboard/charity");
      } else if (user.role === "admin") {
        console.log("Redirecting to admin dashboard");
        router.push("/dashboard/admin");
      } else if (user.role === "corporate") {
        console.log("Redirecting to corporate dashboard");
        router.push("/dashboard/corporate");
      } else {
        console.log("Redirecting to donations dashboard");
        router.push("/dashboard/donations");
      }
    }
  }, [isAuthenticated, user, router]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(formData.email, formData.password);
      toast({
        title: "Login successful",
        description: "Welcome back to DermaDAO!",
        variant: "default",
      });
      
      // Force a small delay to ensure state is updated
      setTimeout(() => {
        console.log("Manual redirect check after login:", { 
          isAuthenticated, 
          userRole: user?.role 
        });
        
        if (user?.role === "corporate") {
          console.log("Manual redirect to corporate dashboard");
          router.push("/dashboard/corporate");
        }
      }, 500);
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.response?.data?.error?.message || "Invalid credentials",
        variant: "destructive",
      });
    }
  };
  
  return (
    <>
      <LoadingScreen isLoading={isLoading} />
      
      <MainLayout fullWidthHero>
        <Iridescence color={[1, 1, 1]} mouseReact={true} amplitude={1.0} speed={1.0} />
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
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
                <CardTitle className="text-2xl text-center">Sign In</CardTitle>
                <CardDescription className="text-center">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium" htmlFor="password">
                        Password
                      </label>
                      <Link
                        href="/auth/forgot-password"
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : "Sign In"}
                  </Button>
                </form>
              </CardContent>
              <CardFooter>
                <div className="text-center w-full text-sm">
                  Don&apos;t have an account?{" "}
                  <Link href="/auth/register" className="text-primary hover:underline">
                    Sign up
                  </Link>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </MainLayout>
    </>
  );
} 