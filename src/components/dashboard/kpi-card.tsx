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
  change: string;
  icon: ReactNode;
  children?: ReactNode;
  loading?: boolean;
};

export function KpiCard({ title, value, change, icon, children, loading = false }: KpiCardProps) {
  return (
    <Card className="card-gradient">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
           <div className="space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold font-headline">{value}</div>
            <p className="text-xs text-muted-foreground">{change}</p>
          </>
        )}
        
        {children && <div className="mt-4">{children}</div>}
      </CardContent>
    </Card>
  );
}
