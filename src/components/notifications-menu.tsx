
"use client";

import { useState, useEffect } from "react";
import { Bell, Check, ShoppingCart, UserPlus, Package, Truck, RefreshCcw, ClipboardCheck } from "lucide-react";
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
import { getNotifications, markAllNotificationsAsRead } from "@/services/data-service";
import type { Notification } from "@/types";
import { Skeleton } from "./ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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
  const router = useRouter();
  const { toast } = useToast();

  const fetchNotifications = async () => {
    setLoading(true);
    const fetchedNotifications = await getNotifications();
    setNotifications(fetchedNotifications);
    setLoading(false);
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleViewClick = () => {
    if (selectedNotification) {
      router.push(selectedNotification.href);
      setSelectedNotification(null);
    }
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

  return (
    <>
      <Popover>
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
            <CardContent className="p-0">
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
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-center space-x-4 rounded-md p-3 transition-all hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      onClick={() => setSelectedNotification(notification)}
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
                       {!notification.read && <div className="size-2 rounded-full bg-primary" />}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            <CardFooter className="p-2 border-t">
              <Button size="sm" className="w-full" disabled={loading || unreadCount === 0} onClick={handleMarkAllAsRead}>
                <Check className="mr-2 h-4 w-4" />
                Mark all as read
              </Button>
            </CardFooter>
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
                <Button onClick={handleViewClick}>View</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
