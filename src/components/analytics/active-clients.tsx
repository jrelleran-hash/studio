
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Order } from "@/types";
import { formatCurrency } from "@/lib/currency";

interface ActiveClientsProps {
    orders: Order[];
    loading: boolean;
}

export function ActiveClients({ orders, loading }: ActiveClientsProps) {
  const activeClients = useMemo(() => {
    const clientData: { [key: string]: { name: string; projectName: string; orderCount: number; totalSpent: number } } = {};

    orders.forEach(order => {
      const { client } = order;
      if (!clientData[client.id]) {
        clientData[client.id] = { 
            name: client.clientName, 
            projectName: client.projectName, 
            orderCount: 0, 
            totalSpent: 0 
        };
      }
      clientData[client.id].orderCount++;
      clientData[client.id].totalSpent += order.total;
    });

    return Object.values(clientData)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 7);
  }, [orders]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Active Clients</CardTitle>
        <CardDescription>
          Clients with the highest number of orders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (
              activeClients.map((client, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.projectName}</TableCell>
                  <TableCell className="text-center">{client.orderCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(client.totalSpent)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
