import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReactNode } from "react";
import { Skeleton } from "../ui/skeleton";

type KpiCardProps = {
  title: string;
  value: string;
  icon: ReactNode;
  loading?: boolean;
};

export function KpiCard({ title, value, icon, loading = false }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-2xl font-bold font-headline">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
