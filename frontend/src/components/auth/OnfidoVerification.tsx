"use client";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface OnfidoVerificationProps {
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  returnUrl?: string;
}

export function OnfidoVerification({ 
  className = "", 
  size = "default",
  variant = "default",
  returnUrl = "/"
}: OnfidoVerificationProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  
  // Check for is_onfido_verified field
  const isVerified = user?.is_onfido_verified === true;

  const handleVerification = () => {
    // Navigate to the verification page with returnUrl as a query parameter
    router.push(`/verification?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  return (
    <div className={cn("flex flex-col items-center w-full", className)}>
      <Button
        variant={variant}
        size={size}
        onClick={handleVerification}
        disabled={isVerified}
        className={cn(
          "flex items-center gap-2",
          isVerified && "bg-green-600 hover:bg-green-700"
        )}
      >
        {isVerified ? (
          <>Verified with Onfido</>
        ) : (
          <>Verify with Onfido</>
        )}
      </Button>
    </div>
  );
} 