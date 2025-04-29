'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Clock, AlertCircle } from 'lucide-react';

interface ProjectCardProps {
  project: {
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    targetAmount: number;
    amountRaised: number;
    daysLeft: number;
    status: 'active' | 'pending' | 'completed' | 'rejected';
    category: string;
    poolId?: string;
  };
  showPoolBadge?: boolean;
}

export const ProjectCard = ({ project, showPoolBadge = false }: ProjectCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const progressPercentage = (project.amountRaised / project.targetAmount) * 100;
  
  const statusColors = {
    active: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
  };

  return (
    <Link href={`/projects/${project.id}`}>
      <motion.div
        className="h-full"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <Card className={`h-full overflow-hidden transition-shadow ${isHovered ? 'shadow-lg' : 'shadow-md'}`}>
          <div className="relative h-48 w-full overflow-hidden">
            {project.coverImage ? (
              <Image 
                src={project.coverImage} 
                alt={project.title} 
                fill 
                className="object-cover transition-transform duration-500" 
                style={isHovered ? { transform: 'scale(1.05)' } : undefined}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute top-3 right-3 z-10">
              <Badge 
                variant="secondary" 
                className={statusColors[project.status]}
              >
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
            </div>
            {showPoolBadge && project.poolId && (
              <div className="absolute top-3 left-3 z-10">
                <Badge 
                  variant="secondary" 
                  className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                >
                  Pool: {project.poolId}
                </Badge>
              </div>
            )}
          </div>
          
          <CardHeader className="pb-2">
            <CardTitle className="line-clamp-1 text-lg">{project.title}</CardTitle>
            <CardDescription className="line-clamp-2">{project.description}</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 pb-2">
            <Badge variant="outline" className="bg-background">
              {project.category}
            </Badge>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Raised: ${project.amountRaised.toLocaleString()}</span>
                <span className="font-medium">${project.targetAmount.toLocaleString()}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardContent>
          
          <CardFooter className="flex-col space-y-2 pt-0">
            <Separator />
            <div className="flex w-full justify-between text-sm text-muted-foreground">
              <div className="flex items-center">
                <Clock className="mr-1 h-4 w-4" />
                <span>{project.daysLeft} days left</span>
              </div>
              <div className="flex items-center">
                <CalendarDays className="mr-1 h-4 w-4" />
                <span>Updated recently</span>
              </div>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </Link>
  );
};
