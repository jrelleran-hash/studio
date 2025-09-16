
"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Return, PurchaseOrder } from "@/types";
import { completeInspection, completePOInspection } from "@/services/data-service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const inspectionItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  sku: z.string(),
  returnedQuantity: z.number(),
  restockQuantity: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
  disposalQuantity: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
});

const returnInspectionSchema = z.object({
  items: z.array(inspectionItemSchema),
}).superRefine((data, ctx) => {
    data.items.forEach((item, index) => {
        const totalInspected = (item.restockQuantity || 0) + (item.disposalQuantity || 0);
        if (totalInspected > item.returnedQuantity) {
            ctx.addIssue({
                path: [`items.${index}.restockQuantity`],
                message: `Total inspected quantity cannot exceed returned quantity of ${item.returnedQuantity}.`,
                code: z.ZodIssueCode.custom,
            });
             ctx.addIssue({
                path: [`items.${index}.disposalQuantity`],
                message: `Total inspected quantity cannot exceed returned quantity of ${item.returnedQuantity}.`,
                code: z.ZodIssueCode.custom,
            });
        }
    });
});

type ReturnInspectionFormValues = z.infer<typeof returnInspectionSchema>;

const poInspectionItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  sku: z.string(),
  orderedQuantity: z.number(),
  receivedQuantity: z.coerce.number().nonnegative("Must be non-negative"),
});

const poInspectionSchema = z.object({
    items: z.array(poInspectionItemSchema)
}).superRefine((data, ctx) => {
    data.items.forEach((item, index) => {
        if (item.receivedQuantity > item.orderedQuantity) {
             ctx.addIssue({
                path: [`items.${index}.receivedQuantity`],
                message: `Cannot receive more than ${item.orderedQuantity} ordered items.`,
                code: z.ZodIssueCode.custom,
            });
        }
    });
});

type POInspectionFormValues = z.infer<typeof poInspectionSchema>;


export default function QualityControlPage() {
  const { returns, purchaseOrders, loading, refetchData } = useData();
  const { toast } = useToast();
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const returnsAwaitingInspection = useMemo(() => {
    return returns.filter(r => r.status === "Received");
  }, [returns]);
  
  const posAwaitingInspection = useMemo(() => {
    return purchaseOrders.filter(po => po.status === "Delivered");
  }, [purchaseOrders]);
  
  const returnForm = useForm<ReturnInspectionFormValues>({
    resolver: zodResolver(returnInspectionSchema),
  });

  const { fields: returnFields, control: returnControl } = useFieldArray({
    control: returnForm.control,
    name: "items",
  });
  
  const poForm = useForm<POInspectionFormValues>({
    resolver: zodResolver(poInspectionSchema),
  });

  const { fields: poFields, control: poControl } = useFieldArray({
      control: poForm.control,
      name: "items",
  });

  useEffect(() => {
    if (selectedReturn) {
      returnForm.reset({
        items: selectedReturn.items.map(item => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          returnedQuantity: item.quantity,
          restockQuantity: item.quantity,
          disposalQuantity: 0,
        })),
      });
    } else {
        returnForm.reset({ items: [] });
    }
  }, [selectedReturn, returnForm]);

   useEffect(() => {
    if (selectedPO) {
      poForm.reset({
        items: selectedPO.items.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          orderedQuantity: item.quantity,
          receivedQuantity: item.quantity,
        })),
      });
    } else {
      poForm.reset({ items: [] });
    }
  }, [selectedPO, poForm]);


  const onSubmitReturnInspection = async (data: ReturnInspectionFormValues) => {
    if (!selectedReturn) return;

    try {
        await completeInspection(selectedReturn.id, data.items);
        toast({ title: "Success", description: "Return inspection completed and inventory updated." });
        await refetchData();
        setSelectedReturn(null);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };
  
  const onSubmitPOInspection = async (data: POInspectionFormValues) => {
      if (!selectedPO) return;
      try {
          await completePOInspection(selectedPO.id, data.items);
          toast({ title: "Success", description: "PO inspection completed and stock updated." });
          await refetchData();
          setSelectedPO(null);
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
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-headline tracking-tight">Quality Control</h1>
          <p className="text-muted-foreground">Inspect received returns and purchase order arrivals.</p>
        </div>

        <Tabs defaultValue="po-arrivals">
          <TabsList>
            <TabsTrigger value="po-arrivals">Purchase Order Arrivals</TabsTrigger>
            <TabsTrigger value="customer-returns">Customer Returns</TabsTrigger>
          </TabsList>
          <TabsContent value="po-arrivals">
            <Card>
                <CardHeader>
                    <CardTitle>PO Arrivals Awaiting Inspection</CardTitle>
                    <CardDescription>Purchase orders that have been delivered and are ready for inspection.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PO #</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Date Delivered</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : posAwaitingInspection.length > 0 ? (
                                posAwaitingInspection.map((po) => (
                                    <TableRow key={po.id}>
                                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                                        <TableCell>{po.supplier.name}</TableCell>
                                        <TableCell>{formatDate(po.receivedDate)}</TableCell>
                                        <TableCell>{po.items.reduce((acc, item) => acc + item.quantity, 0)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedPO(po)}>Inspect</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">No PO arrivals are currently awaiting inspection.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="customer-returns">
            <Card>
              <CardHeader>
                <CardTitle>Returns Awaiting Inspection</CardTitle>
                <CardDescription>Customer returns that have been received and are ready for evaluation.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RMA #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issuance #</TableHead>
                      <TableHead>Date Received</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : returnsAwaitingInspection.length > 0 ? (
                      returnsAwaitingInspection.map((ret) => (
                        <TableRow key={ret.id}>
                          <TableCell className="font-medium">{ret.rmaNumber}</TableCell>
                          <TableCell>{ret.client.clientName}</TableCell>
                          <TableCell>{ret.issuanceNumber}</TableCell>
                          <TableCell>{formatDate(ret.dateReceived)}</TableCell>
                          <TableCell>{ret.items.reduce((acc, item) => acc + item.quantity, 0)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setSelectedReturn(ret)}>Inspect</Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">No returns are currently awaiting inspection.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedReturn && (
        <Dialog open={!!selectedReturn} onOpenChange={(open) => !open && setSelectedReturn(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Inspect Return: {selectedReturn.rmaNumber}</DialogTitle>
              <DialogDescription>
                For each item, specify the quantity to restock and the quantity for disposal.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={returnForm.handleSubmit(onSubmitReturnInspection)}>
              <div className="py-4">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="w-24 text-center">Returned</TableHead>
                            <TableHead className="w-32">For Restock</TableHead>
                            <TableHead className="w-32">For Disposal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {returnFields.map((field, index) => (
                             <TableRow key={field.id}>
                                <TableCell>
                                    <p className="font-medium">{field.name}</p>
                                    <p className="text-xs text-muted-foreground">{field.sku}</p>
                                </TableCell>
                                <TableCell className="text-center">{field.returnedQuantity}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        {...returnForm.register(`items.${index}.restockQuantity`)}
                                    />
                                </TableCell>
                                 <TableCell>
                                    <Input
                                        type="number"
                                        {...returnForm.register(`items.${index}.disposalQuantity`)}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
                  {returnForm.formState.errors.items && (
                      <p className="text-sm text-destructive mt-4 px-1">{returnForm.formState.errors.items.root?.message}</p>
                   )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelectedReturn(null)}>Cancel</Button>
                <Button type="submit" disabled={returnForm.formState.isSubmitting}>
                    {returnForm.formState.isSubmitting ? "Processing..." : "Complete Inspection"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {selectedPO && (
        <Dialog open={!!selectedPO} onOpenChange={(open) => !open && setSelectedPO(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Inspect PO Arrival: {selectedPO.poNumber}</DialogTitle>
              <DialogDescription>
                Confirm the quantity of items received for this purchase order.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={poForm.handleSubmit(onSubmitPOInspection)}>
              <div className="py-4">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="w-24 text-center">Ordered</TableHead>
                            <TableHead className="w-32">Received</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {poFields.map((field, index) => (
                             <TableRow key={field.id}>
                                <TableCell>
                                    <p className="font-medium">{field.name}</p>
                                    <p className="text-xs text-muted-foreground">{field.sku}</p>
                                </TableCell>
                                <TableCell className="text-center">{field.orderedQuantity}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        {...poForm.register(`items.${index}.receivedQuantity`)}
                                    />
                                    {poForm.formState.errors.items?.[index]?.receivedQuantity && <p className="text-xs text-destructive mt-1">{poForm.formState.errors.items?.[index]?.receivedQuantity?.message}</p>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
                  {poForm.formState.errors.items && (
                      <p className="text-sm text-destructive mt-4 px-1">{poForm.formState.errors.items.root?.message}</p>
                   )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelectedPO(null)}>Cancel</Button>
                <Button type="submit" disabled={poForm.formState.isSubmitting}>
                    {poForm.formState.isSubmitting ? "Processing..." : "Complete Inspection & Add to Stock"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
