
"use client";

import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LowStockItems } from "@/components/dashboard/low-stock-items";
import { ActiveOrders } from "@/components/dashboard/active-orders";
import { RevenueChart, chartData, chartConfig, type FilterType } from "@/components/dashboard/revenue-chart";
import { DollarSign, Package, ShoppingCart, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [revenueFilter, setRevenueFilter] = useState<FilterType>("month");

  const { totalRevenue, changeText, title } = useMemo(() => {
    const data = chartData[revenueFilter];
    const total = data.reduce((acc, item) => acc + item.revenue, 0);
    
    // Note: This is a simplified change calculation. A real app would compare to the previous period.
    const change = revenueFilter === 'month' ? "+20.1%" : "+10.5%"; 
    const changeMessage = `from last ${revenueFilter}`;

    const newTitle = {
      day: "Daily Revenue",
      week: "Weekly Revenue",
      month: "Monthly Revenue",
      year: "Yearly Revenue",
    }[revenueFilter];

    return {
      totalRevenue: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(total),
      changeText: `${change} ${changeMessage}`,
      title: newTitle
    };
  }, [revenueFilter]);


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
          title={title}
          value={totalRevenue}
          change={changeText}
          icon={<DollarSign className="size-5 text-primary" />}
        >
           <RevenueChart filter={revenueFilter} setFilter={setRevenueFilter} />
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
