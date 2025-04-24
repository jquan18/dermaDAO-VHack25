"use client";

import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

type MainLayoutProps = {
  children: ReactNode;
  fullWidthHero?: boolean; // Add prop to determine if hero should extend behind navbar
};

export function MainLayout({ children, fullWidthHero = false }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen relative">
      {fullWidthHero && (
        <div className="fixed inset-0 z-0 backdrop-blur-md bg-white/30">
          {/* This will hold the background element passed as the first child */}
          {Array.isArray(children) ? children[0] : null}
        </div>
      )}
      <Navbar />
      <main className="flex-grow relative z-10">
        {fullWidthHero ? (
          // If fullWidthHero is true, we've already rendered the first child as a background
          // so we only render the remaining children here
          Array.isArray(children) ? children.slice(1) : children
        ) : (
          // If fullWidthHero is false, render all children normally
          children
        )}
      </main>
    </div>
  );
}