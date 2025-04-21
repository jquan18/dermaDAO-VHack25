import { Metadata } from 'next';
import PoolsList from '@/components/pools/PoolsList';

export const metadata: Metadata = {
  title: 'Funding Pools | DermaDAO',
  description: 'Browse and participate in funding pools for dermatology research and innovation.',
  openGraph: {
    title: 'Funding Pools | DermaDAO',
    description: 'Discover themed funding pools for supporting dermatology research and innovation through quadratic funding.',
    images: [
      {
        url: '/images/pools-og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'DermaDAO Funding Pools',
      },
    ],
  },
};

export default function PoolsPage() {
  return (
    <div className="container py-8 md:py-12 max-w-7xl">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Funding Pools</h1>
          <p className="text-muted-foreground">
            Discover and support dermatology innovation through our quadratic funding pools.
          </p>
        </div>
        
        <PoolsList />
      </div>
    </div>
  );
} 