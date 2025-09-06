import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SmartSearch } from "@/components/smart-search";
import { UserNav } from "@/components/user-nav";
import { NotificationsMenu } from "@/components/notifications-menu";
import { Sidebar } from "./sidebar";
import { CoreFlowLogo } from "../icons";

export function Header() {
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 sticky top-0 z-40">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col p-0 w-64">
          <Sidebar className="flex" />
        </SheetContent>
      </Sheet>
      
      <div className="w-full flex-1">
        <SmartSearch />
      </div>

      <div className="flex items-center gap-4">
        <NotificationsMenu />
        <UserNav />
      </div>
    </header>
  );
}
