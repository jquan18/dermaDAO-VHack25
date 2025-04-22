"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import projectsApi from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ProjectVotingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isWorldcoinVerified } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [voting, setVoting] = useState<{ [key: number]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      try {
        setIsLoading(true);
        const res = await projectsApi.getProjectsToVote();
        if (res.success) {
          setProjects(res.data);
        } else {
          throw new Error(res.error?.message || "Failed to load");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load projects");
      } finally {
        setIsLoading(false);
      }
    };
    if (isAuthenticated) fetch();
  }, [isAuthenticated]);

  const handleVote = async (projectId: number) => {
    if (!isWorldcoinVerified) {
      toast({ variant: "destructive", title: "Error", description: "Only verified users can vote." });
      return;
    }
    try {
      setVoting((prev) => ({ ...prev, [projectId]: true }));
      const res = await projectsApi.voteProject(projectId, true);
      if (res.success) {
        toast({ title: "Success", description: "Project approved." });
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        throw new Error(res.error?.message || "Vote failed");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Vote failed" });
    } finally {
      setVoting((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Project Verification Voting</h1>
      </div>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <div>Loading...</div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40">
            <p className="text-muted-foreground text-center mb-4">No projects pending your approval.</p>
            <Button asChild variant="outline">
              <Link href="/dashboard/donations">View Your Donations</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{project.description}</CardDescription>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  onClick={() => handleVote(project.id)}
                  isLoading={voting[project.id] || false}
                >
                  Approve
                </Button>
                <Button variant="link" asChild>
                  <Link href={`/projects/${project.id}`}>
                    View Details <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}