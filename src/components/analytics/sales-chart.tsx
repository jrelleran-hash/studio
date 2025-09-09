
"use client";

import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { Order } from "@/types";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface SalesChartProps {
  orders: Order[];
  loading: boolean;
}

export function SalesChart({ orders, loading }: SalesChartProps) {
  const data = useMemo(() => {
    const monthlySales: { [key: string]: number } = {};

    orders.forEach(order => {
      const month = format(order.date, "MMM yyyy");
      if (!monthlySales[month]) {
        monthlySales[month] = 0;
      }
      monthlySales[month] += order.total;
    });

    const sortedMonths = Object.keys(monthlySales).sort((a, b) => {
       const dateA = new Date(a);
       const dateB = new Date(b);
       return dateA.getTime() - dateB.getTime();
    });

    return sortedMonths.map(month => ({
      month: format(new Date(month), "MMM"),
      revenue: monthlySales[month],
    })).slice(-12); // Show last 12 months
  }, [orders]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
        <CardDescription>
          Showing total revenue per month for the last year.
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
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip
                    cursor={false}
                    content={<ChartTooltipContent
                      formatter={(value) => formatCurrency(value as number)}
                      indicator="dot"
                    />}
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
