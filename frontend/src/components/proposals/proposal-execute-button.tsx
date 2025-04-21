"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Wallet, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { proposalsApi } from "@/lib/api";

interface ProposalExecuteButtonProps {
  proposal: any;
  onExecuted?: () => void;
  className?: string;
}

export function ProposalExecuteButton({ 
  proposal, 
  onExecuted,
  className 
}: ProposalExecuteButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Extract proposal details
  const { 
    id: proposalId, 
    project_id: projectId, 
    amount, 
    transfer_type,
    crypto_address,
    description,
    status,
    contract_proposal_id: contractProposalId
  } = proposal;
  
  // Check if proposal is in executable state
  const isExecutable = status === 'approved' || status === 'pending_transfer';
  
  const executeTransfer = async () => {
    if (!isExecutable) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setTxHash(null);
      
      // Use the API client which automatically includes auth tokens
      const response = await proposalsApi.executeBlockchainTransfer(
        proposalId,
        projectId,
        parseFloat(amount),
        transfer_type || 'bank',
        crypto_address
      );
      
      if (response.success) {
        setTxHash(response.txHash);
        
        // Call the callback function if provided
        if (onExecuted) {
          setTimeout(() => {
            onExecuted();
          }, 2000);
        }
      } else {
        setError(response.error?.message || "Failed to execute blockchain transfer");
      }
    } catch (err: any) {
      console.error("Error executing transfer:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        variant="default"
        size="sm"
        className={className}
        disabled={!isExecutable || isLoading}
      >
        <Wallet className="mr-2 h-4 w-4" />
        Execute Transfer
      </Button>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute Blockchain Transfer</DialogTitle>
            <DialogDescription>
              This will execute the approved withdrawal proposal on the blockchain.
              {transfer_type === 'crypto' 
                ? ' Funds will be transferred directly to the recipient wallet address.'
                : ' Funds will be transferred to the bank transfer processing wallet.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-medium">Proposal ID:</div>
              <div>{proposalId} {contractProposalId !== undefined && `(Contract ID: ${contractProposalId})`}</div>
              
              <div className="font-medium">Project ID:</div>
              <div>{projectId}</div>
              
              <div className="font-medium">Amount:</div>
              <div>{formatCurrency(amount)} ETH</div>
              
              <div className="font-medium">Transfer Type:</div>
              <div>
                <Badge variant="outline">
                  {transfer_type === 'crypto' ? 'Crypto Transfer' : 'Bank Transfer'}
                </Badge>
              </div>
              
              {transfer_type === 'crypto' && crypto_address && (
                <>
                  <div className="font-medium">Recipient Address:</div>
                  <div className="font-mono text-xs overflow-hidden text-ellipsis">
                    {crypto_address}
                  </div>
                </>
              )}
              
              <div className="font-medium">Description:</div>
              <div className="truncate">{description}</div>
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {txHash && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Transaction Successful</AlertTitle>
                <AlertDescription className="text-green-700">
                  Transaction hash: <span className="font-mono text-xs break-all">{txHash}</span>
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            >
              {txHash ? "Close" : "Cancel"}
            </Button>
            
            {!txHash && (
              <Button 
                onClick={executeTransfer}
                disabled={isLoading || !isExecutable}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Execute Transfer"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 