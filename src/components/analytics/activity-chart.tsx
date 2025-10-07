
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
import { format, startOfMonth } from "date-fns";

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
    if (orders.length === 0 && issuances.length === 0) return [];
    
    const monthlyActivity: { [key: string]: { orders: number; issuances: number } } = {};
    let firstDate = new Date();
    let lastDate = new Date(1970, 0, 1);

    const allItems = [...orders, ...issuances];
    allItems.forEach(item => {
        if(item.date < firstDate) firstDate = item.date;
        if(item.date > lastDate) lastDate = item.date;
    });

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

    const allMonths = [];
    let currentDate = startOfMonth(firstDate);

    while (currentDate <= lastDate) {
        allMonths.push(format(currentDate, "MMM yyyy"));
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return allMonths.map(month => ({
      month: format(new Date(month), "MMM"),
      orders: monthlyActivity[month]?.orders || 0,
      issuances: monthlyActivity[month]?.issuances || 0,
    }));
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
