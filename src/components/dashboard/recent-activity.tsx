
"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ShoppingCart, UserPlus, Package, Truck, RefreshCcw, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNotifications } from "@/services/data-service";
import type { Notification, PagePermission } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

type NotificationWithTime = Notification & { time: string };

const iconMap = {
  ShoppingCart: <ShoppingCart className="size-4 text-primary" />,
  UserPlus: <UserPlus className="size-4 text-primary" />,
  Package: <Package className="size-4 text-primary" />,
  Truck: <Truck className="size-4 text-primary" />,
  RefreshCcw: <RefreshCcw className="size-4 text-primary" />,
  ClipboardCheck: <ClipboardCheck className="size-4 text-primary" />,
};


const navItemsPermissions: { href: PagePermission; label: string }[] = [
    { href: "/", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/logistics", label: "Logistics" },
    { href: "/analytics", label: "Analytics" },
    { href: "/orders", label: "Orders" },
    { href: "/purchase-orders", label: "Purchase Orders" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/inventory", label: "Products" },
    { href: "/issuance", label: "Issuance" },
    { href: "/tools", label: "Tool Management" },
    { href: "/warehouse", label: "Warehouse Map" },
    { href: "/returns", label: "Returns" },
    { href: "/quality-control", label: "Quality Control" },
    { href: "/settings", label: "Settings" }
];


export function RecentActivity() {
  const [activities, setActivities] = useState<NotificationWithTime[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  
  const userPermissions = React.useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role === 'Admin' || userProfile.role === 'Manager') {
        return navItemsPermissions.map(i => i.href);
    }
    return userProfile.permissions || [];
  }, [userProfile]);

  useEffect(() => {
    async function fetchActivities() {
      if (!userProfile) return; 
      
      setLoading(true);
      const fetchedNotifications = await getNotifications();
      
      const filteredNotifications = fetchedNotifications
        .filter(notification => notification.href && userPermissions.includes(notification.href as PagePermission))
        .slice(0, 5); // Take the 5 most recent, relevant notifications

      setActivities(filteredNotifications);
      setLoading(false);
    }
    fetchActivities();
  }, [userProfile, userPermissions]);

  return (
    <Card className="card-gradient h-full">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          A log of the latest events relevant to your role.
        </CardDescription>
      </CardHeader>
      <CardContent>
          <div className="grid gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="grid gap-1 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              ))
            ) : activities.length > 0 ? (
              activities.map((activity) => (
                <Link href={activity.href || "#"} key={activity.id} className="block group">
                  <div className="flex items-center gap-4 cursor-pointer p-2 -m-2 rounded-lg hover:bg-muted/50">
                    <div className="p-2 bg-muted/50 rounded-full group-hover:bg-primary/20 transition-colors">
                      {activity.icon && iconMap[activity.icon]}
                    </div>
                    <div className="grid gap-1 flex-1">
                      <p className="text-sm font-medium leading-none">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.time}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))
            ) : (
                 <div className="text-sm text-muted-foreground text-center py-10">
                    No recent activity to display.
                </div>
            )}
          </div>
      </CardContent>
    </Card>
  );
}
