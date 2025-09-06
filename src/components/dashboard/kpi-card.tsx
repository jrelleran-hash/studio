import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReactNode } from "react";

type KpiCardProps = {
  title: string;
  value: string;
  change: string;
  icon: ReactNode;
  children?: ReactNode;
};

export function KpiCard({ title, value, change, icon, children }: KpiCardProps) {
  return (
    <Card className="card-gradient">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-headline">{value}</div>
        <p className="text-xs text-muted-foreground">{change}</p>
        {children && <div className="mt-4">{children}</div>}
      </CardContent>
    </Card>
  );
}
