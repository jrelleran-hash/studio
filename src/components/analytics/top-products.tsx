
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Order } from "@/types";
import { Package } from "lucide-react";

interface TopProductsProps {
    orders: Order[];
    loading: boolean;
}

export function TopProducts({ orders, loading }: TopProductsProps) {
  const topProducts = useMemo(() => {
    const productCounts: { [key: string]: { name: string; sku: string; count: number, id: string } } = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        const { product } = item;
        if (!productCounts[product.id]) {
          productCounts[product.id] = { id: product.id, name: product.name, sku: product.sku, count: 0 };
        }
        productCounts[product.id].count += item.quantity;
      });
    });

    return Object.values(productCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [orders]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Products</CardTitle>
        <CardDescription>
          Your best-selling products by quantity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-12" />
                </div>
            ))}
            </div>
        ) : (
            <div className="space-y-4">
            {topProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-4">
                 <div className="p-2 bg-muted/50 rounded-md">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                <div className="flex-1">
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                </div>
                <div className="text-sm font-semibold">{product.count} sold</div>
                </div>
            ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
