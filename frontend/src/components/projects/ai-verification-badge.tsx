import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bot, CheckCircle, XCircle, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface AIVerificationBadgeProps {
  score: number;
  notes?: string | null;
  showDetails?: boolean;
}

export function AIVerificationBadge({
  score,
  notes,
  showDetails = true,
}: AIVerificationBadgeProps) {
  const [showNotes, setShowNotes] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4" />;
    if (score >= 70) return <AlertCircle className="h-4 w-4" />;
    if (score >= 50) return <AlertTriangle className="h-4 w-4" />;
    return <XCircle className="h-4 w-4" />;
  };

  const getScoreText = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score < 75 && score >= 70) return 'Needs Review';
    if (score >= 50) return 'Questionable';
    return 'Poor';
  };

  const getScoreVariant = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 70) return 'warning';
    if (score >= 50) return 'warning';
    return 'destructive';
  };

  const extractRecommendation = (notes: string): string => {
    const notesUpper = notes.toUpperCase();
    if (notesUpper.includes('APPROVE') || notesUpper.includes('RECOMMENDED')) return 'APPROVE';
    if (notesUpper.includes('REJECT') || notesUpper.includes('NOT RECOMMENDED')) return 'REJECT';
    if (notesUpper.includes('REVIEW')) return 'NEEDS REVIEW';
    return 'N/A';
  };

  const recommendation = extractRecommendation(notes || '');

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">AI Verification</CardTitle>
          </div>
          <Badge
            variant={recommendation === 'APPROVE' ? 'success' : recommendation === 'REJECT' ? 'destructive' : 'warning'}
            className="ml-auto"
          >
            {recommendation === 'APPROVE' ? 'Approved' : recommendation === 'REJECT' ? 'Rejected' : 'Needs Review'}
          </Badge>
        </div>
        <CardDescription>
          Automatically evaluated by our AI system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Verification Score</span>
              <div className="flex items-center gap-2">
                <Badge variant={getScoreVariant(score) as any}>
                  {getScoreText(score)}
                </Badge>
                <Popover>
                  <PopoverTrigger>
                    <div className="flex items-center gap-1 cursor-help">
                      {getScoreIcon(score)}
                      <span className="font-bold">{score}/100</span>
                      <Info className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3">
                    <h4 className="font-semibold mb-2">About this Score</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Our AI system evaluates projects based on the following criteria:
                    </p>
                    <ul className="text-xs space-y-1 list-disc pl-4">
                      <li>Scientific validity and evidence supporting claims</li>
                      <li>Transparency in methodology and data</li>
                      <li>Alignment with established medical knowledge</li>
                      <li>Completeness of information provided</li>
                      <li>Potential risk assessment</li>
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Progress value={score} className="h-2" indicatorColor={getScoreColor(score)} />
          </div>
          
          {showDetails && notes && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">AI Evaluation Notes</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowNotes(!showNotes)}
                  className="h-8 px-2"
                >
                  {showNotes ? (
                    <ChevronUp className="h-4 w-4 mr-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  )}
                  {showNotes ? "Hide Notes" : "Show Notes"}
                </Button>
              </div>
              {showNotes && (
                <div className="text-sm prose prose-sm max-w-none bg-muted p-3 rounded-md max-h-64 overflow-y-auto">
                  <ReactMarkdown>{notes}</ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 