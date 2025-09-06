
"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const unprotectedRoutes = ["/login", "/signup"];

export function AppContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const isUnprotected = unprotectedRoutes.includes(pathname);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    );
  }

  if (isUnprotected) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar className="hidden lg:flex" />
      <div className="flex flex-1 flex-col lg:pl-64">
        <Header />
        <main className="flex-1 p-4 sm:p-6">
            <div className="w-full max-w-7xl mx-auto">
             {children}
            </div>
        </main>
      </div>
    </div>
  );
}
