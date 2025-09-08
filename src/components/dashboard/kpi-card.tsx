
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReactNode } from "react";
import { Skeleton } from "../ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  change: string;
  icon: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  href?: string;
};

export function KpiCard({ title, value, change, icon, children, loading = false, href }: KpiCardProps) {
  const CardContentWrapper = ({children}: {children: ReactNode}) => (
    <Card className={cn("card-gradient", href && "hover:border-primary/50 transition-colors")}>
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
        
        {children}
      </CardContent>
    </Card>
  );
  
  if (href) {
    return <Link href={href}>{CardContentWrapper({children})}</Link>
  }
  
  return CardContentWrapper({children});
}
