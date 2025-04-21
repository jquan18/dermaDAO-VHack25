"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function WorldcoinCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing your verification...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Extract parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle callback errors from Worldcoin
        if (error) {
          setStatus('error');
          const errorMsg = errorDescription || 'Unknown error occurred';
          setMessage(`Worldcoin error: ${errorMsg}`);
          
          // Redirect to error page after a short delay
          setTimeout(() => {
            router.push(`/auth/verification-error?message=${encodeURIComponent(errorMsg)}`);
          }, 2000);
          return;
        }

        // Check if code and state are present
        if (!code || !state) {
          setStatus('error');
          setMessage('Missing required parameters');
          
          // Redirect to error page after a short delay
          setTimeout(() => {
            router.push('/auth/verification-error?message=Missing%20required%20parameters');
          }, 2000);
          return;
        }

        // The backend will handle the callback
        // We'll redirect to the appropriate page based on the URL we're redirected to
        // This callback page is just a loading indicator
        setStatus('success');
        setMessage('Verification successful! Redirecting...');
        
        // Redirect to the success page after a short delay
        // Our backend will handle the actual verification process
        setTimeout(() => {
          router.push('/auth/verification-success');
        }, 2000);
      } catch (error) {
        console.error('Error processing Worldcoin callback:', error);
        setStatus('error');
        setMessage('Failed to process verification');
        
        // Redirect to error page after a short delay
        setTimeout(() => {
          router.push('/auth/verification-error?message=Failed%20to%20process%20verification');
        }, 2000);
      }
    };

    processCallback();
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center text-center">
          {status === 'loading' && (
            <Loader2 className="h-20 w-20 text-blue-500 mb-4 animate-spin" />
          )}
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Processing Verification'}
            {status === 'success' && 'Verification Successful'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center px-6">
          <p>{message}</p>
        </CardContent>
      </Card>
    </div>
  );
} 