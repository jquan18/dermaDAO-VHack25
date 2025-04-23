"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/main-layout";
import Iridescence from '@/components/ui/iridescence';
import { FeatureGrid, FeatureItem } from "@/components/ui/feature-grid";
import {
  IconAdjustmentsBolt,
  IconCloud,
  IconCurrencyDollar,
  IconEaseInOut,
  IconHeart,
  IconHelp,
  IconRouteAltLeft,
  IconTerminal2,
} from "@tabler/icons-react";

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const features: FeatureItem[] = [
  {
    title: "Your Feature Title",
    description: "Your feature description goes here",
    icon: <IconCloud />,
  },
  {
    title: "Your Feature Title",
    description: "Your feature description goes here",
    icon: <IconCloud />,
  },
  {
    title: "Your Feature Title",
    description: "Your feature description goes here",
    icon: <IconCloud />,
  },
  {
    title: "Your Feature Title",
    description: "Your feature description goes here",
    icon: <IconCloud />,
  },
  {
    title: "Your Feature Title",
    description: "Your feature description goes here",
    icon: <IconCloud />,
  },
  {
    title: "Your Feature Title",
    description: "Your feature description goes here",
    icon: <IconCloud />,
  }
  // Add more features...
];

export default function HomePage() {
  return (
    <MainLayout fullWidthHero={true}>
      <Iridescence
  color={[1, 1, 1]}
  mouseReact={true}
  amplitude={1.0}
  speed={1.0}
/>

      {/* Content Wrapper - Passed as the second child */}
      <div className="relative z-10"> {/* Added relative z-10 to ensure content is above background */}
        {/* Hero Section content */}
        <motion.section
          className="flex items-center justify-center px-4 py-48" 
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-black mb-6 tracking-tight">
              The first modular<br />charity funding platform
            </h1>
            <p className="text-xl md:text-2xl text-black/90 mb-10 max-w-3xl mx-auto">
              DermaDAO is a decentralized platform that brings transparency and
              accountability to charity donations through blockchain technology.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Link href="/auth/register">
                <Button size="lg" className="bg-black hover:bg-black/80 text-white px-8 py-6 text-lg rounded-md">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </motion.section>

        {/* Features Section */}
        {/* Changed py-20 to pt-20 pb-48 for more bottom spacing */}
        <section className="pt-20 pb-20 text-black">
        <FeatureGrid features={features} columns={2} />
          {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Revolutionizing Charity Transparency</h2>
              <p className="text-lg text-black/90 max-w-3xl mx-auto">
                Every donation on DermaDAO is tracked on the blockchain, ensuring complete transparency and accountability.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="bg-white/5 p-8 rounded-lg backdrop-blur-sm">
                <h3 className="text-2xl font-bold mb-4">Verified Charities</h3>
                <p className="text-black/90">
                  Every charity on our platform is verified through a rigorous process to ensure legitimacy and accountability.
                </p>
              </div>

              <div className="bg-white/5 p-8 rounded-lg backdrop-blur-sm">
                <h3 className="text-2xl font-bold mb-4">Quadratic Funding</h3>
                <p className="text-black/90">
                  Our innovative funding model amplifies the impact of your donations through matched contributions.
                </p>
              </div>

              <div className="bg-white/5 p-8 rounded-lg backdrop-blur-sm">
                <h3 className="text-2xl font-bold mb-4">No Gas Fees</h3>
                <p className="text-black/90">
                  We eliminate barriers to giving by covering all gas fees, so 100% of your donation goes to the cause.
                </p>
              </div>
            </div>
          </div> */}
        </section>
      </div>
    </MainLayout>
  );
}