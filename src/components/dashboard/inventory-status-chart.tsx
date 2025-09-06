
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
  count: {
    label: "Product Count",
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
    const inStock = products.filter(p => p.stock > 10).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStock = products.filter(p => p.stock === 0).length;

    return [
      { status: "In Stock", count: inStock },
      { status: "Low Stock", count: lowStock },
      { status: "Out of Stock", count: outOfStock },
    ];
  }, [products]);

  return (
    <>
      <ChartContainer config={chartConfig} className="h-[100px] w-full mt-4">
        <BarChart accessibilityLayer data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="status" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} interval={0} />
          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
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
