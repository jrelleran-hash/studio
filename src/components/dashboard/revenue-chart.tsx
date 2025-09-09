
"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CURRENCY_CONFIG } from "@/config/currency";

export const chartData = {
  day: [
    { date: "Mon", revenue: 820, expenses: 400 },
    { date: "Tue", revenue: 960, expenses: 450 },
    { date: "Wed", revenue: 1100, expenses: 500 },
    { date: "Thu", revenue: 490, expenses: 300 },
    { date: "Fri", revenue: 1300, expenses: 600 },
    { date: "Sat", revenue: 1450, expenses: 650 },
    { date: "Sun", revenue: 1500, expenses: 700 },
  ],
  week: [
    { week: "W1", revenue: 5000, expenses: 2200 },
    { week: "W2", revenue: 6200, expenses: 2800 },
    { week: "W3", revenue: 5800, expenses: 2600 },
    { week: "W4", revenue: 7100, expenses: 3100 },
  ],
  month: [
    { month: "Jan", revenue: 45231, expenses: 20000 },
    { month: "Feb", revenue: 39876, expenses: 18000 },
    { month: "Mar", revenue: 52345, expenses: 23000 },
    { month: "Apr", revenue: 48765, expenses: 21000 },
    { month: "May", revenue: 55432, expenses: 25000 },
    { month: "Jun", revenue: 51234, expenses: 22000 },
  ],
  year: [
     { year: "2021", revenue: 540000, expenses: 250000 },
     { year: "2022", revenue: 610000, expenses: 280000 },
     { year: "2023", revenue: 750000, expenses: 320000 },
     { year: "2024", revenue: 820000, expenses: 350000 },
  ]
};

export const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export type FilterType = "day" | "week" | "month" | "year";

interface RevenueChartProps {
  filter: FilterType;
}

export function RevenueChart({ filter }: RevenueChartProps) {
  const dataKey = filter === "day" ? "date" : filter;
  const data = chartData[filter];

  return (
    <ChartContainer config={chartConfig} className="h-[100px] w-full mt-4">
      <BarChart accessibilityLayer data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey={dataKey} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${CURRENCY_CONFIG.symbol}${value / 1000}k`} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
