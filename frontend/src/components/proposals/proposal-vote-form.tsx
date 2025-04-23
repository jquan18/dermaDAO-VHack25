"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
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
  AlertCircle,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Users,
  AlertTriangle
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { proposalsApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Schema for the vote form
const voteFormSchema = z.object({
  vote: z.boolean(),
  comment: z.string().optional(),
});

interface Vote {
  id: string;
  user_id: string;
  user_name?: string;
  proposal_id: string;
  vote_type: 'yes' | 'no' | 'abstain';
  comment?: string;
  created_at: string;
}

interface UserVote {
  vote_type: 'yes' | 'no' | 'abstain';
  comment?: string;
}

interface VoteStats {
  yes: number;
  no: number;
  abstain: number;
  total: number;
  yes_percentage: number;
  no_percentage: number;
  abstain_percentage: number;
}

interface ProposalVerificationStatusProps {
  proposalId: string;
  contractProposalId?: number | null;
  aiScore?: number | null;
  aiNotes?: string | null;
  status?: string;
}

export function ProposalVerificationStatus({ 
  proposalId, 
  contractProposalId = null,
  aiScore = null, 
  aiNotes = null,
  status = "pending_verification"
}: ProposalVerificationStatusProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposalStatus, setProposalStatus] = useState<string>(status || 'pending_verification');
  const [verificationScore, setVerificationScore] = useState<number | null>(aiScore);
  const [verificationNotes, setVerificationNotes] = useState<string | null>(aiNotes);

  // Load proposal data on mount if score is not provided
  useEffect(() => {
    const fetchProposalDetails = async () => {
      if (verificationScore !== null) {
        setIsLoading(false);
        return; // Already have verification info
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch proposal details
        const proposalResponse = await proposalsApi.getProposalDetails(proposalId);
        
        if (proposalResponse.success && proposalResponse.data) {
          setProposalStatus(proposalResponse.data.status);
          setVerificationScore(proposalResponse.data.ai_verification_score);
          setVerificationNotes(proposalResponse.data.ai_verification_notes);
        } else if (proposalResponse.error) {
          setError(proposalResponse.error.message || "Failed to load proposal details");
        }
      } catch (err: any) {
        console.error("Error fetching proposal details:", err);
        setError(err.message || "An error occurred while loading proposal details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProposalDetails();
  }, [proposalId, verificationScore]);

  // Get the appropriate status badge
  const getStatusBadge = () => {
    switch (proposalStatus) {
      case "pending_verification":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-yellow-500 text-yellow-500">
            <AlertCircle size={14} />
            <span>Pending Verification</span>
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-green-500 text-green-500">
            <CheckCircle size={14} />
            <span>Approved</span>
          </Badge>
        );
      case "executed":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-blue-500 text-blue-500">
            <CheckCircle size={14} />
            <span>Executed</span>
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-red-500 text-red-500">
            <XCircle size={14} />
            <span>Rejected</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <AlertCircle size={14} />
            <span>{proposalStatus.replace(/_/g, " ")}</span>
          </Badge>
        );
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center">Loading verification details...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verification status */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Status</h4>
        {getStatusBadge()}
      </div>

      {/* Show AI verification details if available */}
      {verificationScore !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">AI Verification Score</h4>
            <Badge variant={verificationScore >= 70 ? "success" : "destructive"}>
              {verificationScore}/100
            </Badge>
          </div>
          <Progress value={verificationScore} className="h-2" />
          {verificationNotes && (
            <Alert variant="default" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              <div className="whitespace-pre-line">{verificationNotes}</div>
            </Alert>
          )}
        </div>
      )}

      {/* Add automated process explanation */}
      <Alert variant="default" className="text-sm">
        <AlertCircle className="h-4 w-4 mr-2" />
        <div>
          <AlertTitle>Automated Verification</AlertTitle>
          <AlertDescription>
            Proposals are automatically verified by our AI system. When a proposal receives a verification score of 70 or higher, 
            it is automatically approved and the blockchain transaction is executed without requiring manual intervention.
          </AlertDescription>
        </div>
      </Alert>

      {/* Proposal ID information */}
      {contractProposalId !== null && (
        <div className="text-sm text-muted-foreground">
          <div>Proposal ID: {proposalId}</div>
          <div>Contract Proposal ID: {contractProposalId}</div>
        </div>
      )}
    </div>
  );
} 