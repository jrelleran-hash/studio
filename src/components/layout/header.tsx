
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
import { Input } from "../ui/input";

export function Header() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 sticky top-0 z-40">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col p-0 w-64" showCloseButton={false}>
          <SheetHeader className="p-4 border-b">
            <SheetTitle>
              <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
                <CoreFlowLogo className="h-6 w-6 text-primary" />
                <span>CoreFlow</span>
              </Link>
            </SheetTitle>
            <SheetDescription>
              Navigate through your business management platform.
            </SheetDescription>
          </SheetHeader>
          <Sidebar className="flex" inSheet />
        </SheetContent>
      </Sheet>
      
      <div className="w-full flex-1">
         <form>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
            />
          </div>
        </form>
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
