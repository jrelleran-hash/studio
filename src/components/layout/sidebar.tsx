
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
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
  Map,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CoreFlowLogo } from "@/components/icons";
import { cn } from "@/lib/utils";
import { SheetClose } from "@/components/ui/sheet";
import { type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "../ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { PagePermission } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/logistics", label: "Logistics", icon: Truck },
  { href: "/analytics", label: "Analytics", icon: BarChart },
];

const procurementNavItems = [
    { href: "/orders", label: "Orders", icon: ShoppingCart },
    { href: "/purchase-orders", label: "Purchase Orders", icon: Receipt },
    { href: "/suppliers", label: "Suppliers", icon: Building },
];

const inventoryNavItems = [
    { href: "/inventory", label: "Products", icon: Package },
    { href: "/issuance", label: "Issuance", icon: FileText },
    { href: "/warehouse", label: "Warehouse Map", icon: Map },
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
  isCollapsed: boolean;
}

function SidebarLink({ href, label, icon: Icon, pathname, inSheet, isCollapsed }: SidebarLinkProps) {
  const linkContent = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all group hover:text-primary hover:bg-muted-foreground/10",
        pathname === href && "bg-muted-foreground/10 text-primary",
        isCollapsed && "justify-center"
      )}
    >
      <Icon className="h-4 w-4 group-hover:animate-wiggle" />
      <span className={cn("truncate", isCollapsed && "hidden")}>{label}</span>
    </Link>
  );

  const wrappedContent = isCollapsed ? (
     <TooltipProvider delayDuration={0}>
        <Tooltip>
            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
            <TooltipContent side="right">
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
     </TooltipProvider>
  ) : linkContent;


  if (inSheet) {
    return <SheetClose asChild>{wrappedContent}</SheetClose>;
  }
  
  return wrappedContent;
}

interface NavSectionProps {
    title: string;
    items: { href: PagePermission; label: string; icon: LucideIcon }[];
    pathname: string;
    inSheet?: boolean;
    userPermissions: PagePermission[];
    isCollapsed: boolean;
}

function NavSection({ title, items, pathname, inSheet, userPermissions, isCollapsed }: NavSectionProps) {
    const [isOpen, setIsOpen] = useState(true);
    
    const visibleItems = items.filter(item => userPermissions.includes(item.href));

    if (visibleItems.length === 0) return null;
    
    const isActiveSection = visibleItems.some(item => pathname.startsWith(item.href) && item.href !== '/');
    
    useState(() => {
        setIsOpen(isActiveSection);
    });
    
    if (isCollapsed) {
        return (
            <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                {visibleItems.map((item) => (
                    <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} isCollapsed={isCollapsed} />
                ))}
            </div>
        )
    }

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
                    {visibleItems.map((item) => (
                        <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} isCollapsed={isCollapsed}/>
                    ))}
                 </div>
            </CollapsibleContent>
        </Collapsible>
    )
}


interface SidebarProps {
  className?: string;
  inSheet?: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

export function Sidebar({ className, inSheet, isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  
  const userPermissions = useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role === 'Admin' || userProfile.role === 'Manager') {
        // Admins and Managers get all permissions
        return [
            ...navItems.map(i => i.href),
            ...procurementNavItems.map(i => i.href),
            ...inventoryNavItems.map(i => i.href),
            ...assuranceNavItems.map(i => i.href),
            "/settings"
        ] as PagePermission[];
    }
    return userProfile.permissions || [];
  }, [userProfile]);

  const canAccess = (path: PagePermission) => userPermissions.includes(path);


  return (
    <aside className={cn(
        "flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
    )}>
      <div className="flex h-full max-h-screen flex-col gap-2 relative">
        <div className={cn("flex h-16 items-center border-b px-6", inSheet ? "flex" : "lg:flex", isCollapsed && "justify-center px-2")}>
          <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
            <CoreFlowLogo className="h-6 w-6 text-primary" />
            <span className={cn(isCollapsed && "hidden")}>CoreFlow</span>
          </Link>
        </div>

        {!inSheet && (
             <Button 
                variant="ghost" 
                size="icon" 
                className="absolute -right-4 top-16 h-8 w-8 rounded-full border bg-card hover:bg-card z-10 hidden lg:flex"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
        )}

        <div className="flex-1 overflow-auto py-2">
          <nav className={cn("grid items-start text-sm font-medium", isCollapsed ? "px-2" : "px-4")}>
            {navItems.filter(item => canAccess(item.href as PagePermission)).map((item) => (
              <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} isCollapsed={isCollapsed}/>
            ))}
            
            <NavSection title="Procurement" items={procurementNavItems as any} pathname={pathname} inSheet={inSheet} userPermissions={userPermissions} isCollapsed={isCollapsed} />
            <NavSection title="Inventory" items={inventoryNavItems as any} pathname={pathname} inSheet={inSheet} userPermissions={userPermissions} isCollapsed={isCollapsed} />
            <NavSection title="Assurance" items={assuranceNavItems as any} pathname={pathname} inSheet={inSheet} userPermissions={userPermissions} isCollapsed={isCollapsed} />
            
          </nav>
        </div>
        <div className={cn("mt-auto", isCollapsed ? "px-2" : "p-4")}>
             {canAccess("/settings" as PagePermission) && (
                <SidebarLink 
                  href="/settings"
                  label="Settings"
                  icon={Settings}
                  pathname={pathname}
                  inSheet={inSheet}
                  isCollapsed={isCollapsed}
                />
            )}
        </div>
      </div>
    </aside>
  );
}
