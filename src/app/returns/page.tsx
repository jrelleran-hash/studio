
"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { processReturn } from "@/services/data-service";
import { useToast } from "@/hooks/use-toast";
import type { Return, OutboundReturn } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const inboundStatusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
  Pending: "secondary",
  Received: "outline",
  Restocked: "default",
  Cancelled: "destructive",
};

const outboundStatusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
  Pending: "secondary",
  Shipped: "outline",
  Completed: "default",
  Cancelled: "destructive",
};


export default function ReturnsPage() {
  const { returns, outboundReturns, loading, refetchData } = useData();
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [selectedOutboundReturn, setSelectedOutboundReturn] = useState<OutboundReturn | null>(null);
  const { toast } = useToast();

  const handleProcessReturn = async (returnId: string, status: "Received" | "Restocked" | "Cancelled") => {
    try {
      await processReturn(returnId, status);
      toast({ title: "Success", description: `Return marked as ${status}.` });
      await refetchData();
      setSelectedReturn(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return format(date, 'PPP');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Returns Management</h1>
        <p className="text-muted-foreground">Track and process all customer and supplier returns.</p>
      </div>

       <Tabs defaultValue="inbound">
          <TabsList className="mb-4">
              <TabsTrigger value="inbound">Inbound (From Customers)</TabsTrigger>
              <TabsTrigger value="outbound">Outbound (To Suppliers)</TabsTrigger>
          </TabsList>
          <TabsContent value="inbound">
             <Card>
              <CardHeader>
                <CardTitle>Inbound Returns</CardTitle>
                <CardDescription>A log of all initiated returns from customers.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RMA #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issuance #</TableHead>
                      <TableHead>Date Initiated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : returns.length > 0 ? (
                      returns.map((ret) => (
                        <TableRow key={ret.id} onClick={() => setSelectedReturn(ret)} className="cursor-pointer">
                          <TableCell className="font-medium">{ret.rmaNumber}</TableCell>
                          <TableCell>{ret.client.clientName}</TableCell>
                          <TableCell>{ret.issuanceNumber}</TableCell>
                          <TableCell>{formatDate(ret.dateInitiated)}</TableCell>
                          <TableCell><Badge variant={inboundStatusVariant[ret.status]}>{ret.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm">View Details</Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">No inbound returns found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="outbound">
            <Card>
              <CardHeader>
                <CardTitle>Outbound Returns</CardTitle>
                <CardDescription>A log of all returns to suppliers.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>RTS #</TableHead>
                              <TableHead>Supplier</TableHead>
                              <TableHead>PO #</TableHead>
                              <TableHead>Date Initiated</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                           {loading ? (
                              Array.from({ length: 8 }).map((_, i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                  <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                                </TableRow>
                              ))
                            ) : outboundReturns.length > 0 ? (
                              outboundReturns.map((ret) => (
                                <TableRow key={ret.id} onClick={() => setSelectedOutboundReturn(ret)} className="cursor-pointer">
                                  <TableCell className="font-medium">{ret.rtsNumber}</TableCell>
                                  <TableCell>{ret.supplier.name}</TableCell>
                                  <TableCell>{ret.poNumber}</TableCell>
                                  <TableCell>{formatDate(ret.dateInitiated)}</TableCell>
                                  <TableCell><Badge variant={outboundStatusVariant[ret.status]}>{ret.status}</Badge></TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="outline" size="sm">View Details</Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No outbound returns found.</TableCell>
                              </TableRow>
                            )}
                      </TableBody>
                  </Table>
              </CardContent>
            </Card>
          </TabsContent>
      </Tabs>

      
      {selectedReturn && (
        <Dialog open={!!selectedReturn} onOpenChange={(open) => !open && setSelectedReturn(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return Details: {selectedReturn.rmaNumber}</DialogTitle>
              <DialogDescription>
                From Issuance: {selectedReturn.issuanceNumber} for {selectedReturn.client.clientName}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <strong>Reason for Return:</strong>
                <p className="text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">{selectedReturn.reason}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Items being returned:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedReturn.items.map(item => (
                    <li key={item.productId}>{item.quantity} x {item.name} ({item.sku})</li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
                <Button 
                    variant="destructive" 
                    onClick={() => handleProcessReturn(selectedReturn.id, "Cancelled")}
                    disabled={selectedReturn.status !== 'Pending'}
                >
                    Cancel Return
                </Button>
              <div className="flex gap-2">
                <Button 
                    variant="outline"
                    onClick={() => handleProcessReturn(selectedReturn.id, "Received")}
                    disabled={selectedReturn.status !== 'Pending'}
                >
                    Mark as Received
                </Button>
                <Button 
                    onClick={() => handleProcessReturn(selectedReturn.id, "Restocked")}
                    disabled={selectedReturn.status !== 'Received'}
                >
                    Restock Items
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedOutboundReturn && (
        <Dialog open={!!selectedOutboundReturn} onOpenChange={(open) => !open && setSelectedOutboundReturn(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Outbound Return: {selectedOutboundReturn.rtsNumber}</DialogTitle>
              <DialogDescription>
                To Supplier: {selectedOutboundReturn.supplier.name} for PO: {selectedOutboundReturn.poNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <strong>Reason for Return:</strong>
                <p className="text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">{selectedOutboundReturn.reason}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Items being returned:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedOutboundReturn.items.map(item => (
                    <li key={item.productId}>{item.quantity} x {item.name} ({item.sku})</li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setSelectedOutboundReturn(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
