

"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, X, RefreshCcw, ChevronsUpDown, Check, Printer } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
  DialogTrigger,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { addProduct, addSupplier, addPurchaseOrder, updatePurchaseOrderStatus, deletePurchaseOrder, initiateOutboundReturn, addClient } from "@/services/data-service";
import type { Supplier, PurchaseOrder, Product, OutboundReturnItem, Client, Backorder } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { CURRENCY_CONFIG } from "@/config/currency";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useData } from "@/context/data-context";
import { Checkbox } from "@/components/ui/checkbox";
import { validateEmailAction } from "../orders/actions";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CoreFlowLogo } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Completed: "default",
  Pending: "secondary",
  Ordered: "secondary",
  Shipped: "outline",
  Delivered: "outline",
  "PO Shipped": "outline",
  "PO Delivered": "outline",
};

const outboundReturnStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Pending: "secondary",
  Shipped: "outline",
  Completed: "default",
  Cancelled: "destructive",
};

// Purchase Order Schema
const poItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.number().min(1, "Quantity must be at least 1."),
  backorderId: z.string().optional(),
});

const poSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required."),
  clientId: z.string().optional(),
  items: z.array(poItemSchema).min(1, "At least one item is required."),
});

type POFormValues = z.infer<typeof poSchema>;


// Product Schema
const createProductSchema = (isSkuAuto: boolean) => z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative("Price must be a non-negative number.").optional(),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer.").optional(),
  reorderLimit: z.coerce.number().int().nonnegative("Reorder limit must be a non-negative integer.").optional(),
  maxStockLevel: z.coerce.number().int().nonnegative("Max stock must be a non-negative integer.").optional(),
  location: z.string().optional(),
  supplier: z.string().optional(),
}).refine(data => isSkuAuto || (data.sku && data.sku.length > 0), {
    message: "SKU is required when not auto-generated.",
    path: ["sku"],
});

type ProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;

// Supplier Schema
const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone: z.string().min(1, "Phone number is required."),
  cellphoneNumber: z.string().optional(),
  address: z.string().min(1, "Address is required."),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

const outboundReturnItemSchema = z.object({
    productId: z.string(),
    name: z.string(),
    sku: z.string(),
    receivedQuantity: z.number(),
    returnQuantity: z.coerce.number().nonnegative("Quantity must be non-negative").optional(),
    selected: z.boolean().default(false),
});

const createOutboundReturnSchema = (po: PurchaseOrder | null) => z.object({
    reason: z.string().min(5, "A reason for the return is required."),
    items: z.array(outboundReturnItemSchema).superRefine((items, ctx) => {
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
                        path: [`items.${index}.returnQuantity`],
                        message: "Quantity must be greater than 0.",
                        code: z.ZodIssueCode.custom,
                    });
                } else if (item.returnQuantity > item.receivedQuantity) {
                    ctx.addIssue({
                        path: [`items.${index}.returnQuantity`],
                        message: `Cannot return more than ${item.receivedQuantity} received items.`,
                        code: z.ZodIssueCode.custom,
                    });
                }
            }
        });
    }),
});

type OutboundReturnFormValues = z.infer<typeof createOutboundReturnSchema>;

// Client Schema
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


const PrintablePurchaseOrder = React.forwardRef<HTMLDivElement, { po: PurchaseOrder }>(({ po }, ref) => {
  const total = po.items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  return (
    <div ref={ref} className="printable-content p-8 bg-white text-black">
      <div className="flex justify-between items-start mb-8 border-b pb-4">
        <div>
           <div className="flex items-center gap-2 mb-4">
              <CoreFlowLogo className="h-8 w-8 text-black" />
              <h1 className="text-3xl font-bold">Purchase Order</h1>
           </div>
           <p className="text-gray-600">PO Number: {po.poNumber}</p>
        </div>
        <div className="text-right">
           <h2 className="text-lg font-semibold">Modular Majestics</h2>
           <p className="text-sm">27 Morning Glory St. San Isidro, Cainta City Rizal</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-1">Vendor</h3>
          <p className="font-bold">{po.supplier.name}</p>
          <p>{po.supplier.address}</p>
          <p>{po.supplier.contactPerson}</p>
          <p>{po.supplier.email}</p>
        </div>
        <div className="text-right">
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-1">Details</h3>
          <p><span className="font-semibold">Order Date:</span> {format(po.orderDate, 'PPP')}</p>
          <p><span className="font-semibold">Expected Date:</span> {po.expectedDate ? format(po.expectedDate, 'PPP') : 'N/A'}</p>
        </div>
      </div>
      
      <h2 className="text-lg font-semibold mb-2">Items Ordered</h2>
      <table className="w-full text-left table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">#</th>
            <th className="p-2 border">Product Name</th>
            <th className="p-2 border">SKU</th>
            <th className="p-2 border text-center">Quantity</th>
            <th className="p-2 border text-right">Unit Price</th>
            <th className="p-2 border text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((item, index) => (
            <tr key={item.product.id}>
              <td className="p-2 border">{index + 1}</td>
              <td className="p-2 border">{item.product.name}</td>
              <td className="p-2 border">{item.product.sku}</td>
              <td className="p-2 border text-center">{item.quantity}</td>
              <td className="p-2 border text-right">{formatCurrency(item.product.price)}</td>
              <td className="p-2 border text-right">{formatCurrency(item.product.price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
            <tr className="font-bold">
                <td colSpan={5} className="p-2 border text-right">Grand Total</td>
                <td className="p-2 border text-right bg-gray-100">{formatCurrency(total)}</td>
            </tr>
        </tfoot>
      </table>

      <div className="mt-24 pt-8 text-center text-xs text-gray-500">
        <p>Thank you for your business!</p>
        <p>Please include the PO number on all related correspondence and packaging.</p>
      </div>
    </div>
  );
});
PrintablePurchaseOrder.displayName = "PrintablePurchaseOrder";


export default function PurchaseOrdersPage() {
  const { clients, products, suppliers, purchaseOrders, outboundReturns, loading, refetchData, backorders } = useData();
  const { toast } = useToast();

  // Dialog states
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddPOOpen, setIsAddPOOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isDeletePOOpen, setIsDeletePOOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [purchaseQueueSelection, setPurchaseQueueSelection] = useState<{[key: string]: boolean}>({});
  const [poForReturn, setPoForReturn] = useState<PurchaseOrder | null>(null);
  const [poForPrint, setPoForPrint] = useState<PurchaseOrder | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Data states
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [deletingPOId, setDeletingPOId] = useState<string | null>(null);
  const [poView, setPoView] = useState<'queue' | 'list'>('queue');
  
  // Popover states
  const [poSupplierPopover, setPoSupplierPopover] = useState(false);
  const [poClientPopover, setPoClientPopover] = useState(false);
  const [poProductPopovers, setPoProductPopovers] = useState<Record<number, boolean>>({});
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  
  // Refs
  const printableRef = useRef<HTMLDivElement>(null);

  const productSchema = useMemo(() => createProductSchema(autoGenerateSku), [autoGenerateSku]);
  const outboundReturnSchema = useMemo(() => createOutboundReturnSchema(poForReturn), [poForReturn]);

  // Forms
  const poForm = useForm<POFormValues>({
    resolver: zodResolver(poSchema),
    defaultValues: {
      supplierId: "",
      clientId: "",
      items: [{ productId: "", quantity: 1, backorderId: "" }],
    }
  });

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: undefined,
      stock: undefined,
      reorderLimit: 10,
      maxStockLevel: 100,
      location: "",
      supplier: "",
    },
  });
  
  const supplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    mode: 'onBlur',
  });
  
  const clientForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  });

  const outboundReturnForm = useForm<OutboundReturnFormValues>({
    resolver: zodResolver(outboundReturnSchema),
  });

  const { fields: poFields, append: poAppend, remove: poRemove } = useFieldArray({
    control: poForm.control,
    name: "items",
  });

  const { fields: outboundReturnFields } = useFieldArray({
    control: outboundReturnForm.control,
    name: "items",
  });

  const watchedPOItems = poForm.watch();
  const poTotal = useMemo(() => {
    return watchedPOItems.items?.reduce((total, item) => {
      // Using price here as a stand-in for cost. In a real app, you'd have a separate 'cost' field.
      const product = products.find(p => p.id === item.productId);
      return total + (product ? product.price * (item.quantity || 0) : 0);
    }, 0);
  }, [watchedPOItems, products]);
  
  const watchedReturnItems = outboundReturnForm.watch('items');
  const returnTotal = useMemo(() => {
    if (!watchedReturnItems) return 0;
    return watchedReturnItems.reduce((total, item) => {
        if (!item.selected || !item.returnQuantity) return total;
        const product = products.find(p => p.id === item.productId);
        return total + (product ? product.price * item.returnQuantity : 0);
    }, 0);
  }, [watchedReturnItems, products]);


  const { clientOrderQueue, reorderQueue } = useMemo(() => {
    const allClientOrders = backorders.filter(bo => bo.orderId !== 'REORDER');
    const allReorders = backorders.filter(bo => bo.orderId === 'REORDER');
    return {
      clientOrderQueue: allClientOrders,
      reorderQueue: allReorders,
    };
  }, [backorders]);

  const selectedQueueItems = useMemo(() => {
    return backorders.filter(item => purchaseQueueSelection[item.id]);
  }, [backorders, purchaseQueueSelection]);
  
  // Reset dialogs
  useEffect(() => {
    if (!isAddPOOpen) {
      poForm.reset({
        supplierId: "",
        clientId: "",
        items: [{ productId: "", quantity: 1, backorderId: "" }],
      });
      // Clear selection after closing PO dialog
      setPurchaseQueueSelection({});
    }
  }, [isAddPOOpen, poForm]);

  useEffect(() => {
    if(!isAddProductOpen) {
        productForm.reset();
        setAutoGenerateSku(true);
    }
  }, [isAddProductOpen]);

  useEffect(() => {
    if (!isAddSupplierOpen) {
      supplierForm.reset();
    }
  }, [isAddSupplierOpen, supplierForm]);
  
  useEffect(() => {
    if (!isAddClientOpen) {
      clientForm.reset();
    }
  }, [isAddClientOpen, clientForm]);

   useEffect(() => {
    if (poForReturn) {
      outboundReturnForm.reset({
        reason: "",
        items: poForReturn.items.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          receivedQuantity: item.quantity,
          returnQuantity: item.quantity,
          selected: false,
        })),
      });
    } else {
      outboundReturnForm.reset();
    }
  }, [poForReturn, outboundReturnForm]);
  
   useEffect(() => {
    if (isPreviewOpen) {
        const poToPrint = purchaseOrders.find(p => p.id === poForPrint?.id);
        if(poToPrint) setPoForPrint(poToPrint);
    }
  }, [isPreviewOpen, poForPrint, purchaseOrders]);


  // Product handler
  const onProductSubmit = async (data: ProductFormValues) => {
    try {
      const productData: any = { ...data };
      if (autoGenerateSku) {
        const namePart = data.name.substring(0, 3).toUpperCase();
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        productData.sku = `${namePart}-${randomPart}`;
      }
      await addProduct(productData);
      toast({ title: "Success", description: "Product added successfully." });
      setIsAddProductOpen(false);
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add product. Please try again.",
      });
    }
  };
  
  const onAddSupplierSubmit = async (data: SupplierFormValues) => {
    try {
      await addSupplier(data);
      toast({ title: "Success", description: "Supplier added successfully." });
      setIsAddSupplierOpen(false);
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add supplier. Please try again.",
      });
    }
  };
  
  const onAddClientSubmit = async (data: ClientFormValues) => {
    try {
      const docRef = await addClient(data);
      toast({ title: "Success", description: "Client added successfully." });
      setIsAddClientOpen(false);
      await refetchData();
      poForm.setValue('clientId', docRef.id);
      setPoClientPopover(true);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add client. Please try again.",
      });
    }
  };
  
  const onPOSubmit = async (data: POFormValues) => {
    try {
      await addPurchaseOrder(data);
      toast({ title: "Success", description: "New purchase order created." });
      setIsAddPOOpen(false);
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create purchase order.",
      });
    }
  };

  const onOutboundReturnSubmit = async (data: OutboundReturnFormValues) => {
    if (!poForReturn) return;
    
    const itemsToReturn = data.items
      .filter(item => item.selected && item.returnQuantity)
      .map(item => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: item.returnQuantity!,
      }));
      
    try {
        await initiateOutboundReturn({
            purchaseOrderId: poForReturn.id,
            reason: data.reason,
            items: itemsToReturn,
        });
        toast({ title: "Success", description: "Return to supplier initiated." });
        setPoForReturn(null);
        await refetchData();
    } catch(error) {
         console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        toast({
            variant: "destructive",
            title: "Error Initiating Return",
            description: errorMessage,
        });
    }
  };
  
  const handlePOStatusChange = async (poId: string, status: PurchaseOrder["status"]) => {
    try {
      await updatePurchaseOrderStatus(poId, status);
      toast({ title: "Success", description: `Purchase Order marked as ${status}.` });
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update purchase order status.",
      });
    }
  };
  
  const handleDeletePOClick = (poId: string) => {
    setDeletingPOId(poId);
    setIsDeletePOOpen(true);
  };

  const handleDeletePOConfirm = async () => {
    if (!deletingPOId) return;
    try {
      await deletePurchaseOrder(deletingPOId);
      toast({ title: "Success", description: "Purchase Order deleted successfully." });
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete purchase order.",
      });
    } finally {
      setIsDeletePOOpen(false);
      setDeletingPOId(null);
    }
  };

  const handleCreatePOFromQueue = () => {
    if (selectedQueueItems.length === 0) return;

    const itemsForPO = selectedQueueItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      backorderId: item.orderId !== 'REORDER' ? item.id : item.id,
    }));

    // Check if all selected items are for the same client, or for general reorder
    const firstItem = selectedQueueItems[0];
    const isReorder = firstItem.orderId === 'REORDER';
    const firstClientId = (firstItem as any).clientRef?.id;
    const allSameClient = selectedQueueItems.every(item => isReorder ? item.orderId === 'REORDER' : (item as any).clientRef?.id === firstClientId);
    
    const clientId = allSameClient && !isReorder ? firstClientId : "";

    poForm.reset({
      supplierId: "",
      clientId: clientId,
      items: itemsForPO,
    });
    setIsAddPOOpen(true);
  };

  const handleQueueSelectionChange = (id: string, checked: boolean) => {
    setPurchaseQueueSelection(prev => ({...prev, [id]: checked}));
  }

  const handleQueueSelectAll = (checked: boolean, list: Backorder[]) => {
    const newSelection = { ...purchaseQueueSelection };
    list.forEach(item => {
        if(item.status === 'Pending') { // Only allow selecting pending items
            newSelection[item.id] = checked;
        }
    });
    setPurchaseQueueSelection(newSelection);
  }

  const triggerPreview = (po: PurchaseOrder) => {
    setPoForPrint(po);
    setIsPreviewOpen(true);
  }

  const handlePrint = () => {
    window.print();
  };

  const isAllClientQueueSelected = clientOrderQueue.length > 0 && clientOrderQueue.filter(i => i.status === 'Pending').every(item => purchaseQueueSelection[item.id]);
  const isAllReorderQueueSelected = reorderQueue.length > 0 && reorderQueue.filter(i => i.status === 'Pending').every(item => purchaseQueueSelection[item.id]);


  const formatDateSimple = (date: Date | Timestamp) => {
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    return format(jsDate, 'PPP');
  };

  return (
    <>
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Purchase Orders</h1>
        <p className="text-muted-foreground">Manage all purchase orders and items awaiting purchase.</p>
      </div>
       <Dialog open={isAddPOOpen} onOpenChange={setIsAddPOOpen}>
          <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
              <PlusCircle />
              Add Purchase Order
              </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
              <DialogTitle>Create New Purchase Order</DialogTitle>
              <DialogDescription>Fill in the details to create a new PO for a supplier.</DialogDescription>
              </DialogHeader>
              <form onSubmit={poForm.handleSubmit(onPOSubmit)} className="space-y-4">
              <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Controller
                      control={poForm.control}
                      name="supplierId"
                      render={({ field }) => (
                          <Popover open={poSupplierPopover} onOpenChange={setPoSupplierPopover}>
                              <PopoverTrigger asChild>
                                  <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                  >
                                      {field.value
                                          ? suppliers.find(s => s.id === field.value)?.name
                                          : "Select a supplier"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                  <Command>
                                      <CommandInput placeholder="Search supplier..." />
                                      <CommandEmpty>
                                          <Button variant="ghost" className="w-full" onClick={() => { setIsAddSupplierOpen(true); setPoSupplierPopover(false); }}>
                                              Add new supplier
                                          </Button>
                                      </CommandEmpty>
                                      <CommandList>
                                          <CommandGroup>
                                              {suppliers.map(s => (
                                                  <CommandItem
                                                      key={s.id}
                                                      value={s.name}
                                                      onSelect={() => {
                                                          field.onChange(s.id)
                                                          setPoSupplierPopover(false);
                                                      }}
                                                  >
                                                      <Check
                                                          className={cn(
                                                              "mr-2 h-4 w-4",
                                                              field.value === s.id ? "opacity-100" : "opacity-0"
                                                          )}
                                                      />
                                                      {s.name}
                                                  </CommandItem>
                                              ))}
                                          </CommandGroup>
                                      </CommandList>
                                  </Command>
                              </PopoverContent>
                          </Popover>
                      )}
                  />
                  {poForm.formState.errors.supplierId && <p className="text-sm text-destructive">{poForm.formState.errors.supplierId.message}</p>}
              </div>

              <div className="space-y-2">
                  <Label>Client / Project (Optional)</Label>
                  <Controller
                      control={poForm.control}
                      name="clientId"
                      render={({ field }) => (
                          <Popover open={poClientPopover} onOpenChange={setPoClientPopover}>
                              <PopoverTrigger asChild>
                                  <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                      disabled={!!poForm.getValues('items')?.[0]?.backorderId}
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
                                      <CommandEmpty>No client found.</CommandEmpty>
                                      <CommandList>
                                          <CommandGroup>
                                              {clients.map(c => (
                                                  <CommandItem
                                                      key={c.id}
                                                      value={c.clientName}
                                                      onSelect={() => {
                                                          field.onChange(c.id)
                                                          setPoClientPopover(false);
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
              </div>

              <div className="space-y-2">
                  <div className="flex justify-between items-center">
                      <Label>Items</Label>
                  </div>
                  <div className="space-y-2">
                  {poFields.map((field, index) => {
                      const selectedProductId = watchedPOItems.items?.[index]?.productId;
                      const selectedProduct = products.find(p => p.id === selectedProductId);
                      const lineSubtotal = selectedProduct ? selectedProduct.price * (watchedPOItems.items?.[index]?.quantity || 0) : 0;
                      return (
                          <div key={field.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                          <Controller
                                  control={poForm.control}
                                  name={`items.${index}.productId`}
                                  render={({ field: controllerField }) => (
                                      <Popover open={poProductPopovers[index]} onOpenChange={(open) => setPoProductPopovers(prev => ({...prev, [index]: open}))}>
                                          <PopoverTrigger asChild>
                                              <Button
                                                  variant="outline"
                                                  role="combobox"
                                                  className={cn("w-full justify-between", !controllerField.value && "text-muted-foreground")}
                                                  disabled={!!field.backorderId}
                                              >
                                                  {controllerField.value ? products.find(p => p.id === controllerField.value)?.name : "Select a product"}
                                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                              </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                              <Command>
                                                  <CommandInput placeholder="Search product..." />
                                                  <CommandEmpty>
                                                    <Button variant="ghost" className="w-full" onClick={() => setIsAddProductOpen(true)}>
                                                        Add new product
                                                    </Button>
                                                  </CommandEmpty>
                                                  <CommandList>
                                                      <CommandGroup>
                                                          {products.map(p => (
                                                              <CommandItem
                                                                  key={p.id}
                                                                  value={p.name}
                                                                  onSelect={() => {
                                                                      controllerField.onChange(p.id)
                                                                      setPoProductPopovers(prev => ({...prev, [index]: false}));
                                                                  }}
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
                          <Input
                            type="number"
                            placeholder="Qty"
                            className="w-24"
                            {...poForm.register(`items.${index}.quantity`, { valueAsNumber: true })}
                          />
                          <Button variant="ghost" size="icon" onClick={() => poRemove(index)}>
                              <X />
                          </Button>
                          </div>
                          {poForm.formState.errors.items?.[index]?.quantity && <p className="text-sm text-destructive">{poForm.formState.errors.items[index]?.quantity?.message}</p>}
                          {selectedProduct && (
                              <div className="flex justify-between items-center text-xs text-muted-foreground pl-1 pr-12">
                                  <span>Cost: {formatCurrency(selectedProduct.price)}</span>
                                  <span>Subtotal: {formatCurrency(lineSubtotal)}</span>
                              </div>
                          )}
                          </div>
                      )
                  })}
                  </div>
                  {poForm.formState.errors.items && <p className="text-sm text-destructive">{typeof poForm.formState.errors.items === 'object' && 'message' in poForm.formState.errors.items ? poForm.formState.errors.items.message : 'Please add at least one item.'}</p>}
                  <Button type="button" variant="outline" size="sm" onClick={() => poAppend({ productId: "", quantity: 1, backorderId: "" })}>
                  <PlusCircle className="mr-2" /> Add Item
                  </Button>
              </div>
              <div className="space-y-2">
                  <Label>Status</Label>
                  <p className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                      Pending
                  </p>
                  </div>
              <Separator />
              <div className="flex justify-end items-center gap-4 pr-12">
                  <span className="font-semibold">Grand Total:</span>
                  <span className="font-bold text-lg">{formatCurrency(poTotal || 0)}</span>
              </div>

              <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddPOOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={poForm.formState.isSubmitting}>
                  {poForm.formState.isSubmitting ? "Creating..." : "Create Purchase Order"}
                  </Button>
              </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
    </div>
    <div className="space-y-4">
      <div className="flex items-center gap-2">
          <Button
            variant={poView === 'queue' ? 'default' : 'outline'}
            onClick={() => setPoView('queue')}
          >
            Purchase Queue
          </Button>
          <Button
            variant={poView === 'list' ? 'default' : 'outline'}
            onClick={() => setPoView('list')}
          >
            Purchase Orders
          </Button>
      </div>
      
      {poView === 'queue' && (
          <Card>
              <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                          <CardTitle>Purchase Queue</CardTitle>
                          <CardDescription>Items that require purchasing from a supplier.</CardDescription>
                      </div>
                      {selectedQueueItems.length > 0 && (
                          <Button size="sm" className="gap-1" onClick={handleCreatePOFromQueue}>
                              <PlusCircle />
                              Create Purchase Order ({selectedQueueItems.length})
                          </Button>
                      )}
                  </div>
              </CardHeader>
              <CardContent>
                 <Tabs defaultValue="client-orders">
                    <TabsList>
                        <TabsTrigger value="client-orders">Client Orders ({clientOrderQueue.filter(item => item.status === 'Pending').length})</TabsTrigger>
                        <TabsTrigger value="reorder-items">Reorder Items ({reorderQueue.filter(item => item.status === 'Pending').length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="client-orders">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox checked={isAllClientQueueSelected} onCheckedChange={(checked) => handleQueueSelectAll(!!checked, clientOrderQueue)} aria-label="Select all client orders" /></TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead className="text-center">Needed</TableHead>
                                    <TableHead>Source Order</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 2 }).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                    ))
                                ) : clientOrderQueue.length > 0 ? (
                                    clientOrderQueue.map((item) => (
                                        <TableRow key={item.id} className={cn(item.status !== 'Pending' && 'text-muted-foreground')}>
                                            <TableCell>
                                                <Checkbox 
                                                    checked={purchaseQueueSelection[item.id] || false}
                                                    onCheckedChange={(checked) => handleQueueSelectionChange(item.id, !!checked)}
                                                    disabled={item.status !== 'Pending'}
                                                 />
                                            </TableCell>
                                            <TableCell className="font-medium">{item.productName}</TableCell>
                                            <TableCell>{(item as any).client?.clientName || 'N/A'}</TableCell>
                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                            <TableCell><Badge variant="secondary" className="font-mono">{item.orderId.substring(0,7)}</Badge></TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant[item.status] || 'default'}>
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No client backorders.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="reorder-items">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox checked={isAllReorderQueueSelected} onCheckedChange={(checked) => handleQueueSelectAll(!!checked, reorderQueue)} aria-label="Select all reorder items" /></TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-center">Reorder Qty</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {loading ? (
                                    Array.from({ length: 2 }).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                    ))
                                ) : reorderQueue.length > 0 ? (
                                    reorderQueue.map((item) => (
                                        <TableRow key={item.id} className={cn(item.status !== 'Pending' && 'text-muted-foreground')}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={purchaseQueueSelection[item.id] || false}
                                                    onCheckedChange={(checked) => handleQueueSelectionChange(item.id, !!checked)}
                                                    disabled={item.status !== 'Pending'}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{item.productName}</TableCell>
                                            <TableCell>{item.productSku}</TableCell>
                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant[item.status] || 'default'} className="font-mono">
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No items need reordering.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                 </Tabs>
              </CardContent>
          </Card>
      )}
      
      {poView === 'list' && (
          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders</CardTitle>
              <CardDescription>Manage all purchase orders from suppliers.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Client / Project</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : (
                        purchaseOrders.map((po) => {
                          const associatedReturn = outboundReturns.find(r => r.purchaseOrderId === po.id);
                          const isReturnCompleted = associatedReturn?.status === 'Completed' || associatedReturn?.status === 'Cancelled';
                          const displayStatus = associatedReturn && !isReturnCompleted ? `Return ${associatedReturn.status}` : po.status;
                          const finalVariant = associatedReturn && !isReturnCompleted ? outboundReturnStatusVariant[associatedReturn.status] : statusVariant[po.status];
                          
                          return (
                            <TableRow key={po.id} onClick={() => setSelectedPO(po)} className="cursor-pointer">
                              <TableCell className="font-medium">{po.poNumber}</TableCell>
                              <TableCell>{po.supplier.name}</TableCell>
                              <TableCell>{po.client?.clientName || 'N/A'}</TableCell>
                              <TableCell>{formatDateSimple(po.orderDate)}</TableCell>
                              <TableCell>
                                <Badge variant={finalVariant || "default"}>{displayStatus}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                      <MoreHorizontal />
                                      <span className="sr-only">Toggle menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => setSelectedPO(po)}>View Details</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => triggerPreview(po)}>
                                      <Printer className="mr-2" />
                                      Print PO
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {po.status === 'Pending' && (
                                        <DropdownMenuItem onClick={() => handlePOStatusChange(po.id, 'Shipped')}>
                                        Mark as Shipped
                                        </DropdownMenuItem>
                                    )}
                                    {po.status === 'Shipped' && (
                                        <DropdownMenuItem onClick={() => handlePOStatusChange(po.id, 'Delivered')}>
                                        Mark as Delivered
                                        </DropdownMenuItem>
                                    )}
                                    {po.status === 'Delivered' && <DropdownMenuItem disabled>Awaiting Inspection</DropdownMenuItem>}
                                    {po.status === 'Completed' && (
                                        <DropdownMenuItem onClick={() => setPoForReturn(po)}>
                                          <RefreshCcw className="mr-2" />
                                          Return Items
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDeletePOClick(po.id)} className="text-destructive">
                                        Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-4 md:hidden">
                  {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-4 w-full" /></CardContent></Card>
                      ))
                  ): (
                      purchaseOrders.map((po) => {
                          const associatedReturn = outboundReturns.find(r => r.purchaseOrderId === po.id);
                          const isReturnCompleted = associatedReturn?.status === 'Completed' || associatedReturn?.status === 'Cancelled';
                          const displayStatus = associatedReturn && !isReturnCompleted ? `Return ${associatedReturn.status}` : po.status;
                          const finalVariant = associatedReturn && !isReturnCompleted ? outboundReturnStatusVariant[associatedReturn.status] : statusVariant[po.status];
                          return (
                              <Card key={po.id} onClick={() => setSelectedPO(po)}>
                                  <CardHeader>
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <CardTitle className="text-base">{po.poNumber}</CardTitle>
                                              <CardDescription>{po.supplier.name}</CardDescription>
                                          </div>
                                            <Badge variant={finalVariant || "default"}>{displayStatus}</Badge>
                                      </div>
                                  </CardHeader>
                                  <CardContent>
                                      <p className="text-sm">For: {po.client?.clientName || 'Stock'}</p>
                                  </CardContent>
                                  <CardFooter className="text-xs text-muted-foreground">
                                      Ordered: {formatDateSimple(po.orderDate)}
                                  </CardFooter>
                              </Card>
                          )
                      })
                  )}
                </div>
            </CardContent>
          </Card>
      )}
    </div>
    
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Fill in the details for the new product. Stock will be added once the PO is received.</DialogDescription>
          </DialogHeader>
          <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name-order">Product Name</Label>
              <Input id="name-order" {...productForm.register("name")} onChange={(e) => {
                const { value } = e.target;
                e.target.value = toTitleCase(value);
                productForm.setValue("name", e.target.value);
              }}/>
              {productForm.formState.errors.name && <p className="text-sm text-destructive">{productForm.formState.errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="sku-order">SKU</Label>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Switch id="auto-generate-sku-order" checked={autoGenerateSku} onCheckedChange={setAutoGenerateSku} />
                        <Label htmlFor="auto-generate-sku-order">Auto-generate</Label>
                    </div>
                </div>
                <Input id="sku-order" {...productForm.register("sku")} disabled={autoGenerateSku} placeholder={autoGenerateSku ? "Will be generated" : "Manual SKU"} />
                {productForm.formState.errors.sku && <p className="text-sm text-destructive">{productForm.formState.errors.sku.message}</p>}
              </div>
                <div className="space-y-2">
                <Label htmlFor="price-order">Price (Optional)</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                  <Input id="price-order" type="number" step="0.01" className="pl-8" placeholder="0.00" {...productForm.register("price")} />
                </div>
                {productForm.formState.errors.price && <p className="text-sm text-destructive">{productForm.formState.errors.price.message}</p>}
              </div>
            </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="reorderLimit-order">Reorder Limit</Label>
                <Input id="reorderLimit-order" type="number" placeholder="10" {...productForm.register("reorderLimit")} />
                {productForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{productForm.formState.errors.reorderLimit.message}</p>}
              </div>
                <div className="space-y-2">
                <Label htmlFor="maxStockLevel-order">Max Stock Level</Label>
                <Input id="maxStockLevel-order" type="number" placeholder="100" {...productForm.register("maxStockLevel")} />
                {productForm.formState.errors.maxStockLevel && <p className="text-sm text-destructive">{productForm.formState.errors.maxStockLevel.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location-order">Location</Label>
                  <Input id="location-order" placeholder="e.g. 'Warehouse A'" {...productForm.register("location")} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="supplier-order">Supplier</Label>
                    <Controller
                        control={productForm.control}
                        name="supplier"
                        render={({ field }) => (
                            <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                    >
                                        {field.value || "Select supplier"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search supplier..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                  No supplier found.
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {suppliers.map(s => (
                                                    <CommandItem
                                                        key={s.id}
                                                        value={s.name}
                                                        onSelect={() => {
                                                            field.onChange(s.name);
                                                            setIsSupplierPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", field.value === s.name ? "opacity-100" : "opacity-0")} />
                                                        {s.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                    />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddProductOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={productForm.formState.isSubmitting}>
                {productForm.formState.isSubmitting ? "Adding..." : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    
    <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Fill in the details for the new client.</DialogDescription>
            </DialogHeader>
            <form onSubmit={clientForm.handleSubmit(onAddClientSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName-order">Project Name</Label>
                  <Input 
                    id="projectName-order" 
                    {...clientForm.register("projectName")} 
                    onChange={(e) => {
                      const { value } = e.target;
                      clientForm.setValue("projectName", toTitleCase(value), { shouldValidate: true });
                    }}
                  />
                  {clientForm.formState.errors.projectName && <p className="text-sm text-destructive">{clientForm.formState.errors.projectName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName-order">Client Name</Label>
                  <Input 
                    id="clientName-order" 
                    {...clientForm.register("clientName")} 
                    onChange={(e) => {
                      const { value } = e.target;
                      clientForm.setValue("clientName", toTitleCase(value), { shouldValidate: true });
                    }}
                  />
                  {clientForm.formState.errors.clientName && <p className="text-sm text-destructive">{clientForm.formState.errors.clientName.message}</p>}
                </div>
                  <div className="space-y-2">
                  <Label htmlFor="boqNumber-order">BOQ Number</Label>
                  <Input 
                    id="boqNumber-order" 
                    {...clientForm.register("boqNumber")}
                  />
                  {clientForm.formState.errors.boqNumber && <p className="text-sm text-destructive">{clientForm.formState.errors.boqNumber.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address-order">Address</Label>
                  <Input 
                    id="address-order" 
                    {...clientForm.register("address")}
                    />
                  {clientForm.formState.errors.address && <p className="text-sm text-destructive">{clientForm.formState.errors.address.message}</p>}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddClientOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={clientForm.formState.isSubmitting}>
                    {clientForm.formState.isSubmitting ? "Adding..." : "Add Client"}
                  </Button>
                </DialogFooter>
              </form>
        </DialogContent>
    </Dialog>


    <Dialog open={!!poForReturn} onOpenChange={(open) => !open && setPoForReturn(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
            <DialogTitle>Return to Supplier</DialogTitle>
            <DialogDescription>
                Create a return for items from PO #{poForReturn?.poNumber}.
            </DialogDescription>
        </DialogHeader>
        <form onSubmit={outboundReturnForm.handleSubmit(onOutboundReturnSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="reason">Reason for Return</Label>
                <Textarea id="reason" {...outboundReturnForm.register("reason")} placeholder="e.g., incorrect item, damaged goods, etc." />
                {outboundReturnForm.formState.errors.reason && <p className="text-sm text-destructive">{outboundReturnForm.formState.errors.reason.message}</p>}
            </div>
            
            <div className="space-y-2">
                <Label>Items to Return</Label>
                <div className="border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead className="w-24 text-center">Received</TableHead>
                                <TableHead className="w-32">Return Qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {outboundReturnFields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell>
                                        <Controller
                                            control={outboundReturnForm.control}
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
                                    <TableCell className="text-center">{field.receivedQuantity}</TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            {...outboundReturnForm.register(`items.${index}.returnQuantity`)}
                                            disabled={!outboundReturnForm.watch(`items.${index}.selected`)}
                                        />
                                        {outboundReturnForm.formState.errors.items?.[index]?.returnQuantity && <p className="text-xs text-destructive mt-1">{outboundReturnForm.formState.errors.items?.[index]?.returnQuantity?.message}</p>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {outboundReturnForm.formState.errors.items && typeof outboundReturnForm.formState.errors.items !== 'object' && <p className="text-sm text-destructive">{outboundReturnForm.formState.errors.items.message}</p>}
            </div>
          <Separator />
          <div className="flex justify-between items-center pr-4">
              <div className="text-sm text-muted-foreground">Select items and quantities to return.</div>
              <div className="flex items-center gap-4">
                  <span className="font-semibold">Total Return Value:</span>
                  <span className="font-bold text-lg">{formatCurrency(returnTotal)}</span>
              </div>
          </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPoForReturn(null)}>Cancel</Button>
                <Button type="submit" disabled={outboundReturnForm.formState.isSubmitting}>
                    {outboundReturnForm.formState.isSubmitting ? "Initiating..." : "Initiate Return"}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
        
    <AlertDialog open={isDeletePOOpen} onOpenChange={setIsDeletePOOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            purchase order.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeletePOConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {selectedPO && (
        <Dialog open={!!selectedPO} onOpenChange={(open) => !open && setSelectedPO(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Purchase Order: {selectedPO.poNumber}</DialogTitle>
                    <DialogDescription>
                        Supplier: {selectedPO.supplier.name}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p><strong>Order Date:</strong> {formatDateSimple(selectedPO.orderDate)}</p>
                    <p><strong>Expected Date:</strong> {selectedPO.expectedDate ? formatDateSimple(selectedPO.expectedDate) : 'N/A'}</p>
                      {selectedPO.client && <p><strong>For Client:</strong> {selectedPO.client.clientName}</p>}
                    <p><strong>Status:</strong> <Badge variant={statusVariant[selectedPO.status] || "default"}>{selectedPO.status}</Badge></p>
                    {selectedPO.receivedDate && <p><strong>Date Received:</strong> {formatDateSimple(selectedPO.receivedDate)}</p>}
                    <div>
                        <h4 className="font-semibold mt-2">Items:</h4>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
                            {selectedPO.items.map(item => (
                                <li key={item.product.id}>
                                    {item.quantity} x {item.product.name} ({item.product.sku})
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedPO(null)}>Close</Button>
                    <Button onClick={() => triggerPreview(selectedPO)}>
                        <Printer className="mr-2" />
                        Preview & Print
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )}
    
    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl print-hidden">
            <DialogHeader>
                <DialogTitle>Print Preview</DialogTitle>
                <DialogDescription>
                    Review the purchase order before printing.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto border rounded-md my-4">
                {poForPrint && <PrintablePurchaseOrder po={poForPrint} ref={printableRef} />}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Cancel</Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2" />
                    Print
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    <div className="hidden print:block">
      {poForPrint && <PrintablePurchaseOrder po={poForPrint} ref={printableRef} />}
    </div>
    </>
  );
}


    

    
