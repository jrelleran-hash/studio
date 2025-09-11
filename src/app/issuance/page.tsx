

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, X, Printer, ChevronDown, Truck, RefreshCcw, ChevronsUpDown, Check } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { addIssuance, deleteIssuance, addShipment, initiateReturn, processReturn, updateOrderStatus } from "@/services/data-service";
import type { Issuance, Product, Order, Return, ReturnItem } from "@/types";
import { format, addDays } from "date-fns";
import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/context/data-context";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogTrigger } from "@/components/ui/dialog";


const issuanceItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

// We need a way to pass the full product list to the schema for validation
const createIssuanceSchema = (products: Product[]) => z.object({
  clientId: z.string().min(1, "Client is required."),
  orderId: z.string().optional(), // Track the order this issuance is for
  items: z.array(issuanceItemSchema)
    .min(1, "At least one item is required.")
    .superRefine((items, ctx) => {
        items.forEach((item, index) => {
            const product = products.find(p => p.id === item.productId);
            if (product && product.stock < item.quantity) {
                ctx.addIssue({
                    path: [`${index}.quantity`],
                    message: `Stock is insufficient. Only ${product.stock} available.`,
                    code: z.ZodIssueCode.custom
                });
            }
        });
    }),
  remarks: z.string().optional(),
});

type IssuanceFormValues = z.infer<ReturnType<typeof createIssuanceSchema>>;

const createShipmentSchema = z.object({
    shippingProvider: z.string().min(1, "Shipping provider is required"),
    trackingNumber: z.string().optional(),
    estimatedDeliveryDate: z.date({
        required_error: "An estimated delivery date is required.",
    }),
});

type ShipmentFormValues = z.infer<typeof createShipmentSchema>;

const createReturnItemSchema = z.object({
    productId: z.string(),
    name: z.string(),
    sku: z.string(),
    issuedQuantity: z.number(),
    returnQuantity: z.coerce.number().nonnegative("Quantity must be non-negative").optional(),
    selected: z.boolean().default(false),
});

const createReturnSchema = (issuance: Issuance | null) => z.object({
    reason: z.string().min(5, "A reason for the return is required."),
    items: z.array(createReturnItemSchema).superRefine((items, ctx) => {
        const isAnyItemSelected = items.some(item => item.selected);
        if (!isAnyItemSelected) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "At least one item must be selected for return.",
                path: [], // Top-level error
            });
            return;
        }

        items.forEach((item, index) => {
            if (item.selected) {
                if (!item.returnQuantity || item.returnQuantity <= 0) {
                    ctx.addIssue({
                        path: [`${index}.returnQuantity`],
                        message: "Quantity must be greater than 0.",
                        code: z.ZodIssueCode.custom,
                    });
                } else if (item.returnQuantity > item.issuedQuantity) {
                    ctx.addIssue({
                        path: [`${index}.returnQuantity`],
                        message: `Cannot return more than ${item.issuedQuantity} issued items.`,
                        code: z.ZodIssueCode.custom,
                    });
                }
            }
        });
    }),
});

type ReturnFormValues = z.infer<ReturnType<typeof createReturnSchema>>;


// Printable Component
const PrintableIssuanceForm = React.forwardRef<HTMLDivElement, { issuance: Issuance }>(({ issuance }, ref) => {
  return (
    <div ref={ref} className="printable-content p-8 bg-white text-black">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
           <h1 className="text-3xl font-bold">Material Issuance</h1>
           <p className="text-gray-600">Issuance #: {issuance.issuanceNumber}</p>
        </div>
        <div className="text-right">
           <p className="text-sm">Date: {format(issuance.date, 'PPP')}</p>
           <p className="text-sm">Issued By: {issuance.issuedBy}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-lg font-semibold mb-2">Issued To</h2>
          <p className="font-bold">{issuance.client.clientName}</p>
          <p>{issuance.client.projectName}</p>
          <p>{issuance.client.address}</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">BOQ Number</h2>
          <p>{issuance.client.boqNumber}</p>
        </div>
      </div>
      
      <h2 className="text-lg font-semibold mb-2">Items Issued</h2>
      <table className="w-full text-left table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">#</th>
            <th className="p-2 border">Product Name</th>
            <th className="p-2 border">SKU</th>
            <th className="p-2 border text-center">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {issuance.items.map((item, index) => (
            <tr key={item.product.id}>
              <td className="p-2 border">{index + 1}</td>
              <td className="p-2 border">{item.product.name}</td>
              <td className="p-2 border">{item.product.sku}</td>
              <td className="p-2 border text-center">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {issuance.remarks && (
        <div className="mt-8">
            <h2 className="text-lg font-semibold mb-2">Remarks</h2>
            <p className="p-2 border bg-gray-50 rounded-md">{issuance.remarks}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-16 mt-24 pt-8">
        <div className="border-t pt-2">
            <p className="text-center">Issued By (Name & Signature)</p>
        </div>
        <div className="border-t pt-2">
            <p className="text-center">Received By (Name & Signature)</p>
        </div>
      </div>
    </div>
  );
});
PrintableIssuanceForm.displayName = "PrintableIssuanceForm";


export default function IssuancePage() {
  const { issuances, clients, products, orders, loading, refetchData } = useData();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  
  const [selectedIssuance, setSelectedIssuance] = useState<Issuance | null>(null);
  const [issuanceForShipment, setIssuanceForShipment] = useState<Issuance | null>(null);
  const [issuanceForReturn, setIssuanceForReturn] = useState<Issuance | null>(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingIssuanceId, setDeletingIssuanceId] = useState<string | null>(null);

  const issuanceQueue = useMemo(() => {
    return orders.filter(order => order.status === 'Ready for Issuance');
  }, [orders]);

  const issuanceSchema = useMemo(() => createIssuanceSchema(products), [products]);
  const returnSchema = useMemo(() => createReturnSchema(issuanceForReturn), [issuanceForReturn]);

  const form = useForm<IssuanceFormValues>({
    resolver: zodResolver(issuanceSchema),
    defaultValues: {
      clientId: "",
      items: [{ productId: "", quantity: 1 }],
      remarks: "",
      orderId: "",
    },
    mode: "onChange",
  });

  const shipmentForm = useForm<ShipmentFormValues>({
    resolver: zodResolver(createShipmentSchema),
    defaultValues: {
      shippingProvider: "",
      trackingNumber: "",
      estimatedDeliveryDate: addDays(new Date(), 7),
    },
  });

  const returnForm = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
   const { fields: returnFields } = useFieldArray({
    control: returnForm.control,
    name: "items",
  });
  
  useEffect(() => {
    if(!isAddDialogOpen) {
      form.reset({
        clientId: "",
        items: [{ productId: "", quantity: 1 }],
        remarks: "",
        orderId: "",
      });
    }
  }, [isAddDialogOpen, form]);
  
  useEffect(() => {
    if(issuanceForShipment) {
      shipmentForm.reset({
        shippingProvider: "",
        trackingNumber: "",
        estimatedDeliveryDate: addDays(new Date(), 7),
      });
      setIsCreateShipmentOpen(true);
    } else {
        setIsCreateShipmentOpen(false);
    }
  }, [issuanceForShipment, shipmentForm]);

  useEffect(() => {
    if (issuanceForReturn) {
      returnForm.reset({
        reason: "",
        items: issuanceForReturn.items.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          issuedQuantity: item.quantity,
          returnQuantity: item.quantity,
          selected: false,
        })),
      });
      setIsReturnDialogOpen(true);
    } else {
      setIsReturnDialogOpen(false);
    }
  }, [issuanceForReturn, returnForm]);


  const onAddSubmit = async (data: IssuanceFormValues) => {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to create an issuance." });
        return;
    }
    try {
      await addIssuance({
          ...data,
          issuedBy: user.displayName || user.email || 'System'
      });
      toast({ title: "Success", description: "New issuance created and inventory updated." });
      setIsAddDialogOpen(false);
      await refetchData(); // Refresh all data
    } catch (error) {
       console.error(error);
       const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        variant: "destructive",
        title: "Error Creating Issuance",
        description: errorMessage,
      });
    }
  };
  
  const onShipmentSubmit = async (data: ShipmentFormValues) => {
    if(!issuanceForShipment) return;
    
    try {
      await addShipment({
          ...data,
          issuanceId: issuanceForShipment.id,
      });
      toast({ title: "Success", description: "New shipment created successfully." });
      setIssuanceForShipment(null);
      await refetchData();
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        toast({
            variant: "destructive",
            title: "Error",
            description: errorMessage,
        });
    }
  };

  const onReturnSubmit = async (data: ReturnFormValues) => {
    if (!issuanceForReturn) return;
    
    const itemsToReturn = data.items
      .filter(item => item.selected && item.returnQuantity)
      .map(item => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: item.returnQuantity!,
      }));
      
    try {
        await initiateReturn({
            issuanceId: issuanceForReturn.id,
            reason: data.reason,
            items: itemsToReturn,
        });
        toast({ title: "Success", description: "Return initiated successfully." });
        setIssuanceForReturn(null);
        await refetchData();
    } catch(error) {
         console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        toast({
            variant: "destructive",
            title: "Error",
            description: errorMessage,
        });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const triggerPreview = (issuance: Issuance) => {
    setSelectedIssuance(issuance);
    setIsPreviewOpen(true);
  }

  const handleDeleteClick = (issuanceId: string) => {
    setDeletingIssuanceId(issuanceId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingIssuanceId) return;
    try {
      await deleteIssuance(deletingIssuanceId);
      toast({ title: "Success", description: "Issuance deleted and stock restored." });
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete issuance.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingIssuanceId(null);
    }
  };
  
  const handleCreateIssuanceFromOrder = async (order: Order) => {
     // Pre-flight check to ensure stock is still available
    for (const item of order.items) {
      const product = products.find(p => p.id === item.product.id);
      if (!product || product.stock < item.quantity) {
        toast({
          variant: "destructive",
          title: "Insufficient Stock",
          description: `Cannot issue order ${order.id.substring(0,7)}. Item "${item.product.name}" has insufficient stock.`,
        });
        // Move order back to "Awaiting Purchase"
        await updateOrderStatus(order.id, 'Awaiting Purchase');
        await refetchData();
        return;
      }
    }

    form.reset({
      clientId: order.client.id,
      orderId: order.id,
      items: order.items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
      remarks: `For Order #${order.id.substring(0, 7)}`,
    });
    setIsAddDialogOpen(true);
  };


  const formatDate = (date: Date) => format(date, 'PPpp');
  
  return (
    <>
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Issuance Queue</CardTitle>
          <CardDescription>Orders with items in stock and ready for material issuance.</CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right w-[140px]">Action</TableHead>
                </TableRow>
              </TableHeader>
                
                <TableBody>
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                ) : issuanceQueue.length > 0 ? (
                  issuanceQueue.map((order) => (
                    <Collapsible asChild key={order.id}>
                      <>
                        <TableRow>
                          <TableCell className="font-medium">{order.id.substring(0, 7)}</TableCell>
                          <TableCell>{order.client.clientName}</TableCell>
                          <TableCell>{format(order.date, 'PPP')}</TableCell>
                          <TableCell>{order.items.length} types</TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-2">
                            <Button size="sm" onClick={() => handleCreateIssuanceFromOrder(order)}>Create Issuance</Button>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-8 h-8">
                                <span className="sr-only">Toggle Details</span>
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <tr className="bg-muted/50">
                            <td colSpan={5} className="p-0">
                              <div className="p-4">
                                <h4 className="text-sm font-semibold mb-2">Items for Order {order.id.substring(0, 7)}:</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {order.items.map(item => (
                                    <div key={item.product.id} className="text-xs flex justify-between items-center bg-background p-2 rounded-md border">
                                        <span>{item.product.name} <span className="text-muted-foreground">({item.product.sku})</span></span>
                                        <Badge variant="outline" className="font-mono ml-2">Qty: {item.quantity}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))
                ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No orders are currently ready for issuance.
                      </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Material Issuance History</CardTitle>
          <CardDescription>Track all materials issued to clients/projects.</CardDescription>
        </div>
         <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              Create Issuance
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Material Issuance</DialogTitle>
              <DialogDescription>Select the items to be issued from inventory.</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Client / Project</Label>
                 <Controller
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={!!form.getValues('orderId')}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a client or project" />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clientName} - {c.projectName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                 />
                {form.formState.errors.clientId && <p className="text-sm text-destructive">{form.formState.errors.clientId.message}</p>}
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between items-center">
                    <Label>Items to Issue</Label>
                </div>
                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const selectedProductId = form.watch(`items.${index}.productId`);
                    const selectedProduct = products.find(p => p.id === selectedProductId);

                    return (
                      <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
                         <div className="flex flex-col gap-1">
                            <Controller
                                control={form.control}
                                name={`items.${index}.productId`}
                                render={({ field: { onChange, value } }) => (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn("w-full justify-between", !value && "text-muted-foreground")}
                                                disabled={!!form.getValues('orderId')}
                                            >
                                                {value ? products.find(p => p.id === value)?.name : "Select a product"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search product..." />
                                                <CommandEmpty>No product found.</CommandEmpty>
                                                <CommandList>
                                                    <CommandGroup>
                                                        {products.map(p => (
                                                            <CommandItem
                                                                key={p.id}
                                                                value={p.name}
                                                                onSelect={() => {
                                                                    onChange(p.id === value ? "" : p.id);
                                                                }}
                                                                disabled={p.stock === 0}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        value === p.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {p.name} (Stock: {p.stock})
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            />
                            {form.formState.errors.items?.[index]?.productId && <p className="text-sm text-destructive">{form.formState.errors.items?.[index]?.productId?.message}</p>}
                        </div>
                        <div className="flex flex-col gap-1">
                            <Input 
                                type="number" 
                                placeholder="Qty" 
                                className="w-24"
                                {...form.register(`items.${index}.quantity`)}
                                readOnly={!!form.getValues('orderId')}
                            />
                            {form.formState.errors.items?.[index]?.quantity ? (
                                <p className="text-sm text-destructive">{form.formState.errors.items?.[index]?.quantity?.message}</p>
                             ) : selectedProduct ? (
                                <span className="text-xs text-muted-foreground pl-1">Available: {selectedProduct.stock}</span>
                             ) : null
                           }
                        </div>
                         <Button variant="ghost" size="icon" onClick={() => !form.getValues('orderId') && remove(index)} disabled={!!form.getValues('orderId')}>
                            <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                   })}
                </div>
                 {form.formState.errors.items && typeof form.formState.errors.items === 'object' && !Array.isArray(form.formState.errors.items) && <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1 })} disabled={!!form.getValues('orderId')}>
                  <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea id="remarks" {...form.register("remarks")} placeholder="Optional notes about this issuance..." />
                </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!form.formState.isValid || form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Issuing..." : "Confirm & Issue"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issuance #</TableHead>
              <TableHead>Client / Project</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items Issued</TableHead>
              <TableHead>Issued By</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (
              issuances.map((issuance) => (
                <TableRow key={issuance.id} onClick={() => setSelectedIssuance(issuance)} className="cursor-pointer">
                  <TableCell className="font-medium">{issuance.issuanceNumber}</TableCell>
                  <TableCell>{issuance.client.clientName} - {issuance.client.projectName}</TableCell>
                  <TableCell>{formatDate(issuance.date)}</TableCell>
                  <TableCell>{issuance.items.reduce((total, item) => total + item.quantity, 0)}</TableCell>
                  <TableCell>{issuance.issuedBy}</TableCell>
                   <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setSelectedIssuance(issuance)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => triggerPreview(issuance)}>
                          <Printer className="mr-2 h-4 w-4" />
                          <span>Print</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIssuanceForShipment(issuance)}>
                          <Truck className="mr-2 h-4 w-4" />
                          <span>Create Shipment</span>
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => setIssuanceForReturn(issuance)}>
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          <span>Process Return</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteClick(issuance.id)} className="text-destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
    
    {selectedIssuance && (
       <Dialog open={!!selectedIssuance} onOpenChange={(open) => !open && setSelectedIssuance(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Issuance Details: {selectedIssuance.issuanceNumber}</DialogTitle>
            <DialogDescription>
              Issued to: {selectedIssuance.client.clientName} ({selectedIssuance.client.projectName})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
             {selectedIssuance.orderId && (
              <div>
                <strong>Original Order:</strong>
                <p className="text-sm text-primary underline">#{selectedIssuance.orderId.substring(0,7)}</p>
              </div>
            )}
            <div>
              <strong>Date Issued:</strong>
              <p className="text-sm text-muted-foreground">{formatDate(selectedIssuance.date)}</p>
            </div>
            <div>
              <strong>Issued By:</strong>
              <p className="text-sm text-muted-foreground">{selectedIssuance.issuedBy}</p>
            </div>
            {selectedIssuance.remarks && (
              <div>
                <strong>Remarks:</strong>
                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">{selectedIssuance.remarks}</p>
              </div>
            )}
            <div>
              <h4 className="font-semibold mb-2">Items Issued:</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedIssuance.items.map(item => (
                   <div key={item.product.id} className="text-sm flex justify-between items-center bg-muted/50 p-2 rounded-md">
                        <span>{item.product.name} <span className="text-xs text-muted-foreground">({item.product.sku})</span></span>
                        <span className="font-mono text-xs">Qty: {item.quantity}</span>
                   </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIssuance(null)}>Close</Button>
            <Button onClick={() => triggerPreview(selectedIssuance)}>
              <Printer className="mr-2 h-4 w-4" />
              Preview & Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    
    <Dialog open={isCreateShipmentOpen} onOpenChange={(isOpen) => { if (!isOpen) setIssuanceForShipment(null) }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create Shipment</DialogTitle>
                <DialogDescription>
                    Create a new shipment for Issuance #{issuanceForShipment?.issuanceNumber}.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={shipmentForm.handleSubmit(onShipmentSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="shippingProvider">Shipping Provider</Label>
                    <Input id="shippingProvider" {...shipmentForm.register("shippingProvider")} />
                    {shipmentForm.formState.errors.shippingProvider && <p className="text-sm text-destructive">{shipmentForm.formState.errors.shippingProvider.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="trackingNumber">Tracking Number (Optional)</Label>
                    <Input id="trackingNumber" {...shipmentForm.register("trackingNumber")} />
                </div>
                <div className="space-y-2">
                     <Label>Estimated Delivery Date</Label>
                     <Controller
                        control={shipmentForm.control}
                        name="estimatedDeliveryDate"
                        render={({ field }) => (
                           <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                        )}
                     />
                    {shipmentForm.formState.errors.estimatedDeliveryDate && <p className="text-sm text-destructive">{shipmentForm.formState.errors.estimatedDeliveryDate.message}</p>}
                </div>
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIssuanceForShipment(null)}>Cancel</Button>
                    <Button type="submit" disabled={shipmentForm.formState.isSubmitting}>
                        {shipmentForm.formState.isSubmitting ? "Creating..." : "Create Shipment"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>

    <Dialog open={isReturnDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setIssuanceForReturn(null) }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>
                Initiate a return for items from Issuance #{issuanceForReturn?.issuanceNumber}.
            </DialogDescription>
        </DialogHeader>
        <form onSubmit={returnForm.handleSubmit(onReturnSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="reason">Reason for Return</Label>
                <Textarea id="reason" {...returnForm.register("reason")} placeholder="e.g., incorrect item, damaged goods, etc." />
                {returnForm.formState.errors.reason && <p className="text-sm text-destructive">{returnForm.formState.errors.reason.message}</p>}
            </div>
            
            <div className="space-y-2">
                 <Label>Items to Return</Label>
                 <div className="border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead className="w-24 text-center">Issued</TableHead>
                                <TableHead className="w-32">Return Qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {returnFields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell>
                                        <Controller
                                            control={returnForm.control}
                                            name={`items.${index}.selected`}
                                            render={({ field: controllerField }) => (
                                                <Checkbox
                                                    checked={controllerField.value}
                                                    onCheckedChange={controllerField.onChange}
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-medium">{field.name}</p>
                                        <p className="text-xs text-muted-foreground">{field.sku}</p>
                                    </TableCell>
                                    <TableCell className="text-center">{field.issuedQuantity}</TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            {...returnForm.register(`items.${index}.returnQuantity`)}
                                            disabled={!returnForm.watch(`items.${index}.selected`)}
                                        />
                                        {returnForm.formState.errors.items?.[index]?.returnQuantity && <p className="text-xs text-destructive mt-1">{returnForm.formState.errors.items?.[index]?.returnQuantity?.message}</p>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
                 {returnForm.formState.errors.items && typeof returnForm.formState.errors.items !== 'object' && <p className="text-sm text-destructive">{returnForm.formState.errors.items.message}</p>}
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIssuanceForReturn(null)}>Cancel</Button>
                <Button type="submit" disabled={returnForm.formState.isSubmitting}>
                    {returnForm.formState.isSubmitting ? "Initiating..." : "Initiate Return"}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl print-hidden">
            <DialogHeader>
                <DialogTitle>Print Preview</DialogTitle>
                <DialogDescription>
                    Review the issuance form before printing.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto border rounded-md my-4">
                {selectedIssuance && <PrintableIssuanceForm issuance={selectedIssuance} />}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Cancel</Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    {/* This is the hidden, printable version of the form */}
    <div className="hidden">
      {selectedIssuance && <PrintableIssuanceForm issuance={selectedIssuance} ref={printableRef} />}
    </div>

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            issuance record and restore the issued items back to inventory.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })}>
            Delete Issuance
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    
