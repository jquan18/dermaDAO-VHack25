import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Details | DermaDAO",
  description: "View details of a charitable project on DermaDAO",
};

export default function ProjectDetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {children}
    </div>
  );
} 