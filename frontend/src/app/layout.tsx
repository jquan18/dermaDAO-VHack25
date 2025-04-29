import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { WalletProvider } from '@/context/wallet-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DermaDAO - Transparent Charity Funding Platform',
  description: 'A decentralized platform for transparent charity funding using blockchain technology',
  metadataBase: new URL('https://derma-dao-junquan2-ny0ncqjra-jquan18s-projects.vercel.app'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          {children}
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
} 