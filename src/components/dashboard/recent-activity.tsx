
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowUpRight, ShoppingCart, UserPlus, Package, Trash2, CheckSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead, deleteNotification, deleteNotifications } from "@/services/data-service";
import type { Notification, PagePermission } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { navItemsPermissions } from "@/components/layout/sidebar";

type NotificationWithTime = Notification & { time: string };

const iconMap = {
  ShoppingCart: <ShoppingCart className="size-4 text-primary" />,
  UserPlus: <UserPlus className="size-4 text-primary" />,
  Package: <Package className="size-4 text-primary" />,
};

export function RecentActivity() {
  const [activities, setActivities] = useState<NotificationWithTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<NotificationWithTime | null>(null);
  const { userProfile } = useAuth();
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const userPermissions = React.useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role === 'Admin' || userProfile.role === 'Manager') {
        return navItemsPermissions.map(i => i.href);
    }
    return userProfile.permissions || [];
  }, [userProfile]);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    const fetchedActivities = await getNotifications();
    const filteredActivities = fetchedActivities.filter(activity => userPermissions.includes(activity.href as PagePermission));
    setActivities(filteredActivities);
    setLoading(false);
  }, [userPermissions]);

  useEffect(() => {
    if(userPermissions.length > 0) {
        fetchActivities();
    }
  }, [userPermissions, fetchActivities]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedToDelete(new Set(activities.map(a => a.id)));
    } else {
      setSelectedToDelete(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedToDelete);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedToDelete(newSelection);
  };
  
  const handleDeleteSelected = async () => {
    try {
        await deleteNotifications(Array.from(selectedToDelete));
        toast({ title: "Success", description: "Selected activities have been deleted." });
        await fetchActivities();
        setSelectedToDelete(new Set());
    } catch(error) {
         toast({ variant: "destructive", title: "Error", description: "Failed to delete activities." });
    } finally {
        setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Card className="card-gradient h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
              <Checkbox 
                id="select-all-activities" 
                checked={selectedToDelete.size > 0 && selectedToDelete.size === activities.length}
                onCheckedChange={handleSelectAll}
                disabled={loading || activities.length === 0}
                aria-label="Select all activities"
              />
            <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                An overview of the latest events in your store.
                </CardDescription>
            </div>
          </div>
          {selectedToDelete.size > 0 ? (
             <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                Delete Selected ({selectedToDelete.size})
             </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="ml-auto gap-1">
                <Link href="/analytics">
                View All
                </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
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
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 group"
                >
                  <Checkbox 
                    checked={selectedToDelete.has(activity.id)} 
                    onCheckedChange={(checked) => handleSelectOne(activity.id, !!checked)}
                  />
                  <div 
                    className="flex-1 flex items-center gap-4 cursor-pointer"
                    onClick={() => setSelectedNotification(activity)}
                  >
                      <div className="p-2 bg-muted/50 rounded-full group-hover:bg-primary/20 transition-colors">
                        {iconMap[activity.icon as keyof typeof iconMap] || <Package className="size-4 text-primary" />}
                      </div>
                      <div className="grid gap-1 flex-1">
                        <p className="text-sm font-medium leading-none">{activity.title}</p>
                        <p className="text-sm text-muted-foreground">{activity.time}</p>
                      </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      
      {selectedNotification && (
        <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedNotification.title}</DialogTitle>
              <DialogDescription>{selectedNotification.time}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p>{selectedNotification.details}</p>
            </div>
            <DialogFooter>
                 <Button variant="secondary" onClick={() => setSelectedNotification(null)}>Close</Button>
                {selectedNotification.href && (
                    <Button asChild>
                        <Link href={selectedNotification.href}>View</Link>
                    </Button>
                )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the selected activities.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSelected} className={buttonVariants({ variant: "destructive" })}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
