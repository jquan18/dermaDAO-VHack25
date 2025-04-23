import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Identity Verification | DermaDAO",
  description: "Verify your identity with Onfido to continue using DermaDAO",
};

export default function VerificationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
} 