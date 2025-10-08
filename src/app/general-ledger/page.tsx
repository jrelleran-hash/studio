
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function GeneralLedgerPage() {
    const { transactions, loading } = useData();
    const [monthFilter, setMonthFilter] = useState("all");
    const [yearFilter, setYearFilter] = useState("all");

    const filteredTransactions = transactions.filter(t => {
        const date = t.date.toDate();
        const monthMatch = monthFilter === 'all' || date.getMonth() === parseInt(monthFilter);
        const yearMatch = yearFilter === 'all' || date.getFullYear() === parseInt(yearFilter);
        return monthMatch && yearMatch;
    });

    const years = Array.from(new Set(transactions.map(t => t.date.toDate().getFullYear().toString()))).sort((a,b) => parseInt(b) - parseInt(a));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold font-headline tracking-tight">General Ledger</h1>
                <p className="text-muted-foreground">A record of all financial transactions.</p>
            </div>
            <Card>
                 <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle>Transactions</CardTitle>
                        <CardDescription>All revenue and expenses recorded in the system.</CardDescription>
                    </div>
                     <div className="flex items-center gap-2">
                        <Select value={monthFilter} onValueChange={setMonthFilter}>
                            <SelectTrigger className="w-32"><SelectValue placeholder="Month" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Months</SelectItem>
                                {Array.from({length: 12}).map((_, i) => (
                                    <SelectItem key={i} value={i.toString()}>{format(new Date(0, i), 'MMMM')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <Select value={yearFilter} onValueChange={setYearFilter}>
                            <SelectTrigger className="w-28"><SelectValue placeholder="Year" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Years</SelectItem>
                                {years.map(year => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 8}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredTransactions.length > 0 ? (
                                filteredTransactions.map((transaction) => (
                                    <TableRow key={transaction.id}>
                                        <TableCell>{format(transaction.date.toDate(), 'PPP')}</TableCell>
                                        <TableCell>{transaction.description}</TableCell>
                                        <TableCell>{transaction.account}</TableCell>
                                        <TableCell className="text-right font-mono">{transaction.debit ? formatCurrency(transaction.debit) : '-'}</TableCell>
                                        <TableCell className="text-right font-mono">{transaction.credit ? formatCurrency(transaction.credit) : '-'}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(transaction.balance)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No transactions found for the selected filters.
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
