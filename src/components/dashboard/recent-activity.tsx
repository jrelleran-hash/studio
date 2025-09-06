"use client";

import { useState } from "react";
import { ArrowUpRight, ShoppingCart, UserPlus, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";

const activities = [
  {
    title: "New order #1245 placed",
    time: "15 minutes ago",
    details: "Order placed by John Doe for 3 items, totaling $149.99.",
    icon: <ShoppingCart className="size-4 text-primary" />,
  },
  {
    title: "New user signed up",
    time: "1 hour ago",
    details: "Jane Smith created a new account.",
    icon: <UserPlus className="size-4 text-primary" />,
  },
  {
    title: "Inventory updated",
    time: "3 hours ago",
    details: "Stock for 'Wireless Keyboard' increased by 50 units.",
    icon: <Package className="size-4 text-primary" />,
  },
  {
    title: "New order #1244 placed",
    time: "5 hours ago",
    details: "Order placed by Alex Ray for 1 item, totaling $29.99.",
    icon: <ShoppingCart className="size-4 text-primary" />,
  },
];

export function RecentActivity() {
  const [selectedActivity, setSelectedActivity] = useState<(typeof activities)[0] | null>(null);

  return (
    <Card className="card-gradient h-full">
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            An overview of the latest events in your store.
          </CardDescription>
        </div>
        <Button asChild size="sm" className="ml-auto gap-1">
          <Link href="/activity">
            View All
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Dialog>
          <div className="grid gap-6">
            {activities.map((activity, index) => (
              <DialogTrigger asChild key={index} onClick={() => setSelectedActivity(activity)}>
                <div className="flex items-center gap-4 cursor-pointer group">
                  <div className="p-2 bg-muted/50 rounded-full group-hover:bg-primary/20 transition-colors">
                    {activity.icon}
                  </div>
                  <div className="grid gap-1 flex-1">
                    <p className="text-sm font-medium leading-none">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              </DialogTrigger>
            ))}
          </div>
          {selectedActivity && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedActivity.title}</DialogTitle>
                <DialogDescription>{selectedActivity.time}</DialogDescription>
              </DialogHeader>
              <div>
                <p>{selectedActivity.details}</p>
              </div>
              <Button>View Full Details</Button>
            </DialogContent>
          )}
        </Dialog>
      </CardContent>
    </Card>
  );
}
