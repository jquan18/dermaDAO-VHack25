'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { 
  Loader2, 
  ArrowUpRight, 
  CircleDollarSign,
  CalendarDays
} from 'lucide-react';

export default function DonationsPage() {
  const params = useParams();
  const { toast } = useToast();
  const poolId = params.pool_id as string;
  
  const [pool, setPool] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        // Fetch pool details
        const poolResponse = await api.getPool(poolId);
        
        if (!poolResponse.data?.success) {
          throw new Error(poolResponse.data?.error?.message || 'Failed to fetch pool data');
        }
        
        setPool(poolResponse.data.data);
        
        // Fetch user's donations in this pool
        const donationsResponse = await api.getUserPoolDonations(poolId);
        
        if (!donationsResponse.data?.success) {
          throw new Error(donationsResponse.data?.error?.message || 'Failed to fetch donations data');
        }
        
        if (Array.isArray(donationsResponse.data.data)) {
          setDonations(donationsResponse.data.data);
        } else {
          console.warn('Expected donations data to be an array, but got:', donationsResponse.data.data);
          setDonations([]);
        }
      } catch (error: any) {
        console.error('Error fetching donations data:', error);
        toast({
          variant: 'destructive',
          title: 'Error fetching donations',
          description: error.message || 'Could not load donation information. Please try again later.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [poolId, toast]);
  
  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Calculate total donation amount
  const totalDonated = donations.reduce((total, donation) => total + Number(donation.amount || 0), 0);
  
  // Count unique projects donated to
  const uniqueProjects = new Set(donations.map(d => d.project_id)).size;
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading donation information...</span>
      </div>
    );
  }
  
  if (!pool) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Pool information not available.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Donation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">My Donations</CardTitle>
          <CardDescription>
            Your contribution history for this funding pool
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-secondary/10">
              <CardContent className="p-4 flex items-center">
                <CircleDollarSign className="h-8 w-8 mr-3 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Donated</p>
                  <p className="text-xl font-semibold">
                    {Number(totalDonated).toFixed(4)} ETH
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/10">
              <CardContent className="p-4 flex items-center">
                <CalendarDays className="h-8 w-8 mr-3 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Donation Count</p>
                  <p className="text-xl font-semibold">
                    {donations.length} donations
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/10">
              <CardContent className="p-4 flex items-center">
                <CircleDollarSign className="h-8 w-8 mr-3 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Projects Supported</p>
                  <p className="text-xl font-semibold">
                    {uniqueProjects} projects
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Donations Table */}
          {donations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Match Eligible</TableHead>
                  <TableHead>Transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations.map((donation) => (
                  <TableRow key={donation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {donation.project?.image_url ? (
                            <AvatarImage src={donation.project.image_url} alt={donation.project.name} />
                          ) : (
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {donation.project?.name?.charAt(0) || 'P'}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <Link 
                            href={`/dashboard/projects/${donation.project_id}`}
                            className="font-medium hover:underline"
                          >
                            {donation.project?.name || `Project #${donation.project_id}`}
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {Number(donation.amount || 0).toFixed(4)} ETH
                    </TableCell>
                    <TableCell>{formatDate(donation.created_at)}</TableCell>
                    <TableCell>
                      {donation.quadratic_eligible ? (
                        <Badge variant="success">Eligible</Badge>
                      ) : (
                        <Badge variant="secondary">Not Eligible</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {donation.transaction_hash ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2"
                          asChild
                        >
                          <a 
                            href={`https://sepolia.scrollscan.dev/tx/${donation.transaction_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center"
                          >
                            View <ArrowUpRight className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">You haven't made any donations to this pool yet.</p>
              <Button 
                asChild
                className="mt-4"
              >
                <Link href={`/dashboard/pools/${poolId}/projects`}>
                  Explore Projects
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Quadratic Funding Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Quadratic Funding</CardTitle>
          <CardDescription>
            How your donations contribute to the quadratic funding matching
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quadratic funding is a matching mechanism that optimizes for public goods funding. The amount of matching funds a project receives is proportional to the square root of the product of the number of contributors and the amount contributed.
          </p>
          
          <div className="rounded-lg bg-primary/5 p-4 border border-primary/10">
            <h3 className="font-medium mb-2">Your Impact</h3>
            <p className="text-sm">
              {donations.filter(d => d.quadratic_eligible).length > 0 ? (
                <>
                  You have made {donations.filter(d => d.quadratic_eligible).length} quadratic funding eligible donation{donations.filter(d => d.quadratic_eligible).length !== 1 ? 's' : ''}.
                  This means your contributions will be amplified by the matching pool, having a greater impact on the projects you support.
                </>
              ) : (
                <>
                  You don't have any quadratic funding eligible donations yet. To participate in quadratic funding, you need to verify your identity with Worldcoin.
                  This helps prevent sybil attacks and ensures fair distribution of matching funds.
                </>
              )}
            </p>
            
            {donations.filter(d => d.quadratic_eligible).length === 0 && (
              <Button 
                variant="outline" 
                className="mt-4"
                asChild
              >
                <Link href="/dashboard/profile">
                  Verify with Worldcoin
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 