
"use client";

import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { Order, Issuance } from "@/types";
import { format } from "date-fns";

const chartConfig = {
  orders: {
    label: "Orders",
    color: "hsl(var(--chart-1))",
  },
  issuances: {
    label: "Issuances",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

interface ActivityChartProps {
  orders: Order[];
  issuances: Issuance[];
  loading: boolean;
}

export function ActivityChart({ orders, issuances, loading }: ActivityChartProps) {
  const data = useMemo(() => {
    const monthlyActivity: { [key: string]: { orders: number; issuances: number } } = {};

    const processItems = (items: (Order | Issuance)[], type: "orders" | "issuances") => {
        items.forEach(item => {
          const month = format(item.date, "MMM yyyy");
          if (!monthlyActivity[month]) {
            monthlyActivity[month] = { orders: 0, issuances: 0 };
          }
          monthlyActivity[month][type]++;
        });
    };
    
    processItems(orders, 'orders');
    processItems(issuances, 'issuances');

    const sortedMonths = Object.keys(monthlyActivity).sort((a, b) => {
       const dateA = new Date(a);
       const dateB = new Date(b);
       return dateA.getTime() - dateB.getTime();
    });

    return sortedMonths.map(month => ({
      month: format(new Date(month), "MMM"),
      orders: monthlyActivity[month].orders,
      issuances: monthlyActivity[month].issuances,
    })).slice(-12); // Show last 12 months
  }, [orders, issuances]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Trends</CardTitle>
        <CardDescription>
          New orders vs. material issuances per month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 w-full flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Legend content={<ChartLegendContent />} />
                  <Bar dataKey="orders" fill="var(--color-orders)" radius={4} />
                  <Bar dataKey="issuances" fill="var(--color-issuances)" radius={4} />
                </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
