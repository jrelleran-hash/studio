
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
import { subDays, format, parseISO, startOfDay } from 'date-fns';

// Helper function to get the end of a day
const endOfDay = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

const chartConfig = {
  quantity: {
    label: "Total Quantity",
    color: "hsl(var(--chart-1))",
  },
   inStock: {
    label: "In Stock",
    color: "hsl(var(--chart-1))",
  },
  lowStock: {
    label: "Low Stock",
    color: "hsl(var(--chart-2))",
  },
  outOfStock: {
    label: "Out of Stock (Items)",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig;

export type InventoryFilterType = "all" | "in-stock" | "low-stock" | "out-of-stock";

interface InventoryStatusChartProps {
  products: Product[];
  filter: InventoryFilterType;
  setFilter: (filter: InventoryFilterType) => void;
}

const getStatusForProduct = (product: Product, stockLevel?: number) => {
    const stock = stockLevel ?? product.stock;
    if (stock === 0) return "out-of-stock";
    if (stock <= product.reorderLimit) return "low-stock";
    return "in-stock";
};

export function InventoryStatusChart({ products, filter, setFilter }: InventoryStatusChartProps) {
  
  const { summaryData, historicalData } = useMemo(() => {
    const today = startOfDay(new Date());
    const last7Days = Array.from({ length: 7 }).map((_, i) => format(subDays(today, i), 'yyyy-MM-dd')).reverse();

    // Summary data for 'all' view
    const summary = {
      "in-stock": products.filter(p => getStatusForProduct(p) === 'in-stock').reduce((sum, p) => sum + p.stock, 0),
      "low-stock": products.filter(p => getStatusForProduct(p) === 'low-stock').reduce((sum, p) => sum + p.stock, 0),
      "out-of-stock": products.filter(p => getStatusForProduct(p) === 'out-of-stock').length,
    };
    
    const summaryChartData = [
        { status: "In Stock", quantity: summary['in-stock'], fill: "var(--color-inStock)" },
        { status: "Low Stock", quantity: summary['low-stock'], fill: "var(--color-lowStock)" },
        { status: "Out of Stock", quantity: summary['out-of-stock'], fill: "var(--color-outOfStock)" },
    ];

    // Historical data for filtered views
    const historical = last7Days.map(dateStr => {
        const dailyTotals = { "in-stock": 0, "low-stock": 0, "out-of-stock": 0 };
        
        products.forEach(p => {
            // Find the most recent history entry for this product on or before the given date
            const relevantHistory = p.history
                ?.map(h => ({...h, dateUpdated: h.dateUpdated.toDate()}))
                .filter(h => h.dateUpdated <= endOfDay(parseISO(dateStr)))
                .sort((a, b) => b.dateUpdated.getTime() - a.dateUpdated.getTime());
            
            // If no relevant history, assume 0 stock for that day
            const stockOnDate = relevantHistory && relevantHistory.length > 0 ? relevantHistory[0].stock : 0; 
            
            const status = getStatusForProduct(p, stockOnDate);

            if (stockOnDate > 0) {
              if (status === 'low-stock') {
                  dailyTotals['low-stock'] += stockOnDate;
              } else if (status === 'in-stock') {
                  dailyTotals['in-stock'] += stockOnDate;
              }
            } else if (status === 'out-of-stock') {
                dailyTotals['out-of-stock']++;
            }
        });

        return {
            date: format(parseISO(dateStr), 'MMM d'),
            "in-stock": dailyTotals["in-stock"],
            "low-stock": dailyTotals["low-stock"],
            "out-of-stock": dailyTotals["out-of-stock"],
        };
    });

    return { summaryData: summaryChartData, historicalData: historical };
  }, [products]);


  const renderChart = () => {
    if (filter === 'all') {
      return (
         <BarChart 
            accessibilityLayer 
            data={summaryData} 
            margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
            layout="vertical"
          >
          <YAxis 
            dataKey="status" 
            type="category"
            stroke="#888888" 
            fontSize={9} 
            tickLine={false} 
            axisLine={false} 
            interval={0} 
            width={80}
           />
          <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="quantity" radius={[0, 4, 4, 0]} />
        </BarChart>
      )
    }

    const dataKey = filter as Exclude<InventoryFilterType, 'all'>;

    return (
       <BarChart
        accessibilityLayer
        data={historicalData}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <XAxis
          dataKey="date"
          stroke="#888888"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          interval={1}
        />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <ChartTooltip 
          cursor={false} 
          content={<ChartTooltipContent 
            labelKey="date" 
            formatter={(value, name) => {
              const config = chartConfig[name as keyof typeof chartConfig];
              return [value, config?.label || name];
            }}
          />} 
        />
        <Bar
          dataKey={dataKey}
          fill={`var(--color-${dataKey})`}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    )
  }

  return (
    <>
      <ChartContainer config={chartConfig} className="h-[100px] w-full mt-4">
        {renderChart()}
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
