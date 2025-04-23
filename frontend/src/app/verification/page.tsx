"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// Script loader to dynamically load the Onfido SDK
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.charset = 'utf-8';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

export default function VerificationPage() {
  const { user, isAuthenticated, verifyOnfido, completeOnfidoVerification } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isOnfidoActive, setIsOnfidoActive] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get return URL from query params
  const returnUrl = '/dashboard/wallet';

  // Handle back button click
  const handleBack = () => {
    router.push(returnUrl);
  };

  // Load Onfido SDK script
  useEffect(() => {
    if (!isScriptLoaded) {
      loadScript('https://sdk.onfido.com/v14')
        .then(() => {
          console.log("Onfido SDK script loaded successfully");
          setIsScriptLoaded(true);
        })
        .catch(error => {
          console.error('Failed to load Onfido SDK script:', error);
          toast({
            title: "Script Loading Error",
            description: "Failed to load Onfido verification script. Please try again later.",
            variant: "destructive"
          });
        });
    }

    // Clean up the Onfido SDK resources when component unmounts
    return () => {
      const onfidoContainer = document.getElementById('onfido-mount');
      if (onfidoContainer) {
        onfidoContainer.innerHTML = '';
      }
      setIsOnfidoActive(false);
    };
  }, [isScriptLoaded, toast]);

  // Start the verification process
  const startVerification = async () => {
    if (!isAuthenticated || !user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to verify your account with Onfido.",
        variant: "destructive"
      });
      router.push('/login');
      return;
    }

    try {
      setIsLoading(true);
      
      // Check if window.Onfido exists
      if (!(window as any).Onfido) {
        throw new Error("Verification SDK not loaded properly. Please refresh the page and try again.");
      }
      
      // Get Onfido SDK token
      const response = await verifyOnfido();
      
      if (response.sdk_token) {
        // Create a container for Onfido if it doesn't exist
        let container = document.getElementById('onfido-mount');
        if (!container) {
          container = document.createElement('div');
          container.id = 'onfido-mount';
          document.body.appendChild(container);
        }
        
        try {
          // Initialize the Onfido SDK
          const onfidoOptions = {
            token: response.sdk_token,
            containerId: 'onfido-mount',
            onComplete: async (data: any) => {
              try {
                // Call the backend to complete the verification
                await completeOnfidoVerification();
                
                toast({
                  title: "Verification Submitted",
                  description: "Your identity verification has been submitted and is being processed.",
                });
                
                // Hide the Onfido container
                setIsOnfidoActive(false);
                
                // Redirect to the return URL after a short delay
                setTimeout(() => {
                  router.push(returnUrl);
                }, 1500);
                
              } catch (error) {
                console.error('Error completing Onfido verification:', error);
                toast({
                  title: "Verification Error",
                  description: "There was an error completing your verification. Please try again.",
                  variant: "destructive"
                });
                setIsOnfidoActive(false);
              }
            },
            onError: (error: any) => {
              console.error('Onfido SDK error:', error);
              toast({
                title: "Verification Error",
                description: error.message || "There was an error during verification.",
                variant: "destructive"
              });
              setIsOnfidoActive(false);
            },
            // Steps set to follow recommended document verification flow
            steps: [
              'welcome',
              'document',
              'face',
              'complete'
            ]
          };
          
          (window as any).Onfido.init(onfidoOptions);
          
          // Show the Onfido container
          setIsOnfidoActive(true);
          
        } catch (initError: unknown) {
          console.error("Error initializing Onfido SDK:", initError);
          
          throw new Error(`Error initializing verification: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
        }
      } else {
        throw new Error('Failed to get verification token from server');
      }
    } catch (error: any) {
      console.error('Error starting Onfido verification:', error);
      toast({
        title: "Verification Error",
        description: error.message || "Unable to start verification process. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center mb-8">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack} 
          className="mr-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Identity Verification</h1>
      </div>

      {!isOnfidoActive && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-3">Verify your identity</h2>
          <p className="mb-4 text-gray-600">It should take a few minutes</p>
          
          <p className="mb-4">Use your device to:</p>
          
          {/* <ol className="list-decimal pl-8 mb-6">
            <li className="text-blue-600 mb-2">Take a photo of your identity document</li>
          </ol> */}
          
          <Button
            onClick={startVerification}
            disabled={isLoading || !isScriptLoaded || user?.is_onfido_verified === true}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
          >
            {user?.is_onfido_verified === true ? (
              "Already Verified"
            ) : isLoading ? (
              "Loading Verification..."
            ) : (
              "Start verification with Onfido"
            )}
          </Button>
          
          {/* <div className="flex items-center justify-center mt-8 text-gray-500">
            <img src="/onfido-logo.svg" alt="Onfido" className="h-6 mr-2" />
            <span className="text-sm">Real Identity</span>
          </div> */}
        </div>
      )}

      {/* Container for Onfido UI */}
      <div 
        id="onfido-mount" 
        className={`fixed top-0 left-0 w-full h-full flex items-center justify-center ${!isOnfidoActive && "hidden"}`}
        style={{
          display: isOnfidoActive ? 'flex' : 'none',
          zIndex: 9999
        }}
      ></div>
    </div>
  );
} 