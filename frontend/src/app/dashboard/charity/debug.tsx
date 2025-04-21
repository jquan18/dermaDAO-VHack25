"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { authApi, charityApi } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import axios from "axios";

export default function CharityDebugPage() {
  const [user, setUser] = useState<any>(null);
  const [charities, setCharities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});

  // Fetch user and charities
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get user profile
        const userResponse = await authApi.getMe();
        console.log("User response:", userResponse);
        
        if (userResponse.success && userResponse.data) {
          setUser(userResponse.data);
        }
        
        // Get charities
        const charitiesResponse = await axios.get('/api/charities');
        console.log("Charities response:", charitiesResponse.data);
        
        if (charitiesResponse.data.success && charitiesResponse.data.data) {
          const charitiesData = Array.isArray(charitiesResponse.data.data) 
            ? charitiesResponse.data.data 
            : charitiesResponse.data.data.charities || [];
            
          setCharities(charitiesData);
        }
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Run diagnostic check
  const runDiagnostics = async () => {
    try {
      setChecking(true);
      
      const debugData: any = {
        user: user,
        charities: charities,
      };
      
      // Check if user is in any charity's admin_id
      if (user && charities.length > 0) {
        const userCharity = charities.find((charity) => charity.admin_id === user.id);
        debugData.userCharity = userCharity;
        debugData.isAdmin = !!userCharity;
      }
      
      // Try to fetch user's charity projects
      try {
        const response = await axios.get('/api/debug/user-charity');
        debugData.userCharityCheck = response.data;
      } catch (err) {
        debugData.userCharityCheck = {
          error: "Failed to check user charity",
          details: err
        };
      }
      
      setDebugInfo(debugData);
    } catch (err: any) {
      console.error("Error running diagnostics:", err);
      setError(err.message || "Failed to run diagnostics");
    } finally {
      setChecking(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Charity Debug Page</h1>
        <p className="text-gray-500">
          Use this page to diagnose issues with charity admin associations
        </p>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            ) : user ? (
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">User ID:</span> {user.id}
                </div>
                <div>
                  <span className="font-semibold">Email:</span> {user.email}
                </div>
                <div>
                  <span className="font-semibold">Name:</span> {user.full_name}
                </div>
                <div>
                  <span className="font-semibold">Role:</span> {user.role}
                </div>
                <div>
                  <span className="font-semibold">Is Admin:</span> {user.is_admin ? "Yes" : "No"}
                </div>
                <div>
                  <span className="font-semibold">Charity ID:</span> {user.charity_id || "Not associated"}
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No user data available</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Charities ({charities.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            ) : charities.length > 0 ? (
              <div className="space-y-4">
                {charities.map((charity) => (
                  <div key={charity.id} className="p-3 border rounded">
                    <div className="font-semibold">{charity.name}</div>
                    <div className="text-sm text-gray-500">{charity.description}</div>
                    <div className="text-sm mt-1">
                      <span className="font-semibold">ID:</span> {charity.id}, 
                      <span className="font-semibold ml-2">Admin ID:</span> {charity.admin_id}
                      {user && charity.admin_id === user.id && (
                        <span className="ml-2 text-green-600 font-medium">(You are admin)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">No charities found</div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6">
        <Button onClick={runDiagnostics} disabled={loading || checking}>
          {checking ? "Running Diagnostics..." : "Run Diagnostics"}
        </Button>
      </div>
      
      {Object.keys(debugInfo).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Diagnostic Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">User-Charity Association:</h3>
                {debugInfo.isAdmin ? (
                  <div className="text-green-600">
                    ✓ User is admin of charity ID: {debugInfo.userCharity?.id}
                  </div>
                ) : (
                  <div className="text-red-600">
                    ✗ User is not admin of any charity
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-medium">Debug Information:</h3>
                <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto mt-2">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
} 