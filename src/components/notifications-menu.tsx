"use client";

import { useState, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
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

const notifications = [
  {
    title: "New order #1245 received.",
    description: "1 hour ago",
    details: "A new order has been placed by a customer. The total amount is $150. Please check the order details and process it.",
    href: "/orders",
  },
  {
    title: "Your subscription is expiring soon!",
    description: "2 hours ago",
    details: "Your current subscription plan is about to expire in 3 days. Please renew your subscription to continue enjoying our services without interruption.",
    href: "/settings",
  },
  {
    title: "Item 'Wireless Mouse' is low on stock.",
    description: "1 day ago",
    details: "The stock for 'Wireless Mouse' is running low. There are only 5 units left. Please reorder soon to avoid stockout.",
    href: "/inventory",
  },
];

type Notification = typeof notifications[number];

export function NotificationsMenu() {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <div className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
            <Bell className="h-5 w-5" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80" align="end">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <CardDescription>
                You have {notifications.length} unread messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col -mx-2">
                {notifications.map((notification, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    onClick={() => setSelectedNotification(notification)}
                  >
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {notification.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="p-2 border-t">
              <Button size="sm" className="w-full">
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
              <DialogDescription>{selectedNotification.description}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p>{selectedNotification.details}</p>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setSelectedNotification(null)}>Close</Button>
                <Link href={selectedNotification.href}>
                  <Button>View</Button>
                </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
