
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
import { getProducts } from "@/services/data-service";
import type { Product } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { PesoSign } from "@/components/icons";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [revenueFilter, setRevenueFilter] = useState<FilterType>("month");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilterType>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchProducts() {
      setProductsLoading(true);
      const fetchedProducts = await getProducts();
      setProducts(fetchedProducts);
      setProductsLoading(false);
    }
    if (user) {
      fetchProducts();
    }
  }, [user]);

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
        >
           <RevenueChart filter={revenueFilter} setFilter={setRevenueFilter} />
        </KpiCard>
        <KpiCard
          title={inventoryTitle}
          value={inventoryValue}
          change={inventoryChangeText}
          icon={<Package className="size-5 text-primary" />}
          loading={productsLoading}
        >
           <InventoryStatusChart products={products} filter={inventoryFilter} setFilter={setInventoryFilter} />
        </KpiCard>
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
