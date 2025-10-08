
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, X, Printer, ChevronDown, Truck, RefreshCcw, ChevronsUpDown, Check, FileDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
  DialogClose,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { addIssuance, deleteIssuance, addShipment, initiateReturn, processReturn, updateOrderStatus, addClient } from "@/services/data-service";
import type { Issuance, Product, Order, Return, ReturnItem, Client, MaterialRequisition } from "@/types";
import { format, addDays } from "date-fns";
import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/context/data-context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency";
import { Separator } from "@/components/ui/separator";


const issuanceItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

// We need a way to pass the full product list to the schema for validation
const createIssuanceSchema = (products: Product[]) => z.object({
  clientId: z.string().min(1, "Client is required."),
  orderId: z.string().optional(), // Track the order this issuance is for
  materialRequisitionId: z.string().optional(), // Track the MRF this is for
  receivedBy: z.string().min(1, "Receiver's name is required."),
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

type ReturnFormValues = z.infer<typeof createReturnSchema>;

// Client Schema from clients/page.tsx for the new client dialog
const clientSchema = z.object({
  projectName: z.string().min(1, "Project name is required."),
  clientName: z.string().min(1, "Client name is required."),
  boqNumber: z.string().min(1, "BOQ number is required."),
  address: z.string().min(1, "Address is required."),
});
type ClientFormValues = z.infer<typeof clientSchema>;

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};


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


const QueueRow = ({ order, onIssue }: { order: Order; onIssue: (order: Order) => void; }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <React.Fragment>
            <TableRow>
                <TableCell className="font-medium">{order.id.substring(0, 7)}</TableCell>
                <TableCell>{order.client.clientName}</TableCell>
                <TableCell>{format(order.date, 'PPP')}</TableCell>
                <TableCell>{order.items.length} types</TableCell>
                <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button size="sm" onClick={() => onIssue(order)}>Create Issuance</Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setIsOpen(!isOpen)}>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                        <span className="sr-only">Toggle Details</span>
                    </Button>
                </TableCell>
            </TableRow>
            {isOpen && (
                 <TableRow className="bg-muted/50">
                    <TableCell colSpan={5} className="p-0">
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
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
};

const MRFQueueRow = ({ mrf, onIssue }: { mrf: MaterialRequisition; onIssue: (mrf: MaterialRequisition) => void; }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <React.Fragment>
            <TableRow>
                <TableCell className="font-medium">{mrf.mrfNumber}</TableCell>
                <TableCell>{(mrf.projectRef as any)?.id || 'N/A'}</TableCell>
                <TableCell>{format(mrf.date.toDate(), 'PPP')}</TableCell>
                <TableCell>{mrf.items.length} types</TableCell>
                <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button size="sm" onClick={() => onIssue(mrf)}>Create Issuance</Button>
                     <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setIsOpen(!isOpen)}>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </Button>
                </TableCell>
            </TableRow>
            {isOpen && (
                 <TableRow className="bg-muted/50">
                    <TableCell colSpan={5} className="p-0">
                    <div className="p-4">
                        <h4 className="text-sm font-semibold mb-2">Items for MRF {mrf.mrfNumber}:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {mrf.items.map((item, index) => (
                            <div key={index} className="text-xs flex justify-between items-center bg-background p-2 rounded-md border">
                            <span>{(item.productRef as any)?.name || 'Loading...'}</span>
                            <Badge variant="outline" className="font-mono ml-2">Qty: {item.quantity}</Badge>
                            </div>
                        ))}
                        </div>
                    </div>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
};


export default function IssuancePage() {
  const { issuances, clients, products, orders, materialRequisitions, loading, refetchData } = useData();
  const { toast } = useToast();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  
  const [selectedIssuance, setSelectedIssuance] = useState<Issuance | null>(null);
  const [issuanceForShipment, setIssuanceForShipment] = useState<Issuance | null>(null);
  const [issuanceForReturn, setIssuanceForReturn] = useState<Issuance | null>(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingIssuanceId, setDeletingIssuanceId] = useState<string | null>(null);
  
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
  const [productPopovers, setProductPopovers] = useState<Record<number, boolean>>({});


  const issuanceQueue = useMemo(() => {
    return orders.filter(order => order.status === 'Ready for Issuance');
  }, [orders]);

  const mrfQueue = useMemo(() => {
      return materialRequisitions.filter(mrf => mrf.status === 'Pending');
  }, [materialRequisitions]);

  const issuanceSchema = useMemo(() => createIssuanceSchema(products), [products]);
  const returnSchema = useMemo(() => createReturnSchema(issuanceForReturn), [issuanceForReturn]);

  const form = useForm<IssuanceFormValues>({
    resolver: zodResolver(issuanceSchema),
    defaultValues: {
      clientId: "",
      items: [{ productId: "", quantity: 1 }],
      remarks: "",
      orderId: "",
      materialRequisitionId: "",
      receivedBy: "",
    },
    mode: "onChange",
  });

  const clientForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
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
  
  const watchedIssuanceItems = form.watch('items');
  const issuanceTotal = useMemo(() => {
    return watchedIssuanceItems.reduce((total, item) => {
      const product = products.find(p => p.id === item.productId);
      return total + (product ? product.price * (item.quantity || 0) : 0);
    }, 0);
  }, [watchedIssuanceItems, products]);
  
  const watchedReturnItems = returnForm.watch('items');
  const returnTotal = useMemo(() => {
    if (!watchedReturnItems) return 0;
    return watchedReturnItems.reduce((total, item) => {
        if (!item.selected || !item.returnQuantity) return total;
        const product = products.find(p => p.id === item.productId);
        return total + (product ? product.price * item.returnQuantity : 0);
    }, 0);
  }, [watchedReturnItems, products]);


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
        materialRequisitionId: "",
        receivedBy: "",
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
  
   useEffect(() => {
    if (!isAddClientOpen) {
      clientForm.reset();
    }
  }, [isAddClientOpen, clientForm]);

  useEffect(() => {
    const issuanceId = searchParams.get('id');
    if(issuanceId && issuances.length > 0) {
      const issuance = issuances.find(iss => iss.id === issuanceId);
      if(issuance) {
        setSelectedIssuance(issuance);
      }
    }
  }, [searchParams, issuances]);


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

  const onAddClientSubmit = async (data: ClientFormValues) => {
    try {
      await addClient(data);
      toast({ title: "Success", description: "Client added successfully." });
      setIsAddClientOpen(false);
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add client. Please try again.",
      });
    }
  };


  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const headers = ["Issuance #", "Client", "Project", "Date", "Issued By", "Received By", "Items", "Total Value"];
    const rows = issuances.map(iss => {
        const itemsSummary = iss.items.map(i => `${i.quantity}x ${i.product.name}`).join('; ');
        const totalValue = iss.items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
        return [
            iss.issuanceNumber,
            `"${iss.client.clientName.replace(/"/g, '""')}"`,
            `"${iss.client.projectName.replace(/"/g, '""')}"`,
            format(iss.date, 'yyyy-MM-dd'),
            iss.issuedBy,
            iss.receivedBy || 'N/A',
            `"${itemsSummary}"`,
            totalValue
        ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(',') + "\n" 
        + rows.join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "issuance-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

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
      receivedBy: "",
    });
    setIsAddDialogOpen(true);
  };
  
  const handleCreateIssuanceFromMRF = async (mrf: MaterialRequisition) => {
    for (const item of mrf.items) {
      const product = products.find(p => p.id === (item.productRef as any).id);
      if (!product || product.stock < item.quantity) {
        toast({
          variant: "destructive",
          title: "Insufficient Stock",
          description: `Cannot issue for MRF ${mrf.mrfNumber}. Item "${(item.productRef as any).name}" has insufficient stock.`,
        });
        return;
      }
    }

    form.reset({
      clientId: (mrf.projectRef as any).id,
      materialRequisitionId: mrf.id,
      items: mrf.items.map(item => ({
        productId: (item.productRef as any).id,
        quantity: item.quantity,
      })),
      remarks: `For MRF #${mrf.mrfNumber}`,
      receivedBy: "",
    });
    setIsAddDialogOpen(true);
  };


  const formatDate = (date: Date) => format(date, 'PPpp');
  
  return (
    <>
    <div className="space-y-4">
      <Tabs defaultValue="orders-queue">
        <TabsList>
            <TabsTrigger value="orders-queue">Orders Queue</TabsTrigger>
            <TabsTrigger value="mrf-queue">MRF Queue</TabsTrigger>
        </TabsList>
        <TabsContent value="orders-queue">
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
                            <QueueRow key={order.id} order={order} onIssue={handleCreateIssuanceFromOrder} />
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
        </TabsContent>
        <TabsContent value="mrf-queue">
             <Card>
                <CardHeader>
                <CardTitle>Material Requisition Queue</CardTitle>
                <CardDescription>Pending requests from production for warehouse issuance.</CardDescription>
                </CardHeader>
                <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>MRF #</TableHead>
                            <TableHead>Project</TableHead>
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
                        ) : mrfQueue.length > 0 ? (
                        mrfQueue.map((mrf) => (
                            <MRFQueueRow key={mrf.id} mrf={mrf} onIssue={handleCreateIssuanceFromMRF} />
                        ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                No pending material requisitions.
                            </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      
      <Card className="printable-content">
      <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Material Issuance History</CardTitle>
          <CardDescription>Track all materials issued to clients/projects.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1 print-hidden" onClick={handleExport}>
                <FileDown />
                Export to CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1 print-hidden" onClick={() => window.print()}>
                <Printer />
                Print Report
            </Button>
             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild className="print-hidden">
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
                             <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                        disabled={!!form.getValues('orderId') || !!form.getValues('materialRequisitionId')}
                                    >
                                        {field.value
                                            ? clients.find(c => c.id === field.value)?.clientName
                                            : "Select a client"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search client..." />
                                        <CommandEmpty>
                                            <Button variant="ghost" className="w-full" onClick={() => { setIsClientPopoverOpen(false); setIsAddClientOpen(true); }}>
                                                Add new client
                                            </Button>
                                        </CommandEmpty>
                                        <CommandList>
                                            <CommandGroup>
                                                {clients.map(c => (
                                                    <CommandItem
                                                        key={c.id}
                                                        value={c.id}
                                                        onSelect={(currentValue) => {
                                                            field.onChange(currentValue === field.value ? "" : currentValue)
                                                            setIsClientPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                field.value === c.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {c.clientName} - {c.projectName}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                     />
                    {form.formState.errors.clientId && <p className="text-sm text-destructive">{form.formState.errors.clientId.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                      <Label htmlFor="receivedBy">Received By</Label>
                      <Input id="receivedBy" {...form.register("receivedBy")} placeholder="Enter the full name of the recipient" />
                      {form.formState.errors.receivedBy && <p className="text-sm text-destructive">{form.formState.errors.receivedBy.message}</p>}
                  </div>

                  <div className="space-y-2">
                     <div className="flex justify-between items-center">
                        <Label>Items to Issue</Label>
                    </div>
                    <div className="space-y-4">
                      {fields.map((field, index) => {
                        const selectedProductId = form.watch(`items.${index}.productId`);
                        const selectedProduct = products.find(p => p.id === selectedProductId);
                        const lineSubtotal = selectedProduct ? selectedProduct.price * (form.watch(`items.${index}.quantity`) || 0) : 0;

                        return (
                          <div key={field.id} className="space-y-2">
                            <div className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
                                <div className="flex flex-col gap-1">
                                    <Controller
                                        control={form.control}
                                        name={`items.${index}.productId`}
                                        render={({ field: controllerField }) => (
                                            <Popover open={productPopovers[index]} onOpenChange={(open) => setProductPopovers(prev => ({...prev, [index]: open}))}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn("w-full justify-between", !controllerField.value && "text-muted-foreground")}
                                                        disabled={!!form.getValues('orderId') || !!form.getValues('materialRequisitionId')}
                                                    >
                                                        {controllerField.value ? products.find(p => p.id === controllerField.value)?.name : "Select a product"}
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
                                                                        value={p.id}
                                                                        onSelect={(currentValue) => {
                                                                            controllerField.onChange(currentValue === controllerField.value ? "" : currentValue)
                                                                            setProductPopovers(prev => ({...prev, [index]: false}))
                                                                        }}
                                                                        disabled={p.stock === 0}
                                                                    >
                                                                        <div className="flex items-center justify-between w-full">
                                                                            <div className="flex items-center">
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        controllerField.value === p.id ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                {p.name}
                                                                            </div>
                                                                            <span className="ml-auto text-xs text-muted-foreground">
                                                                                Stock: {p.stock}
                                                                            </span>
                                                                        </div>
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
                                        {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                                        readOnly={!!form.getValues('orderId') || !!form.getValues('materialRequisitionId')}
                                    />
                                    {form.formState.errors.items?.[index]?.quantity ? (
                                        <p className="text-sm text-destructive">{form.formState.errors.items?.[index]?.quantity?.message}</p>
                                    ) : selectedProduct ? (
                                        <span className="text-xs text-muted-foreground pl-1">Available: {selectedProduct.stock}</span>
                                    ) : null
                                }
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => !form.getValues('orderId') && !form.getValues('materialRequisitionId') && remove(index)} disabled={!!form.getValues('orderId') || !!form.getValues('materialRequisitionId')}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            {selectedProduct && (
                                <div className="flex justify-between items-center text-xs text-muted-foreground pl-1 pr-12">
                                    <span>Value: {formatCurrency(selectedProduct.price)}</span>
                                    <span>Subtotal: {formatCurrency(lineSubtotal)}</span>
                                </div>
                            )}
                            </div>
                        );
                       })}
                    </div>
                     {form.formState.errors.items && typeof form.formState.errors.items === 'object' && !Array.isArray(form.formState.errors.items) && <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1 })} disabled={!!form.getValues('orderId') || !!form.getValues('materialRequisitionId')}>
                      <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="remarks">Remarks</Label>
                      <Textarea id="remarks" {...form.register("remarks")} placeholder="Optional notes about this issuance..." />
                    </div>
                <Separator />
                <div className="flex justify-end items-center gap-4 pr-12">
                    <span className="font-semibold">Total Issuance Value:</span>
                    <span className="font-bold text-lg">{formatCurrency(issuanceTotal)}</span>
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
        </div>
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
              <TableHead className="print-hidden">
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
                  <TableCell className="print-hidden"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
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
                   <TableCell className="text-right print-hidden">
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
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <strong>Issued By:</strong>
                    <p className="text-sm text-muted-foreground">{selectedIssuance.issuedBy}</p>
                </div>
                 <div>
                    <strong>Received By:</strong>
                    <p className="text-sm text-muted-foreground">{selectedIssuance.receivedBy || 'N/A'}</p>
                </div>
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
            <Separator />
             <div className="flex justify-between items-center pr-4">
                <div className="text-sm text-muted-foreground">Select items and quantities for return.</div>
                <div className="flex items-center gap-4">
                    <span className="font-semibold">Total Return Value:</span>
                    <span className="font-bold text-lg">{formatCurrency(returnTotal)}</span>
                </div>
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
                {selectedIssuance && <PrintableIssuanceForm issuance={selectedIssuance} ref={printableRef} />}
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
    
    {/* This is the hidden, printable version of the form. It's only rendered to be available for printing. */}
    <div className="hidden print:block">
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
    
    <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Fill in the details for the new client.</DialogDescription>
            </DialogHeader>
            <form onSubmit={clientForm.handleSubmit(onAddClientSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input 
                    id="projectName" 
                    {...clientForm.register("projectName")} 
                    onChange={(e) => {
                      const { value } = e.target;
                      clientForm.setValue("projectName", toTitleCase(value), { shouldValidate: true });
                    }}
                  />
                  {clientForm.formState.errors.projectName && <p className="text-sm text-destructive">{clientForm.formState.errors.projectName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input 
                    id="clientName" 
                    {...clientForm.register("clientName")} 
                    onChange={(e) => {
                      const { value } = e.target;
                      clientForm.setValue("clientName", toTitleCase(value), { shouldValidate: true });
                    }}
                  />
                  {clientForm.formState.errors.clientName && <p className="text-sm text-destructive">{clientForm.formState.errors.clientName.message}</p>}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="boqNumber">BOQ Number</Label>
                  <Input 
                    id="boqNumber" 
                    {...clientForm.register("boqNumber")}
                  />
                  {clientForm.formState.errors.boqNumber && <p className="text-sm text-destructive">{clientForm.formState.errors.boqNumber.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address" 
                    {...clientForm.register("address")}
                   />
                  {clientForm.formState.errors.address && <p className="text-sm text-destructive">{clientForm.formState.errors.address.message}</p>}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={clientForm.formState.isSubmitting}>
                    {clientForm.formState.isSubmitting ? "Adding..." : "Add Client"}
                  </Button>
                </DialogFooter>
              </form>
        </DialogContent>
    </Dialog>
    </>
  );
}

    