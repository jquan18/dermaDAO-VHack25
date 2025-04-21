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

interface ProposalVoteFormProps {
  proposalId: string;
  contractProposalId?: number | null;
  aiScore?: number | null;
  aiNotes?: string | null;
  showAiInfo?: boolean;
}

export function ProposalVoteForm({ 
  proposalId, 
  contractProposalId = null,
  aiScore = null, 
  aiNotes = null, 
  showAiInfo = true 
}: ProposalVoteFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [userVote, setUserVote] = useState<UserVote | null>(null);
  const [userHasDonated, setUserHasDonated] = useState(false);
  const [proposalStatus, setProposalStatus] = useState<string>('');
  
  // Form for submitting votes
  const form = useForm<z.infer<typeof voteFormSchema>>({
    resolver: zodResolver(voteFormSchema),
    defaultValues: {
      vote: true,
      comment: ""
    }
  });

  // Load votes data on mount
  useEffect(() => {
    const fetchVotes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch proposal to see if user has already voted
        const proposalResponse = await proposalsApi.getProposalStatus(proposalId);
        
        if (proposalResponse.success && proposalResponse.data) {
          setProposalStatus(proposalResponse.data.status);
          
          // Get all votes for this proposal
          const votesResponse = await proposalsApi.getProposalVotes(proposalId);
          
          if (votesResponse.success && votesResponse.data) {
            setVotes(votesResponse.data.votes);
            setStats(votesResponse.data.stats);
            
            // Check if user has voted
            const userVoteData = votesResponse.data.votes.find(
              (v: Vote) => v.user_id === user?.id
            );
            
            if (userVoteData) {
              setUserVote({
                vote_type: userVoteData.vote_type,
                comment: userVoteData.comment
              });
              
              // Update form values
              form.setValue("vote", userVoteData.vote_type === 'yes');
              form.setValue("comment", userVoteData.comment || "");
            }
            
            // Check if user has donated
            // In real app, we'd call a separate API to check this
            // For now, assume the user has donated if they can see the page
            setUserHasDonated(true);
          } else if (votesResponse.error) {
            setError(votesResponse.error.message || "Failed to load votes");
          }
        } else if (proposalResponse.error) {
          setError(proposalResponse.error.message || "Failed to load proposal");
        }
      } catch (err: any) {
        console.error("Error fetching votes:", err);
        setError(err.message || "An error occurred while loading votes");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (proposalId) {
      fetchVotes();
    }
  }, [proposalId, user?.id]);
  
  // Submit vote
  const onSubmit = async (data: z.infer<typeof voteFormSchema>) => {
    try {
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to vote on proposals",
          variant: "destructive"
        });
        return;
      }
      
      const result = await proposalsApi.voteOnProposal(proposalId, {
        vote: data.vote,
        comment: data.comment
      });
      
      if (result.success) {
        toast({
          title: "Vote submitted",
          description: "Your vote has been recorded successfully",
          variant: "default"
        });
        
        // Update local state
        setUserVote({
          vote_type: data.vote ? 'yes' : 'no',
          comment: data.comment
        });
        
        // Refresh votes data
        const votesResponse = await proposalsApi.getProposalVotes(proposalId);
        
        if (votesResponse.success && votesResponse.data) {
          setVotes(votesResponse.data.votes);
          setStats(votesResponse.data.stats);
        }
      } else {
        toast({
          title: "Vote failed",
          description: result.error?.message || "Failed to submit vote",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("Error submitting vote:", err);
      toast({
        title: "Vote failed",
        description: err.message || "An error occurred while submitting your vote",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl flex justify-between items-center">
          <span>Proposal Voting</span>
          {contractProposalId !== null && (
            <Badge variant="outline" className="ml-2 text-xs">
              Contract ID: {contractProposalId}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Vote on this proposal to approve or reject the fund withdrawal
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* Show AI verification details if available */}
            {showAiInfo && aiScore !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">AI Verification Score</h4>
                  <Badge variant={aiScore >= 70 ? "success" : "destructive"}>
                    {aiScore}/100
                  </Badge>
                </div>
                {aiNotes && (
                  <Alert variant="default" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <div className="whitespace-pre-line">{aiNotes}</div>
                  </Alert>
                )}
              </div>
            )}
            
            {/* Vote progress */}
            {stats && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Vote Progress</h4>
                  <Badge variant={stats.yes_percentage >= 50 ? "success" : "default"}>
                    {stats.yes_percentage}% Approved
                  </Badge>
                </div>
                <Progress value={stats.yes_percentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stats.total} votes</span>
                  <span>{stats.yes + stats.no + stats.abstain} total votes</span>
                </div>
              </div>
            )}
            
            {/* User's vote */}
            {userVote ? (
              <div>
                <Alert variant={userVote.vote_type === 'yes' ? "success" : "destructive"} className="mt-4">
                  <div className="flex items-center gap-2">
                    {userVote.vote_type === 'yes' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <div>
                      <AlertTitle>You voted: {userVote.vote_type === 'yes' ? "Approve" : "Reject"}</AlertTitle>
                      {userVote.comment && (
                        <AlertDescription className="mt-2">
                          "{userVote.comment}"
                        </AlertDescription>
                      )}
                    </div>
                  </div>
                </Alert>
              </div>
            ) : (
              // Vote form
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="vote"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel>Your Vote</FormLabel>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={field.value ? "default" : "outline"}
                            className={cn(
                              "flex-1",
                              field.value ? "bg-green-600 hover:bg-green-700" : ""
                            )}
                            onClick={() => field.onChange(true)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant={!field.value ? "default" : "outline"}
                            className={cn(
                              "flex-1",
                              !field.value ? "bg-red-600 hover:bg-red-700" : ""
                            )}
                            onClick={() => field.onChange(false)}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comment (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter your reasoning for this vote..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={!userHasDonated || ["approved", "rejected", "executed"].includes(proposalStatus)}
                  >
                    Submit Vote
                  </Button>
                  
                  {!userHasDonated && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Donation Required</AlertTitle>
                      <AlertDescription>
                        Only donors to this project can vote on proposals
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {["approved", "rejected", "executed"].includes(proposalStatus) && (
                    <Alert variant="warning" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Voting Closed</AlertTitle>
                      <AlertDescription>
                        This proposal has already been {proposalStatus}
                      </AlertDescription>
                    </Alert>
                  )}
                </form>
              </Form>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col">
        <div className="w-full">
          <h4 className="font-medium text-sm mb-3">Recent Votes</h4>
          {votes.length > 0 ? (
            <div className="space-y-2">
              {votes.slice(0, 5).map((vote, index) => (
                <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <Badge variant={vote.vote_type === 'yes' ? "success" : "destructive"} className="h-2 w-2 p-0 rounded-full" />
                    <span className="font-medium">{vote.user_name || `User ${vote.user_id}`}</span>
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline" className="ml-2">
                      {vote.vote_type === 'yes' ? "Approve" : "Reject"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              No votes yet
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
} 