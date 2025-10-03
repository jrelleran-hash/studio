
"use client";

import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LowStockItems } from "@/components/dashboard/low-stock-items";
import { ActiveOrders } from "@/components/dashboard/active-orders";
import { RevenueChart, type FilterType } from "@/components/dashboard/revenue-chart";
import { InventoryStatusChart, type InventoryFilterType } from "@/components/dashboard/inventory-status-chart";
import { ToolStatusChart } from "@/components/dashboard/tool-status-chart";
import { Package, ShoppingCart, Users, Camera, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useData } from "@/context/data-context";
import { formatCurrency } from "@/lib/currency";
import { PesoSign } from "@/components/icons";
import { subDays, subWeeks, subMonths, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, isWithinInterval, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import type { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { StartupAnimation } from "@/components/layout/startup-animation";

const getRevenueData = (orders: Order[], filter: FilterType) => {
    const now = new Date();
    let interval;
    let previousInterval;
    let dataPoints: { name: string, revenue: number, expenses: number }[] = [];
    let title = "";

    switch (filter) {
        case "day":
            interval = { start: startOfDay(now), end: endOfDay(now) };
            previousInterval = { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
            const todayHours = Array.from({ length: 24 }, (_, i) => i);
             dataPoints = todayHours.map(hour => ({
                name: `${hour}:00`,
                revenue: 0,
                expenses: 0, // Placeholder for expenses
            }));
            title = "Today's Revenue";
            break;
        case "week":
            interval = { start: startOfWeek(now), end: endOfWeek(now) };
            previousInterval = { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) };
            dataPoints = eachDayOfInterval(interval).map(day => ({
                name: format(day, 'E'),
                revenue: 0,
                expenses: 0,
            }));
            title = "This Week's Revenue";
            break;
        case "month":
            interval = { start: startOfMonth(now), end: endOfMonth(now) };
            previousInterval = { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
            dataPoints = eachWeekOfInterval(interval, { weekStartsOn: 1 }).map((week, i) => ({
                name: `W${i + 1}`,
                revenue: 0,
                expenses: 0,
            }));
            title = "This Month's Revenue";
            break;
        case "year":
            interval = { start: startOfYear(now), end: endOfYear(now) };
            previousInterval = { start: startOfYear(subYears(now, 1)), end: endOfYear(subYears(now, 1)) };
            dataPoints = eachMonthOfInterval(interval).map(month => ({
                name: format(month, 'MMM'),
                revenue: 0,
                expenses: 0,
            }));
            title = "This Year's Revenue";
            break;
    }
    
    let currentTotal = 0;
    let previousTotal = 0;

    orders.forEach(order => {
        if (isWithinInterval(order.date, interval)) {
            currentTotal += order.total;
            let key;
            if (filter === 'day') key = `${order.date.getHours()}:00`;
            else if (filter === 'week') key = format(order.date, 'E');
            else if (filter === 'month') {
                const weekIndex = Math.floor((order.date.getDate() - 1) / 7);
                key = `W${weekIndex + 1}`;
            }
            else if (filter === 'year') key = format(order.date, 'MMM');
            
            const dataPoint = dataPoints.find(dp => dp.name === key);
            if (dataPoint) dataPoint.revenue += order.total;
        } else if (isWithinInterval(order.date, previousInterval)) {
            previousTotal += order.total;
        }
    });

    let changePercentage = 0;
    if (previousTotal > 0) {
        changePercentage = ((currentTotal - previousTotal) / previousTotal) * 100;
    } else if (currentTotal > 0) {
        changePercentage = 100;
    }

    const changeText = `${changePercentage >= 0 ? '+' : ''}${changePercentage.toFixed(1)}% from last ${filter}`;

    return { total: currentTotal, changeText, title, chartData: dataPoints };
}


export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { products, clients, orders, tools, loading: dataLoading } = useData();
  
  const [revenueFilter, setRevenueFilter] = useState<FilterType>("month");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilterType>("all");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const { totalRevenue, revenueChangeText, revenueTitle, revenueChartData } = useMemo(() => {
    const { total, changeText, title, chartData } = getRevenueData(orders, revenueFilter);
    return {
        totalRevenue: formatCurrency(total),
        revenueChangeText: changeText,
        revenueTitle: title,
        revenueChartData: chartData
    };
  }, [orders, revenueFilter]);

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
  
  const toolData = useMemo(() => {
    const inUseCount = tools.filter(t => t.status === 'In Use').length;
    return {
      total: tools.length,
      change: `${inUseCount} in use`,
    };
  }, [tools]);


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
    const activeStatuses: Order['status'][] = ["Processing", "Awaiting Purchase", "Ready for Issuance"];
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status));

    const now = new Date();
    const oneHourAgo = subDays(now, 1); // Changed to subDays for more realistic "recent" data

    const recentActiveOrders = orders.filter(o => o.date > oneHourAgo).length;

    return {
      count: activeOrders.length,
      change: `+${recentActiveOrders} in the last 24 hours`,
    };
  }, [orders]);

  if (authLoading || !user) {
    return <StartupAnimation />;
  }

  return (
    <>
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
            children={<RevenueChart data={revenueChartData} />}
            footer={
              <div className="flex justify-end gap-1 mt-2">
                {(["day", "week", "month", "year"] as FilterType[]).map((f) => (
                  <Button key={f} variant={revenueFilter === f ? "secondary" : "ghost"} size="sm" className="capitalize h-7 px-2" onClick={() => setRevenueFilter(f)}>
                    {f}
                  </Button>
                ))}
              </div>
            }
          />
          <KpiCard
            title={inventoryTitle}
            value={inventoryValue}
            change={inventoryChangeText}
            icon={<Package className="size-5 text-primary" />}
            loading={dataLoading}
            href="/inventory"
            children={<InventoryStatusChart products={products} filter={inventoryFilter} />}
            footer={
              <div className="flex justify-end gap-1 mt-2">
                {(["all", "in-stock", "low-stock", "out-of-stock"] as InventoryFilterType[]).map((f) => (
                  <Button 
                    key={f} 
                    variant={inventoryFilter === f ? "secondary" : "ghost"} 
                    size="sm" 
                    className="capitalize h-7 px-2 text-xs" 
                    onClick={() => setInventoryFilter(f)}
                  >
                    {f.replace('-', ' ')}
                  </Button>
                ))}
              </div>
            }
          />
          <KpiCard
            title="Tool Status"
            value={`${toolData.total} Total`}
            change={toolData.change}
            icon={<Wrench className="size-5 text-primary" />}
            loading={dataLoading}
            href="/tools"
            children={<ToolStatusChart tools={tools} />}
          />
          <KpiCard
            title="Active Orders"
            value={activeOrdersData.count.toLocaleString()}
            change={activeOrdersData.change}
            icon={<ShoppingCart className="size-5 text-primary" />}
            loading={dataLoading}
            href="/orders"
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
    </>
  );
}
