
"use client";

import { useState, useEffect } from "react";
import { Bell, Check, ShoppingCart, UserPlus, Package, Truck, RefreshCcw, ClipboardCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead, deleteNotification } from "@/services/data-service";
import type { Notification } from "@/types";
import { Skeleton } from "./ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { buttonVariants } from "./ui/button";

type NotificationWithTime = Notification & { time: string };

const iconMap = {
  ShoppingCart: <ShoppingCart className="size-4 text-primary" />,
  UserPlus: <UserPlus className="size-4 text-primary" />,
  Package: <Package className="size-4 text-primary" />,
  Truck: <Truck className="size-4 text-primary" />,
  RefreshCcw: <RefreshCcw className="size-4 text-primary" />,
  ClipboardCheck: <ClipboardCheck className="size-4 text-primary" />,
};


export function NotificationsMenu() {
  const [notifications, setNotifications] = useState<NotificationWithTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<NotificationWithTime | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const fetchNotifications = async () => {
    setLoading(true);
    const fetchedNotifications = await getNotifications();
    // Filter to only show unread notifications
    setNotifications(fetchedNotifications.filter(n => !n.read));
    setLoading(false);
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = notifications.length;

  const handleNotificationClick = async (notification: NotificationWithTime) => {
    setSelectedNotification(notification);
    try {
        // Mark as read and refetch immediately to update the list
        await markNotificationAsRead(notification.id);
        fetchNotifications();
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to mark notification as read." });
    }
  }

  const handleViewClick = () => {
    if (selectedNotification?.href) {
      router.push(selectedNotification.href);
    }
    setSelectedNotification(null);
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      await fetchNotifications(); // Refetch to update the UI
      toast({ title: "Success", description: "All notifications marked as read." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to mark notifications as read." });
    }
  };
  
  const handleDeleteClick = (notificationId: string) => {
    setDeletingNotificationId(notificationId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingNotificationId) return;
    try {
        await deleteNotification(deletingNotificationId);
        toast({ title: "Success", description: "Notification deleted." });
        fetchNotifications(); // Refresh list
    } catch(error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete notification." });
    } finally {
        setIsDeleteDialogOpen(false);
        setDeletingNotificationId(null);
    }
  };

  return (
    <>
      <Popover onOpenChange={(open) => { if (open) fetchNotifications() }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            {unreadCount > 0 && <div className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
            <Bell className="h-5 w-5" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80" align="end">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `You have ${unreadCount} unread messages.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-80 overflow-y-auto">
              <div className="flex flex-col">
                {loading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-center space-x-4 p-3">
                       <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/4" />
                      </div>
                    </div>
                  ))
                ) : notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-center space-x-4 rounded-md p-3 transition-all hover:bg-accent hover:text-accent-foreground group"
                    >
                      <div
                        className="flex-1 flex items-center space-x-4 cursor-pointer"
                        onClick={() => handleNotificationClick(notification)}
                      >
                          {notification.icon && (
                            <div className="p-2 bg-muted/50 rounded-full">
                                {iconMap[notification.icon]}
                            </div>
                          )}
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {notification.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {notification.time}
                            </p>
                          </div>
                      </div>
                       {userProfile?.role === "Admin" && (
                         <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(notification.id);
                            }}
                         >
                            <Trash2 className="h-4 w-4 text-destructive"/>
                            <span className="sr-only">Delete</span>
                         </Button>
                       )}
                    </div>
                  ))
                ) : (
                    <div className="text-sm text-muted-foreground text-center py-10">
                        You're all caught up!
                    </div>
                )}
              </div>
            </CardContent>
            {unreadCount > 0 && (
                <CardFooter className="p-2 border-t">
                <Button size="sm" className="w-full" disabled={loading} onClick={handleMarkAllAsRead}>
                    <Check className="mr-2 h-4 w-4" />
                    Mark all as read
                </Button>
                </CardFooter>
            )}
          </Card>
        </PopoverContent>
      </Popover>

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
                {selectedNotification.href && <Button onClick={handleViewClick}>View</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this notification.
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
