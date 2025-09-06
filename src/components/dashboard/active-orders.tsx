"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const orders = [
  {
    order: "ORD-001",
    customer: "Liam Johnson",
    date: "2023-06-23",
    total: "$250.00",
    status: "Fulfilled",
    email: "liam@example.com",
  },
  {
    order: "ORD-002",
    customer: "Olivia Smith",
    date: "2023-06-24",
    total: "$150.00",
    status: "Processing",
    email: "olivia@example.com",
  },
  {
    order: "ORD-003",
    customer: "Noah Williams",
    date: "2023-06-25",
    total: "$350.00",
    status: "Fulfilled",
    email: "noah@example.com",
  },
  {
    order: "ORD-004",
    customer: "Emma Brown",
    date: "2023-06-26",
    total: "$450.00",
    status: "Shipped",
    email: "emma@example.com",
  },
];

type Order = (typeof orders)[0];

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Fulfilled: "default",
  Processing: "secondary",
  Shipped: "outline",
};

export function ActiveOrders() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <Card className="card-gradient">
      <CardHeader>
        <CardTitle>Active Orders</CardTitle>
        <CardDescription>
          A list of your store's most recent orders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.order} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                <TableCell className="font-medium">{order.order}</TableCell>
                <TableCell>{order.customer}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[order.status] || "default"}>{order.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{order.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selectedOrder && (
          <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Order Details: {selectedOrder.order}</DialogTitle>
                <DialogDescription>
                  Customer: {selectedOrder.customer} ({selectedOrder.email})
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p><strong>Date:</strong> {selectedOrder.date}</p>
                <p><strong>Total:</strong> {selectedOrder.total}</p>
                <p><strong>Status:</strong> <Badge variant={statusVariant[selectedOrder.status] || "default"}>{selectedOrder.status}</Badge></p>
              </div>
              <DialogFooter>
                <Button variant="destructive">Cancel Order</Button>
                <Button variant="outline">Edit Order</Button>
                <Button onClick={() => setSelectedOrder(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
