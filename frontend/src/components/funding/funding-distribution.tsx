"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  WalletIcon, 
  AlertTriangle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { quadraticFundingApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface FundingDistributionProps {
  roundId?: number;
  roundEnded: boolean;
  isDistributed: boolean;
  onDistributionComplete?: () => void;
  className?: string;
}

export function FundingDistribution({ 
  roundId, 
  roundEnded, 
  isDistributed, 
  onDistributionComplete,
  className 
}: FundingDistributionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [createNewRound, setCreateNewRound] = useState<boolean>(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDistribution = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);
      setWarningMessage(null);

      // First parameter should be a poolId (number) and second parameter is the boolean flag
      // Using the roundId from props as the poolId parameter
      if (!roundId) {
        throw new Error("Round ID is required for distribution");
      }
      const response = await quadraticFundingApi.distributeQuadraticFunding(roundId, createNewRound);

      if (response.success) {
        setSuccess(true);
        if (response.data.warning_message) {
          setWarningMessage(response.data.warning_message);
        }
        
        toast({
          title: "Distribution Successful",
          description: `Quadratic funding has been distributed to ${response.data.distributions?.length || 0} projects.${
            response.data.new_round_created ? ' A new funding round has been created.' : ''
          }`,
          variant: "default",
        });
        
        if (onDistributionComplete) {
          onDistributionComplete();
        }
      } else {
        setError(response.error?.message || "Failed to distribute funding");
        toast({
          title: "Distribution Failed",
          description: response.error?.message || "Failed to distribute funding",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || "An error occurred during distribution";
      setError(errorMessage);
      toast({
        title: "Distribution Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canDistribute = !isDistributed;

  if (isDistributed) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" />
            Funding Distribution
          </CardTitle>
          <CardDescription>Quadratic funding has been distributed for this round</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Distribution Complete</AlertTitle>
            <AlertDescription>
              Funds have been successfully distributed to eligible projects based on the quadratic funding formula.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <WalletIcon className="mr-2 h-5 w-5 text-primary" />
          Funding Distribution
        </CardTitle>
        <CardDescription>
          Distribute quadratic funding to eligible projects
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!roundEnded && (
          <Alert variant="warning" className="bg-yellow-50 text-yellow-800 border-yellow-200 mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Round Still Active</AlertTitle>
            <AlertDescription>
              This round is still active but you can still distribute funding early if needed. 
              A new round will start automatically if selected below.
            </AlertDescription>
          </Alert>
        )}
        
        {warningMessage && (
          <Alert variant="warning" className="bg-yellow-50 text-yellow-800 border-yellow-200 mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Early Distribution</AlertTitle>
            <AlertDescription>{warningMessage}</AlertDescription>
          </Alert>
        )}
        
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : success ? (
          <Alert variant="default" className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Quadratic funding has been successfully distributed!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This action will distribute the quadratic funding pool to all eligible projects
              based on the quadratic funding formula. This action cannot be undone.
            </p>
            
            <div className="flex items-center justify-between space-x-2 pt-2">
              <Label 
                htmlFor="create-new-round" 
                className="text-sm"
              >
                Automatically create new round after distribution
                <p className="text-xs mt-1 text-muted-foreground">
                  If enabled, a new 1-month funding round will begin immediately after distribution
                </p>
              </Label>
              <Switch
                id="create-new-round"
                checked={createNewRound}
                onCheckedChange={setCreateNewRound}
              />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          disabled={!canDistribute || isLoading || success}
          onClick={handleDistribution}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Distributing Funds...
            </>
          ) : (
            "Distribute Quadratic Funding"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 