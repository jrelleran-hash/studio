
"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StartupAnimation } from "./startup-animation";

const unprotectedRoutes = ["/login", "/signup", "/verify-email"];

export function AppContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const isUnprotected = unprotectedRoutes.includes(pathname);

  if (loading && !isUnprotected) {
    return <StartupAnimation />;
  }

  if (isUnprotected) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar className="hidden lg:flex fixed h-full z-50" />
      <div className="flex flex-1 flex-col transition-all duration-300 lg:pl-64" id="main-content">
        <Header />
        <main className="flex-1 p-4 sm:p-6">
            <div className="w-full max-w-7xl mx-auto">
             {children}
            </div>
        </main>
      </div>
       <style jsx>{`
        #main-content.collapsed {
            padding-left: 64px;
        }
       `}</style>
    </div>
  );
}
