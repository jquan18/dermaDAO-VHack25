"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ArrowRight, Heart, Shield, TrendingUp, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { projectsApi } from "@/lib/api";
import { formatCurrency, calculateProgress, calculateDaysLeft } from "@/lib/utils";

// Types
interface Project {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  targetAmount: number;
  currentAmount: number;
  endDate: string;
  category: string;
}

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function HomePage() {
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [heroRef, heroInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [statsRef, statsInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [featuredRef, featuredInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [howItWorksRef, howItWorksInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        // In a real implementation, we would fetch from the API
        // const response = await projectsApi.getAllProjects(1, 3);
        // setFeaturedProjects(response.data.projects);
        
        // For demo, use mock data
        setFeaturedProjects([
          {
            id: '1',
            name: 'Clean Water Initiative',
            description: 'Providing clean drinking water to rural communities facing water scarcity.',
            imageUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80&w=1000',
            targetAmount: 50000,
            currentAmount: 32500,
            endDate: '2023-12-31',
            category: 'Water & Sanitation',
          },
          {
            id: '2',
            name: 'Medical Relief Fund',
            description: 'Supplying essential medical equipment to underfunded hospitals in developing regions.',
            imageUrl: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&q=80&w=1000',
            targetAmount: 75000,
            currentAmount: 28000,
            endDate: '2023-11-15',
            category: 'Healthcare',
          },
          {
            id: '3',
            name: 'Education For All',
            description: 'Building schools and providing educational resources for children in need.',
            imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000',
            targetAmount: 60000,
            currentAmount: 45000,
            endDate: '2024-01-20',
            category: 'Education',
          },
        ]);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProjects();
  }, []);
  
  return (
    <MainLayout>
      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        className="bg-gradient-to-r from-primary/10 to-primary/5 py-20 px-4 sm:px-6 lg:px-8"
        initial="hidden"
        animate={heroInView ? "visible" : "hidden"}
        variants={fadeIn}
      >
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="lg:w-1/2 space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900">
              Transparent Charity Funding on <span className="text-primary">Blockchain</span>
            </h1>
            <p className="text-lg text-gray-700">
              DermaDAO is a decentralized platform that brings transparency and
              accountability to charity donations through blockchain technology.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/projects">
                <Button size="lg" className="px-8">
                  Browse Projects
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button size="lg" variant="outline" className="px-8">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
          <div className="lg:w-1/2 relative">
            <div className="relative h-[400px] w-full rounded-lg overflow-hidden shadow-xl">
              <Image
                src="https://images.unsplash.com/photo-1560821829-18a5fbb8b4ce?q=80&w=2012&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="People helping others"
                fill
                style={{ objectFit: 'cover' }}
              />
              <div className="absolute inset-0 bg-black/20 mix-blend-multiply"></div>
            </div>
          </div>
        </div>
      </motion.section>
      
      {/* Stats */}
      <motion.section
        ref={statsRef}
        className="py-16 px-4 sm:px-6 lg:px-8 bg-white"
        initial="hidden"
        animate={statsInView ? "visible" : "hidden"}
        variants={fadeIn}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center p-6 bg-primary/5 rounded-lg">
              <div className="bg-primary/10 p-3 rounded-full mb-4">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900">$2.5M+</h3>
              <p className="text-gray-600 text-center">Donated to verified charities</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-primary/5 rounded-lg">
              <div className="bg-primary/10 p-3 rounded-full mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900">100%</h3>
              <p className="text-gray-600 text-center">Transparent fund distribution</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-primary/5 rounded-lg">
              <div className="bg-primary/10 p-3 rounded-full mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900">50+</h3>
              <p className="text-gray-600 text-center">Successfully funded projects</p>
            </div>
          </div>
        </div>
      </motion.section>
      
      {/* Featured Projects */}
      <motion.section
        ref={featuredRef}
        className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50"
        initial="hidden"
        animate={featuredInView ? "visible" : "hidden"}
        variants={fadeIn}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Featured Projects</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
              Discover impactful initiatives that are making a difference in communities around the world.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <Card key={i} className="overflow-hidden h-[400px] animate-pulse">
                  <div className="h-48 bg-gray-200"></div>
                  <CardContent className="p-5">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
                    <div className="h-2 bg-gray-200 rounded mb-4"></div>
                    <div className="flex justify-between items-center mt-4">
                      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              featuredProjects.map((project) => (
                <Card key={project.id} className="overflow-hidden h-full flex flex-col">
                  <div className="relative h-48 w-full">
                    <Image
                      src={project.imageUrl}
                      alt={project.name}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                    <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded text-xs font-semibold">
                      {project.category}
                    </div>
                  </div>
                  <CardContent className="p-5 flex-grow flex flex-col">
                    <h3 className="text-xl font-bold mb-2 line-clamp-1">{project.name}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{project.description}</p>
                    
                    <div className="mt-auto space-y-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${calculateProgress(project.currentAmount, project.targetAmount)}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-semibold">{formatCurrency(project.currentAmount)}</span>
                          <span className="text-gray-500"> of {formatCurrency(project.targetAmount)}</span>
                        </div>
                        <div className="text-gray-600">
                          {calculateDaysLeft(project.endDate)} days left
                        </div>
                      </div>
                      
                      <Link href={`/projects/${project.id}`}>
                        <Button className="w-full">Donate Now</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          
          <div className="mt-12 text-center">
            <Link href="/projects">
              <Button variant="outline" size="lg" className="group">
                View All Projects
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>
      
      {/* How It Works */}
      <motion.section
        ref={howItWorksRef}
        className="py-16 px-4 sm:px-6 lg:px-8 bg-white"
        initial="hidden"
        animate={howItWorksInView ? "visible" : "hidden"}
        variants={fadeIn}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
              DermaDAO leverages blockchain technology to ensure every donation is tracked and utilized properly.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6">
              <div className="relative mb-6">
                <div className="bg-primary/10 rounded-full p-4">
                  <div className="bg-primary/20 rounded-full p-3">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  1
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Verified Charities</h3>
              <p className="text-gray-600">
                Every charity on our platform is verified through Worldcoin to ensure legitimacy and accountability.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6">
              <div className="relative mb-6">
                <div className="bg-primary/10 rounded-full p-4">
                  <div className="bg-primary/20 rounded-full p-3">
                    <Heart className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  2
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Transparent Donations</h3>
              <p className="text-gray-600">
                All donations are recorded on the blockchain, providing complete transparency of funds.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6">
              <div className="relative mb-6">
                <div className="bg-primary/10 rounded-full p-4">
                  <div className="bg-primary/20 rounded-full p-3">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  3
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Verified Withdrawals</h3>
              <p className="text-gray-600">
                Withdrawals are verified by AI and blockchain before funds are transferred to charities.
              </p>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <Link href="/how-it-works">
              <Button variant="outline">Learn More About Our Process</Button>
            </Link>
          </div>
        </div>
      </motion.section>
      
      {/* CTA Section */}
      <section className="bg-primary py-16 px-4 sm:px-6 lg:px-8 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Make a Difference?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join DermaDAO today and be part of the transparent charity revolution.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/projects">
              <Button size="lg" variant="secondary" className="px-8">
                Browse Projects
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button size="lg" className="bg-white text-primary hover:bg-gray-100 px-8">
                Sign Up Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
} 