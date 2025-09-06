

"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useMemo } from "react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "../ui/button";
import type { Product } from "@/types";

const chartConfig = {
  quantity: {
    label: "Total Quantity",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export type InventoryFilterType = "all" | "in-stock" | "low-stock" | "out-of-stock";

interface InventoryStatusChartProps {
  products: Product[];
  filter: InventoryFilterType;
  setFilter: (filter: InventoryFilterType) => void;
}

export function InventoryStatusChart({ products, filter, setFilter }: InventoryStatusChartProps) {
  const chartData = useMemo(() => {
    const inStock = products
      .filter(p => p.stock > p.reorderLimit)
      .reduce((sum, p) => sum + p.stock, 0);
    const lowStock = products
      .filter(p => p.stock > 0 && p.stock <= p.reorderLimit)
      .reduce((sum, p) => sum + p.stock, 0);
    const outOfStock = products
      .filter(p => p.stock === 0)
      .length; // Count for out of stock is more intuitive

    return [
      { status: "In Stock", quantity: inStock },
      { status: "Low Stock", quantity: lowStock },
      { status: "Out of Stock", quantity: outOfStock },
    ];
  }, [products]);

  return (
    <>
      <ChartContainer config={chartConfig} className="h-[100px] w-full mt-4">
        <BarChart accessibilityLayer data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="status" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} interval={0} />
          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="quantity" fill="var(--color-quantity)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
       <div className="flex justify-end gap-1 mt-2">
        {(["all", "in-stock", "low-stock", "out-of-stock"] as InventoryFilterType[]).map((f) => (
          <Button 
            key={f} 
            variant={filter === f ? "secondary" : "ghost"} 
            size="sm" 
            className="capitalize h-7 px-2 text-xs" 
            onClick={() => setFilter(f)}
          >
            {f.replace('-', ' ')}
          </Button>
        ))}
      </div>
    </>
  );
}
