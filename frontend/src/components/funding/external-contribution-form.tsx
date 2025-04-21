"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { quadraticFundingApi } from "@/lib/api";

interface ExternalContributionFormProps {
  className?: string;
  roundId?: number;
  onSuccess?: () => void;
}

export function ExternalContributionForm({ className, roundId, onSuccess }: ExternalContributionFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    transaction_hash: "",
    amount: "",
    contributor_address: "",
    contributor_name: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.transaction_hash || !formData.amount) {
      setError("Transaction hash and amount are required");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Format the data
      const contributionData = {
        ...formData,
        round_id: roundId
      };
      
      const response = await quadraticFundingApi.recordExternalContribution(contributionData);
      
      if (response.success) {
        setSuccess(true);
        setFormData({
          transaction_hash: "",
          amount: "",
          contributor_address: "",
          contributor_name: "",
        });
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 500);
        }
      } else {
        setError(response.error?.message || "Failed to record contribution");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Record External Contribution</CardTitle>
        <CardDescription>
          Record direct transfers to the funding pool that were made outside the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">
              External contribution was successfully recorded
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transaction_hash">Transaction Hash *</Label>
            <Input
              id="transaction_hash"
              name="transaction_hash"
              value={formData.transaction_hash}
              onChange={handleChange}
              placeholder="0x..."
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (ETH) *</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.000001"
              min="0.000001"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.01"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contributor_address">Contributor Address (Optional)</Label>
            <Input
              id="contributor_address"
              name="contributor_address"
              value={formData.contributor_address}
              onChange={handleChange}
              placeholder="0x..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contributor_name">Contributor Name (Optional)</Label>
            <Input
              id="contributor_name"
              name="contributor_name"
              value={formData.contributor_name}
              onChange={handleChange}
              placeholder="Anonymous Donor"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !formData.transaction_hash || !formData.amount}
          >
            {loading ? "Recording..." : "Record Contribution"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between text-xs text-muted-foreground">
        <p>* Required fields</p>
        {roundId && <p>Recording for Round #{roundId}</p>}
      </CardFooter>
    </Card>
  );
} 