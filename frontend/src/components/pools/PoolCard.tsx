'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, CircleDollarSign, Users } from 'lucide-react';

interface PoolCardProps {
  pool: {
    id: string;
    name: string;
    description: string;
    theme: string;
    is_active: boolean;
    logo_url?: string;
    banner_image?: string;
    sponsor_name?: string;
    sponsor_logo?: string;
    total_funds: number;
    allocated_funds: number;
    currency?: string;
    matching_pool?: number;
    current_round?: {
      id: string;
      start_time: string;
      end_time: string;
      is_distributed: boolean;
      active_project_count: number;
    };
  };
}

export default function PoolCard({ pool }: PoolCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const hasActiveRound = pool.current_round && 
    new Date(pool.current_round.end_time) > new Date() &&
    !pool.current_round.is_distributed;
  
  const fundingPercentage = pool.total_funds > 0
    ? Math.min(100, Math.round((pool.allocated_funds / pool.total_funds) * 100))
    : 0;

  const currency = pool.currency || 'ETH';

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card className="overflow-hidden transition-all hover:shadow-md">
        {pool.banner_image && (
          <div className="relative h-36 w-full overflow-hidden">
            <Image
              src={pool.banner_image}
              alt={pool.name}
              fill
              className="object-cover transition-transform duration-500"
              style={{
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
            <div className="absolute bottom-3 left-3">
              {!pool.is_active ? (
                <Badge variant="secondary">Inactive</Badge>
              ) : hasActiveRound ? (
                <Badge variant="default" className="bg-green-600">Active Round</Badge>
              ) : (
                <Badge variant="outline">No Active Round</Badge>
              )}
            </div>
          </div>
        )}
        {!pool.banner_image && (
          <div className="h-12 bg-primary/5 flex items-center justify-center">
            <div className="ml-3">
              {!pool.is_active ? (
                <Badge variant="secondary">Inactive</Badge>
              ) : hasActiveRound ? (
                <Badge variant="default" className="bg-green-600">Active Round</Badge>
              ) : (
                <Badge variant="outline">No Active Round</Badge>
              )}
            </div>
          </div>
        )}
        
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              {pool.logo_url && (
                <div className="relative w-8 h-8 rounded-full overflow-hidden">
                  <Image
                    src={pool.logo_url}
                    alt={`${pool.name} logo`}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <h3 className="font-bold text-lg line-clamp-1">{pool.name}</h3>
            </div>
            <Badge variant="outline">{pool.theme}</Badge>
          </div>
          {pool.sponsor_name && (
            <p className="text-sm text-muted-foreground">by {pool.sponsor_name}</p>
          )}
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {pool.description}
          </p>
          
          <div className="grid gap-3">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center">
                <CircleDollarSign className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>Total Funding</span>
              </div>
              <span className="font-medium">{pool.total_funds.toFixed(4)} {currency}</span>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Allocated</span>
                <span className="font-medium">{pool.allocated_funds.toFixed(4)} {currency}</span>
              </div>
              <Progress value={fundingPercentage} className="h-2" />
            </div>

            {hasActiveRound && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span>Ends in</span>
                  </div>
                  <span className="font-medium">
                    {pool.current_round?.end_time ? 
                      formatDistanceToNow(new Date(pool.current_round.end_time), { addSuffix: true }) : 
                      'No active round'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span>Active Projects</span>
                  </div>
                  <span className="font-medium">
                    {pool.current_round?.active_project_count || 0}
                  </span>
                </div>
              </>
            )}
            
            {pool.matching_pool && (
              <div className="flex justify-between items-center text-sm text-green-600">
                <span>🎁 Matching Pool</span>
                <span className="font-medium">{pool.matching_pool.toFixed(4)} {currency}</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <Button asChild className="w-full">
            <Link href={`/pools/${pool.id}`}>
              View Pool
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
} 