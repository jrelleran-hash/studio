

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart,
  Home,
  Package,
  ShoppingCart,
  Users,
  Settings,
  FileText,
  Truck,
  RefreshCcw,
  ClipboardCheck,
  Building,
  Receipt,
  ChevronDown,
} from "lucide-react";
import { CoreFlowLogo } from "@/components/icons";
import { cn } from "@/lib/utils";
import { SheetClose } from "@/components/ui/sheet";
import { type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "../ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { Department, UserRole } from "@/types";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home, department: "All" },
  { href: "/clients", label: "Clients", icon: Users, department: "Clients" },
  { href: "/logistics", label: "Logistics", icon: Truck, department: "Logistics" },
  { href: "/analytics", label: "Analytics", icon: BarChart, department: "Analytics" },
];

const procurementNavItems = [
    { href: "/orders", label: "Orders", icon: ShoppingCart },
    { href: "/purchase-orders", label: "Purchase Orders", icon: Receipt },
    { href: "/suppliers", label: "Suppliers", icon: Building },
];

const inventoryNavItems = [
    { href: "/inventory", label: "Products", icon: Package },
    { href: "/issuance", label: "Issuance", icon: FileText },
];

const assuranceNavItems = [
    { href: "/returns", label: "Returns", icon: RefreshCcw },
    { href: "/quality-control", label: "Quality Control", icon: ClipboardCheck },
];


interface SidebarLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
  inSheet?: boolean;
}

function SidebarLink({ href, label, icon: Icon, pathname, inSheet }: SidebarLinkProps) {
  const linkContent = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all group hover:text-primary hover:bg-muted-foreground/10",
        pathname === href && "bg-muted-foreground/10 text-primary"
      )}
    >
      <Icon className="h-4 w-4 group-hover:animate-wiggle" />
      {label}
    </Link>
  );

  if (inSheet) {
    return <SheetClose asChild>{linkContent}</SheetClose>;
  }
  
  return linkContent;
}

interface NavSectionProps {
    title: string;
    items: Omit<typeof navItems, 'department'>;
    pathname: string;
    inSheet?: boolean;
}

function NavSection({ title, items, pathname, inSheet }: NavSectionProps) {
    const [isOpen, setIsOpen] = useState(true);
    
    const isActiveSection = items.some(item => pathname.startsWith(item.href) && item.href !== '/');
    
    useState(() => {
        setIsOpen(isActiveSection);
    });

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-3 h-auto py-2 mb-1 mt-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground/70">{title}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground/70 transition-transform", isOpen && "rotate-180")} />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                 <div className="grid items-start text-sm font-medium">
                    {items.map((item) => (
                        <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} />
                    ))}
                 </div>
            </CollapsibleContent>
        </Collapsible>
    )
}


export function Sidebar({ className, inSheet }: { className?: string, inSheet?: boolean }) {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  
  const canAccess = (department: Department) => {
    if (!userProfile) return false;
    const { role, departments } = userProfile;
    if (role === "Admin" || role === "Manager" || departments.includes("All")) {
      return true;
    }
    return departments.includes(department);
  }

  return (
    <aside className={cn("flex-col border-r bg-card", className)}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="hidden lg:flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
            <CoreFlowLogo className="h-6 w-6 text-primary" />
            <span>CoreFlow</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-4 text-sm font-medium">
            {navItems.filter(item => canAccess(item.department as Department)).map((item) => (
              <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} />
            ))}
            
            {canAccess("Procurement") && <NavSection title="Procurement" items={procurementNavItems} pathname={pathname} inSheet={inSheet} />}
            {canAccess("Inventory") && <NavSection title="Inventory" items={inventoryNavItems} pathname={pathname} inSheet={inSheet} />}
            {canAccess("Assurance") && <NavSection title="Assurance" items={assuranceNavItems} pathname={pathname} inSheet={inSheet} />}
            
          </nav>
        </div>
        <div className="mt-auto p-4">
            <SidebarLink 
              href="/settings"
              label="Settings"
              icon={Settings}
              pathname={pathname}
              inSheet={inSheet}
            />
        </div>
      </div>
    </aside>
  );
}
