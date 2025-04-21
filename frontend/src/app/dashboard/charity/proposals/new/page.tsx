"use client";

import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProposalForm } from "@/components/proposals/proposal-form";

export default function NewProposalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("project");
  
  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div>
          <h1 className="text-2xl font-bold">New Withdrawal Proposal</h1>
          <p className="text-gray-500">
              Request funds from a project with bank or crypto transfer
          </p>
          </div>
        </div>
      </div>
      
      <ProposalForm preselectedProjectId={preselectedProjectId || undefined} />
    </DashboardLayout>
  );
} 