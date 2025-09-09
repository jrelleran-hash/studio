
"use client";

import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LowStockItems } from "@/components/dashboard/low-stock-items";
import { ActiveOrders } from "@/components/dashboard/active-orders";
import { RevenueChart, chartData, type FilterType } from "@/components/dashboard/revenue-chart";
import { InventoryStatusChart, type InventoryFilterType } from "@/components/dashboard/inventory-status-chart";
import { Package, ShoppingCart, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { getProducts, getClients, getOrders } from "@/services/data-service";
import type { Product, Client, Order } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { PesoSign } from "@/components/icons";
import { subDays, subHours } from "date-fns";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [revenueFilter, setRevenueFilter] = useState<FilterType>("month");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilterType>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchData() {
      if (user) {
        setDataLoading(true);
        try {
          const [fetchedProducts, fetchedClients, fetchedOrders] = await Promise.all([
            getProducts(),
            getClients(),
            getOrders(),
          ]);
          setProducts(fetchedProducts);
          setClients(fetchedClients);
          setOrders(fetchedOrders);
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setDataLoading(false);
        }
      }
    }
    fetchData();
  }, [user?.uid]);

  const { totalRevenue, changeText: revenueChangeText, title: revenueTitle } = useMemo(() => {
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
      totalRevenue: formatCurrency(total),
      changeText: `${change} ${changeMessage}`,
      title: newTitle
    };
  }, [revenueFilter]);

  const { inventoryValue, inventoryChangeText, inventoryTitle } = useMemo(() => {
    const filteredProducts = products.filter(p => {
        if (inventoryFilter === 'all') return true;
        if (inventoryFilter === 'in-stock') return p.stock > p.reorderLimit;
        if (inventoryFilter === 'low-stock') return p.stock > 0 && p.stock <= p.reorderLimit;
        if (inventoryFilter === 'out-of-stock') return p.stock === 0;
        return false;
    });

    const totalValue = filteredProducts.reduce((acc, p) => acc + p.price * p.stock, 0);

    const titleMap = {
        'all': 'Total Inventory',
        'in-stock': 'In Stock Value',
        'low-stock': 'Low Stock Value',
        'out-of-stock': 'Out of Stock Value',
    }

    return {
      inventoryValue: formatCurrency(totalValue),
      inventoryChangeText: `Across ${filteredProducts.length} products`,
      inventoryTitle: titleMap[inventoryFilter],
    };

  }, [products, inventoryFilter]);

  const newClientsData = useMemo(() => {
    const now = new Date();
    const last30DaysStart = subDays(now, 30);
    const prev30DaysStart = subDays(now, 60);

    const newClientsLast30Days = clients.filter(c => c.createdAt && c.createdAt.toDate() > last30DaysStart).length;
    const newClientsPrev30Days = clients.filter(c => c.createdAt && c.createdAt.toDate() > prev30DaysStart && c.createdAt.toDate() <= last30DaysStart).length;

    let changePercentage = 0;
    if (newClientsPrev30Days > 0) {
      changePercentage = ((newClientsLast30Days - newClientsPrev30Days) / newClientsPrev30Days) * 100;
    } else if (newClientsLast30Days > 0) {
      changePercentage = 100; // Or Infinity, depending on how you want to represent it
    }

    const changeText = `${changePercentage >= 0 ? '+' : ''}${changePercentage.toFixed(1)}% from last month`;

    return {
      count: newClientsLast30Days,
      change: changeText,
    };
  }, [clients]);

  const activeOrdersData = useMemo(() => {
    const activeStatuses: Order['status'][] = ["Processing", "Shipped"];
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status));

    const now = new Date();
    const oneHourAgo = subHours(now, 1);

    const recentActiveOrders = orders.filter(o => o.date > oneHourAgo).length;

    return {
      count: activeOrders.length,
      change: `+${recentActiveOrders} since last hour`,
    };
  }, [orders]);


  if (authLoading || !user) {
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
          title={revenueTitle}
          value={totalRevenue}
          change={revenueChangeText}
          icon={<PesoSign className="size-5 text-primary" />}
          loading={dataLoading}
          href="/analytics"
        >
           <RevenueChart filter={revenueFilter} setFilter={setRevenueFilter} />
        </KpiCard>
        <KpiCard
          title={inventoryTitle}
          value={inventoryValue}
          change={inventoryChangeText}
          icon={<Package className="size-5 text-primary" />}
          loading={dataLoading}
          href="/inventory"
        >
           <InventoryStatusChart products={products} filter={inventoryFilter} setFilter={setInventoryFilter} />
        </KpiCard>
        <KpiCard
          title="Active Orders"
          value={activeOrdersData.count.toLocaleString()}
          change={activeOrdersData.change}
          icon={<ShoppingCart className="size-5 text-primary" />}
          loading={dataLoading}
          href="/orders"
        />
        <KpiCard
          title="New Clients"
          value={`+${newClientsData.count}`}
          change={newClientsData.change}
          icon={<Users className="size-5 text-primary" />}
          loading={dataLoading}
          href="/clients"
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
