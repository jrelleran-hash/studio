
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ReactNode, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { StartupAnimation } from "./startup-animation";

const unprotectedRoutes = ["/login", "/signup", "/verify-email"];

export function AppContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isUnprotected = unprotectedRoutes.includes(pathname);

  useEffect(() => {
    if (!loading && user && isUnprotected) {
      router.push('/');
    }
  }, [loading, user, isUnprotected, router, pathname]);
  

  if (loading && !isUnprotected) {
    return <StartupAnimation />;
  }
  
  if (isUnprotected) {
    return <>{children}</>;
  }
  
  if (!user && !isUnprotected) {
      // This can happen briefly on page load, so a loading state is good.
      // If a user is truly unauthenticated, the auth context will eventually redirect them.
      return <StartupAnimation />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar 
        className="hidden md:flex fixed h-full z-50"
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      <div className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          isCollapsed ? "md:pl-16" : "md:pl-64"
        )} 
        id="main-content"
      >
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
