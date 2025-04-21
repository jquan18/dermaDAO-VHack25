import { Metadata } from 'next';
import PoolDetail from '@/components/pools/PoolDetail';

interface PoolPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PoolPageProps): Promise<Metadata> {
  try {
    // Fetch pool data on the server
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pools/${params.id}`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch pool data');
    }
    
    const pool = await response.json();
    
    return {
      title: `${pool.name} | DermaDAO Funding Pool`,
      description: pool.description.substring(0, 160),
      openGraph: {
        title: `${pool.name} | DermaDAO Funding Pool`,
        description: pool.description.substring(0, 160),
        images: pool.banner_image ? [
          {
            url: pool.banner_image,
            width: 1200,
            height: 630,
            alt: pool.name,
          },
        ] : [
          {
            url: '/images/default-pool-banner.jpg',
            width: 1200,
            height: 630,
            alt: 'DermaDAO Funding Pool',
          }
        ],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Funding Pool | DermaDAO',
      description: 'View details about this dermatology research funding pool.',
    };
  }
}

export default function PoolPage({ params }: PoolPageProps) {
  return (
    <div className="container py-8 max-w-7xl">
      <PoolDetail poolId={params.id} />
    </div>
  );
} 