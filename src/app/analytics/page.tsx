
"use client";

import { DollarSign, ShoppingCart, Users, Package } from "lucide-react";
import { KpiCard } from "@/components/analytics/kpi-card";
import { SalesChart } from "@/components/analytics/sales-chart";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { TopProducts } from "@/components/analytics/top-products";
import { ActiveClients } from "@/components/analytics/active-clients";
import { useData } from "@/context/data-context";
import { formatCurrency } from "@/lib/currency";

export default function AnalyticsPage() {
  const { orders, clients, products, issuances, loading } = useData();

  const totalRevenue = orders.reduce((acc, order) => acc + order.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">
          Performance Analytics
        </h1>
        <p className="text-muted-foreground">
          Detailed insights into your business performance.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="size-5 text-muted-foreground" />}
          loading={loading}
        />
        <KpiCard
          title="Total Orders"
          value={orders.length.toString()}
          icon={<ShoppingCart className="size-5 text-muted-foreground" />}
          loading={loading}
        />
        <KpiCard
          title="Total Clients"
          value={clients.length.toString()}
          icon={<Users className="size-5 text-muted-foreground" />}
          loading={loading}
        />
        <KpiCard
          title="Total Products"
          value={products.length.toString()}
          icon={<Package className="size-5 text-muted-foreground" />}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SalesChart orders={orders} loading={loading} />
        <ActivityChart orders={orders} issuances={issuances} loading={loading} />
      </div>
      
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TopProducts orders={orders} loading={loading} />
        <ActiveClients orders={orders} loading={loading} />
      </div>

    </div>
  );
}
