"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectsApi } from "@/lib/api";

export default function DebugPage() {
  const [project, setProject] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchProject = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log(`Fetching project with id: ${id}`);
      const response = await projectsApi.getProject(id);
      console.log("Response:", response);
      setProject(response.data);
    } catch (err: any) {
      console.error("Error fetching project:", err);
      setError(err.message || "Failed to fetch project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">API Debug Page</h1>

      <div className="flex mb-4 space-x-2">
        <Button onClick={() => fetchProject("0")} disabled={loading}>
          Fetch Project ID 0
        </Button>
        <Button onClick={() => fetchProject("1")} disabled={loading}>
          Fetch Project ID 1
        </Button>
        <Button onClick={() => fetchProject("2")} disabled={loading}>
          Fetch Project ID 2
        </Button>
      </div>

      {loading && <p>Loading...</p>}
      
      {error && (
        <Card className="mb-4 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {project && (
        <Card>
          <CardHeader>
            <CardTitle>Project Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(project, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 