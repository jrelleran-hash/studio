
"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserNav } from "@/components/user-nav";
import { NotificationsMenu } from "@/components/notifications-menu";
import { Sidebar } from "./sidebar";
import { CoreFlowLogo } from "../icons";
import { GlobalSearch } from "./global-search";

export function Header() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 sticky top-0 z-40">
      <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-64" showCloseButton={false}>
              <Sidebar className="flex" inSheet />
            </SheetContent>
          </Sheet>
      </div>
      
      <div className="w-full flex-1">
        <div className="hidden md:block">
            <GlobalSearch />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isClient && (
          <>
            <NotificationsMenu />
            <UserNav />
          </>
        )}
      </div>
    </header>
  );
}
