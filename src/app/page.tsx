
"use client";

import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LowStockItems } from "@/components/dashboard/low-stock-items";
import { ActiveOrders } from "@/components/dashboard/active-orders";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { DollarSign, Package, ShoppingCart, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WelcomeCard />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Monthly Revenue"
          value="$45,231.89"
          change="+20.1% from last month"
          icon={<DollarSign className="size-5 text-primary" />}
        >
           <RevenueChart />
        </KpiCard>
        <KpiCard
          title="Inventory Value"
          value="$1,250,320"
          change="+12.5% from last month"
          icon={<Package className="size-5 text-primary" />}
        />
        <KpiCard
          title="Active Orders"
          value="1,203"
          change="+5 since last hour"
          icon={<ShoppingCart className="size-5 text-primary" />}
        />
        <KpiCard
          title="New Customers"
          value="89"
          change="+30.2% from last month"
          icon={<Users className="size-5 text-primary" />}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        <div className="lg:col-span-1">
          <LowStockItems />
        </div>
      </div>
      <ActiveOrders />
    </div>
  );
}
