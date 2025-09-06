
"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ShoppingCart, UserPlus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";
import { getRecentActivities } from "@/services/data-service";
import type { Activity } from "@/types";
import { Skeleton } from "../ui/skeleton";

const iconMap = {
  ShoppingCart: <ShoppingCart className="size-4 text-primary" />,
  UserPlus: <UserPlus className="size-4 text-primary" />,
  Package: <Package className="size-4 text-primary" />,
};

type ActivityWithTime = Activity & { time: string };

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityWithTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithTime | null>(null);

  useEffect(() => {
    async function fetchActivities() {
      setLoading(true);
      const fetchedActivities = await getRecentActivities();
      setActivities(fetchedActivities);
      setLoading(false);
    }
    fetchActivities();
  }, []);

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
                <DialogTrigger asChild key={activity.id} onClick={() => setSelectedActivity(activity)}>
                  <div className="flex items-center gap-4 cursor-pointer group">
                    <div className="p-2 bg-muted/50 rounded-full group-hover:bg-primary/20 transition-colors">
                      {iconMap[activity.icon]}
                    </div>
                    <div className="grid gap-1 flex-1">
                      <p className="text-sm font-medium leading-none">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                </DialogTrigger>
              ))
            )}
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
