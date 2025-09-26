
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { CoreFlowLogo } from "@/components/icons";
import { cn } from "@/lib/utils";
import { SheetClose } from "@/components/ui/sheet";
import { type LucideIcon } from "lucide-react";

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


export function Sidebar({ className, inSheet }: { className?: string, inSheet?: boolean }) {
  const pathname = usePathname();

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
            {navItems.map((item) => (
              <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} />
            ))}
            <div className="my-2">
                <span className="px-3 text-xs font-semibold uppercase text-muted-foreground/70">Procurement</span>
            </div>
            {procurementNavItems.map((item) => (
                <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} />
            ))}
            <div className="my-2">
                <span className="px-3 text-xs font-semibold uppercase text-muted-foreground/70">Inventory</span>
            </div>
            {inventoryNavItems.map((item) => (
               <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} />
            ))}
            <div className="my-2">
                <span className="px-3 text-xs font-semibold uppercase text-muted-foreground/70">Assurance</span>
            </div>
            {assuranceNavItems.map((item) => (
                <SidebarLink key={item.href} {...item} pathname={pathname} inSheet={inSheet} />
            ))}
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
