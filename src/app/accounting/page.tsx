
"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/analytics/kpi-card";
import { formatCurrency } from "@/lib/currency";
import { DollarSign, ArrowUp, ArrowDown } from "lucide-react";
import { SalesChart } from "@/components/analytics/sales-chart";
import type { Transaction } from "@/types";

const transactionTypeVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Revenue: "default",
  Expense: "destructive",
};

export default function AccountingPage() {
  const { transactions, loading } = useData();
  
  const { totalRevenue, totalExpenses, netIncome } = useMemo(() => {
    let revenue = 0;
    let expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'Revenue') {
        revenue += t.amount;
      } else {
        expenses += t.amount;
      }
    });
    return {
      totalRevenue: revenue,
      totalExpenses: expenses,
      netIncome: revenue - expenses,
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Accounting</h1>
        <p className="text-muted-foreground">Monitor your business's financial transactions.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<ArrowUp className="size-5 text-green-500" />}
          loading={loading}
        />
        <KpiCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          icon={<ArrowDown className="size-5 text-destructive" />}
          loading={loading}
        />
        <KpiCard
          title="Net Income"
          value={formatCurrency(netIncome)}
          icon={<DollarSign className="size-5 text-primary" />}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>A chronological log of all financial activities.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-sm text-muted-foreground">{format(transaction.date, "PPP")}</TableCell>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell>
                      <Badge variant={transactionTypeVariant[transaction.type]}>{transaction.type}</Badge>
                    </TableCell>
                    <TableCell className={cn(
                        "text-right font-mono",
                        transaction.type === 'Revenue' ? 'text-green-500' : 'text-destructive'
                    )}>
                      {transaction.type === 'Revenue' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No transactions found.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
