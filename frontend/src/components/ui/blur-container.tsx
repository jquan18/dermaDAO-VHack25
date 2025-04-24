import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BlurContainerProps = {
  children: ReactNode;
  className?: string;
  intensity?: "light" | "medium" | "strong";
};

export function BlurContainer({
  children,
  className = "",
  intensity = "strong",
}: BlurContainerProps) {
  const getIntensityStyles = () => {
    switch (intensity) {
      case "light":
        return "bg-white/20 backdrop-blur-sm";
      case "strong":
        return "bg-white/60 backdrop-blur-xl";
      case "medium":
      default:
        return "bg-white/30 backdrop-blur-md";
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg p-4",
        getIntensityStyles(),
        className
      )}
    >
      {children}
    </div>
  );
}
