
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
  footer?: ReactNode;
  loading?: boolean;
  href?: string;
};

export function KpiCard({ title, value, change, icon, children, footer, loading = false, href }: KpiCardProps) {
  const MainContent = () => (
    <>
       <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="animate-bounce-in">{icon}</span>
      </CardHeader>
      <CardContent className="flex-1">
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
    </>
  );

  return (
    <Card className={cn("card-gradient flex flex-col", href && "hover:border-primary/50 transition-colors")}>
        {href ? (
            <Link href={href} className="flex flex-col flex-grow">
                <MainContent />
            </Link>
        ) : (
            <div className="flex flex-col flex-grow">
                <MainContent />
            </div>
        )}
        {footer && <div className="p-6 pt-0">{footer}</div>}
    </Card>
  );
}
