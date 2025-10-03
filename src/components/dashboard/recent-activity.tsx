
"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowUpRight, ShoppingCart, UserPlus, Package, Truck, RefreshCcw, ClipboardCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNotifications, deleteNotification, deleteNotifications } from "@/services/data-service";
import type { Notification, PagePermission } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "../ui/checkbox";


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
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingNotificationIds, setDeletingNotificationIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const isAdmin = userProfile?.role === "Admin";
  
  const userPermissions = useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role === 'Admin' || userProfile.role === 'Manager') {
        return navItemsPermissions.map(i => i.href);
    }
    return userProfile.permissions || [];
  }, [userProfile]);
  
  const fetchActivities = async () => {
    if (!userProfile) return; 
    setLoading(true);
    const fetchedNotifications = await getNotifications();
    const filteredNotifications = fetchedNotifications
      .filter(notification => notification.href && userPermissions.includes(notification.href as PagePermission))
      .slice(0, 5);
    setActivities(filteredNotifications);
    setLoading(false);
  }

  useEffect(() => {
    fetchActivities();
  }, [userProfile, userPermissions]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(activities.map(a => a.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteClick = (notificationId: string) => {
    setDeletingNotificationIds([notificationId]);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteSelectedClick = () => {
    if (selected.length === 0) return;
    setDeletingNotificationIds(selected);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletingNotificationIds.length === 0) return;
    try {
        await deleteNotifications(deletingNotificationIds);
        toast({ title: "Success", description: "Selected activities deleted." });
        await fetchActivities();
        setSelected([]);
    } catch(error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete activities." });
    } finally {
        setIsDeleteDialogOpen(false);
        setDeletingNotificationIds([]);
    }
  };

  return (
    <>
      <Card className="card-gradient h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              A log of the latest events relevant to your role.
            </CardDescription>
          </div>
          {isAdmin && selected.length > 0 && (
             <Button variant="destructive" size="sm" onClick={handleDeleteSelectedClick}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selected.length})
            </Button>
          )}
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
                <>
                {isAdmin && (
                  <div className="flex items-center gap-3 px-2 py-1 border-b">
                    <Checkbox
                      id="select-all"
                      checked={selected.length === activities.length && activities.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      aria-label="Select all"
                    />
                    <label htmlFor="select-all" className="text-sm font-medium text-muted-foreground">Select All</label>
                  </div>
                )}
                {activities.map((activity) => (
                  <div key={activity.id} className="group flex items-center gap-4 p-2 -m-2 rounded-lg hover:bg-muted/50">
                    {isAdmin && (
                      <Checkbox
                        checked={selected.includes(activity.id)}
                        onCheckedChange={() => handleSelect(activity.id)}
                        aria-label={`Select activity: ${activity.title}`}
                      />
                    )}
                    <Link href={activity.href || "#"} className="flex-1">
                      <div className="flex items-center gap-4 cursor-pointer">
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
                     {isAdmin && !selected.length && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(activity.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                  </div>
                ))}
                </>
              ) : (
                  <div className="text-sm text-muted-foreground text-center py-10">
                      No recent activity to display.
                  </div>
              )}
            </div>
        </CardContent>
      </Card>
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {deletingNotificationIds.length} activity log item(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
