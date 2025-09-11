
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
import type { Return } from "@/types";
import { completeInspection } from "@/services/data-service";


const inspectionItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  sku: z.string(),
  returnedQuantity: z.number(),
  restockQuantity: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
  disposalQuantity: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
});

const inspectionSchema = z.object({
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

type InspectionFormValues = z.infer<typeof inspectionSchema>;

export default function QualityControlPage() {
  const { returns, loading, refetchData } = useData();
  const { toast } = useToast();
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);

  const returnsAwaitingInspection = useMemo(() => {
    return returns.filter(r => r.status === "Received");
  }, [returns]);
  
  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionSchema),
  });

  const { fields, control } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  useEffect(() => {
    if (selectedReturn) {
      form.reset({
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
        form.reset({ items: [] });
    }
  }, [selectedReturn, form]);


  const onSubmitInspection = async (data: InspectionFormValues) => {
    if (!selectedReturn) return;

    try {
        await completeInspection(selectedReturn.id, data.items);
        toast({ title: "Success", description: "Inspection completed and inventory updated." });
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
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-headline tracking-tight">Quality Control</h1>
          <p className="text-muted-foreground">Inspect received returns for restocking or disposal.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Awaiting Inspection</CardTitle>
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
            <form onSubmit={form.handleSubmit(onSubmitInspection)}>
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
                        {fields.map((field, index) => (
                             <TableRow key={field.id}>
                                <TableCell>
                                    <p className="font-medium">{field.name}</p>
                                    <p className="text-xs text-muted-foreground">{field.sku}</p>
                                </TableCell>
                                <TableCell className="text-center">{field.returnedQuantity}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        {...form.register(`items.${index}.restockQuantity`)}
                                    />
                                </TableCell>
                                 <TableCell>
                                    <Input
                                        type="number"
                                        {...form.register(`items.${index}.disposalQuantity`)}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
                  {form.formState.errors.items && (
                      <p className="text-sm text-destructive mt-4 px-1">{form.formState.errors.items.root?.message}</p>
                   )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelectedReturn(null)}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Processing..." : "Complete Inspection"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
