"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FeatureItem {
  title: string;
  description: string;
  icon: ReactNode;
}

interface FeatureProps extends FeatureItem {
  index: number;
}

export function Feature({ title, description, icon, index }: FeatureProps) {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r py-10 px-4 relative group/feature",
        (index === 0 || index === 4) && "lg:border-l",
        index < 4 && "lg:border-b",
        "backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all duration-300"
      )}
    >
      {/* Add subtle gradient background on hover */}
      <div 
        className="opacity-0 group-hover/feature:opacity-100 transition-opacity duration-300 absolute inset-0 h-full w-full pointer-events-none"
        style={{
          background: "linear-gradient(125deg, rgba(255,255,255,0.2) 0%, rgba(255,183,255,0.15) 25%, rgba(153,210,255,0.15) 50%, rgba(178,255,209,0.15) 75%, rgba(255,255,255,0.2) 100%)",
        }}
      />
      
      {/* Icon - now without background box, directly inside padding container */}
      <div className=" relative z-10 px-6">
        <div className="text-black inline-flex items-center justify-center w-5 h-5">
          <div className="w-9 h-9">
            {icon}
          </div>
        </div>
      </div>
      
      {/* Feature indicator line */}
      <div className="absolute left-0 top-[4.5rem] h-6 group-hover/feature:h-7 w-1 rounded-r-full bg-blue-500/60 transition-all duration-200" />
      
      {/* Title aligned with description */}
      <div className="text-xl font-bold mb-3 relative z-10 px-6">
        <span className="text-black transition duration-200 inline-block group-hover/feature:translate-x-1">
          {title}
        </span>
      </div>
      
      {/* Description without background box, aligned with title */}
      <p className="text-sm text-black/80 relative z-10 px-6">
        {description}
      </p>
    </div>
  );
}

interface FeatureGridProps {
  features: FeatureItem[];
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export function FeatureGrid({ 
  features, 
  className, 
  columns = 4 
}: FeatureGridProps) {
  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  }[columns];

  return (
    <div className={cn(
      `grid ${gridColsClass} relative z-10 py-10 max-w-7xl mx-auto`,
      className
    )}>
      {features.map((feature, index) => (
        <Feature 
          key={feature.title} 
          {...feature} 
          index={index} 
        />
      ))}
    </div>
  );
}