
"use client";

import { Bar, BarChart, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { Tool } from "@/types";

const chartConfig = {
  Available: {
    label: "Available",
    color: "hsl(var(--chart-1))",
  },
  "In Use": {
    label: "In Use",
    color: "hsl(var(--chart-2))",
  },
  Assigned: {
    label: "Assigned",
    color: "hsl(var(--chart-4))",
  },
  "Under Maintenance": {
    label: "Under Maintenance",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig;

interface ToolStatusChartProps {
  tools: Tool[];
}

export function ToolStatusChart({ tools }: ToolStatusChartProps) {
  const summaryData = useMemo(() => {
    const summary = {
      Available: tools.filter(t => t.status === 'Available').length,
      "In Use": tools.filter(t => t.status === 'In Use').length,
      "Assigned": tools.filter(t => t.status === 'Assigned').length,
      "Under Maintenance": tools.filter(t => t.status === 'Under Maintenance').length,
    };
    
    return [
        { status: "Available", quantity: summary['Available'], fill: "var(--color-Available)" },
        { status: "In Use", quantity: summary['In Use'], fill: "var(--color-In Use)" },
        { status: "Assigned", quantity: summary['Assigned'], fill: "var(--color-Assigned)" },
        { status: "Under Maintenance", quantity: summary['Under Maintenance'], fill: "var(--color-Under Maintenance)" },
    ];
  }, [tools]);

  return (
    <ChartContainer config={chartConfig} className="h-[100px] w-full mt-4">
      <BarChart 
        accessibilityLayer 
        data={summaryData} 
        margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
        layout="vertical"
      >
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="dot" />} />
          <Bar dataKey="quantity" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
