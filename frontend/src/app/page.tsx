"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/main-layout";

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function HomePage() {
  return (
    <MainLayout fullWidthHero={true}>
      {/* Hero background - this will be positioned behind the navbar */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 w-full h-full">
        {/* Background gradient elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>
      
      {/* Hero Section content */}
      <motion.section
        className="min-h-screen flex items-center justify-center px-4 py-20 overflow-hidden relative"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <div className="max-w-5xl mx-auto text-center z-10">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            The first modular<br />charity funding platform
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-3xl mx-auto">
            DermaDAO is a decentralized platform that brings transparency and
            accountability to charity donations through blockchain technology.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/projects">
              <Button size="lg" className="bg-black hover:bg-black/80 text-white px-8 py-6 text-lg rounded-md">
                Browse Projects
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button size="lg" variant="outline" className="bg-white hover:bg-white/90 text-black border-white px-8 py-6 text-lg rounded-md">
                Explore
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section className="py-20 bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Revolutionizing Charity Transparency</h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              Every donation on DermaDAO is tracked on the blockchain, ensuring complete transparency and accountability.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="bg-white/5 p-8 rounded-lg backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-4">Verified Charities</h3>
              <p className="text-gray-300">
                Every charity on our platform is verified through a rigorous process to ensure legitimacy and accountability.
              </p>
            </div>
            
            <div className="bg-white/5 p-8 rounded-lg backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-4">Quadratic Funding</h3>
              <p className="text-gray-300">
                Our innovative funding model amplifies the impact of your donations through matched contributions.
              </p>
            </div>
            
            <div className="bg-white/5 p-8 rounded-lg backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-4">No Gas Fees</h3>
              <p className="text-gray-300">
                We eliminate barriers to giving by covering all gas fees, so 100% of your donation goes to the cause.
              </p>
            </div>
          </div>
        </div>
      </section>
      
    </MainLayout>
  );
}