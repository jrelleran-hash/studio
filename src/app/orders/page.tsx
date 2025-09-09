

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, X, Plus } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { updateOrderStatus, addOrder, addProduct, updateSupplier, deleteSupplier, addSupplier, deleteOrder, addPurchaseOrder, updatePurchaseOrderStatus } from "@/services/data-service";
import type { Order, Supplier, PurchaseOrder, Product } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { CURRENCY_CONFIG } from "@/config/currency";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/context/data-context";
import { Checkbox } from "@/components/ui/checkbox";


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Fulfilled: "default",
  "Ready for Issuance": "default",
  "Awaiting Purchase": "secondary",
  Shipped: "outline",
  Cancelled: "destructive",
  Pending: "secondary",
  Received: "default",
};

// Order Schemas
const orderItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

const orderSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  items: z.array(orderItemSchema).min(1, "At least one item is required."),
});

type OrderFormValues = z.infer<typeof orderSchema>;

// Purchase Order Schema
const poItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

const poSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required."),
  items: z.array(poItemSchema).min(1, "At least one item is required."),
});

type POFormValues = z.infer<typeof poSchema>;


// Product Schema
const createProductSchema = (isSkuAuto: boolean) => z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative("Price must be a non-negative number.").optional(),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer.").optional(),
  reorderLimit: z.coerce.number().int().nonnegative("Reorder limit must be a non-negative integer."),
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
  email: z.string().email("Invalid email address."),
  phone: z.string().min(1, "Phone number is required."),
  address: z.string().min(1, "Address is required."),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface PurchaseQueueItem {
  productId: string;
  name: string;
  sku: string;
  totalQuantity: number;
  fromOrders: string[];
}


const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};


export default function OrdersAndSuppliersPage() {
  const { orders, clients, products, suppliers, purchaseOrders, loading, refetchData } = useData();
  const [activeTab, setActiveTab] = useState("orders");
  const { toast } = useToast();

  // Dialog states
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isAddPOOpen, setIsAddPOOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [isDeleteSupplierOpen, setIsDeleteSupplierOpen] = useState(false);
  const [isDeleteOrderOpen, setIsDeleteOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReordered, setIsReordered] = useState(false);
  const [purchaseQueueSelection, setPurchaseQueueSelection] = useState<{[key: string]: boolean}>({});


  // Data states
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [poView, setPoView] = useState<'queue' | 'list'>('queue');


  const productSchema = useMemo(() => createProductSchema(autoGenerateSku), [autoGenerateSku]);

  // Forms
  const orderForm = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      clientId: "",
      items: [{ productId: "", quantity: 1 }],
    },
  });
  
  const poForm = useForm<POFormValues>({
    resolver: zodResolver(poSchema),
    defaultValues: {
      supplierId: "",
      items: [{ productId: "", quantity: 1 }],
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
      location: "",
      supplier: "",
    },
  });
  
  const supplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    mode: 'onBlur',
  });

  const editSupplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    mode: 'onBlur',
  });

  const { fields, append, remove } = useFieldArray({
    control: orderForm.control,
    name: "items",
  });
  
  const { fields: poFields, append: poAppend, remove: poRemove } = useFieldArray({
    control: poForm.control,
    name: "items",
  });

  const purchaseQueue = useMemo((): PurchaseQueueItem[] => {
    const queue: { [key: string]: PurchaseQueueItem } = {};

    orders
      .filter(order => order.status === 'Awaiting Purchase')
      .forEach(order => {
        order.items.forEach(item => {
          const product = item.product;
          if (!queue[product.id]) {
            queue[product.id] = {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              totalQuantity: 0,
              fromOrders: [],
            };
          }
          queue[product.id].totalQuantity += item.quantity;
          queue[product.id].fromOrders.push(order.id.substring(0, 7));
        });
      });
    
    return Object.values(queue);
  }, [orders]);

  const selectedQueueItems = useMemo(() => {
    return purchaseQueue.filter(item => purchaseQueueSelection[item.productId]);
  }, [purchaseQueue, purchaseQueueSelection]);
  
  // Reset dialogs
  useEffect(() => {
    if(!isAddOrderOpen) {
      orderForm.reset({
        clientId: "",
        items: [{ productId: "", quantity: 1 }],
      });
    }
  }, [isAddOrderOpen, orderForm]);
  
  useEffect(() => {
    if (!isAddPOOpen) {
      poForm.reset({
        supplierId: "",
        items: [{ productId: "", quantity: 1 }],
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
  }, [isAddProductOpen, productForm]);

  useEffect(() => {
    if (!isAddSupplierOpen) supplierForm.reset();
  }, [isAddSupplierOpen, supplierForm]);

  useEffect(() => {
    if (editingSupplier) {
      editSupplierForm.reset(editingSupplier);
    } else {
      editSupplierForm.reset();
    }
  }, [editingSupplier, editSupplierForm]);
  
  useEffect(() => {
    if (selectedOrder && selectedOrder.status === 'Cancelled') {
      const alreadyReordered = orders.some(o => o.reorderedFrom === selectedOrder.id);
      setIsReordered(alreadyReordered);
    } else {
      setIsReordered(false);
    }
  }, [selectedOrder, orders]);


  // Order handlers
  const handleStatusChange = async (orderId: string, status: Order["status"]) => {
    try {
      await updateOrderStatus(orderId, status);
      toast({ title: "Success", description: `Order marked as ${status}.` });
      await refetchData(); // Refresh the list
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update order status.",
      });
    }
  };
  
  const handleCancelOrder = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'Cancelled');
      toast({ title: "Success", description: "Order has been cancelled." });
      await refetchData();
      setSelectedOrder(null);
    } catch (error) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to cancel order.",
        });
    }
  };

  const handleReorder = async (order: Order) => {
    try {
        const reorderData = {
            clientId: order.client.id,
            items: order.items.map(item => ({
                productId: item.product.id,
                quantity: item.quantity
            })),
            reorderedFrom: order.id,
        };
        await addOrder(reorderData);
        toast({ title: "Success", description: "Order has been re-created." });
        await refetchData();
        setSelectedOrder(null);
    } catch (error) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to reorder.",
        });
    }
  };

  const handleDeleteOrderClick = (orderId: string) => {
    setDeletingOrderId(orderId);
    setIsDeleteOrderOpen(true);
  };

  const handleDeleteOrderConfirm = async () => {
    if (!deletingOrderId) return;
    try {
      await deleteOrder(deletingOrderId);
      toast({ title: "Success", description: "Order deleted successfully." });
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete order. Please try again.",
      });
    } finally {
      setIsDeleteOrderOpen(false);
      setDeletingOrderId(null);
    }
  };


  const onOrderSubmit = async (data: OrderFormValues) => {
    try {
      await addOrder(data);
      toast({ title: "Success", description: "New order created." });
      setIsAddOrderOpen(false);
      await refetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create order.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };
  
  // Product handler
  const onProductSubmit = async (data: ProductFormValues) => {
    try {
      const productData = { ...data, price: data.price || 0, stock: data.stock || 0 };
      if (autoGenerateSku) {
        const namePart = data.name.substring(0, 3).toUpperCase();
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        productData.sku = `${namePart}-${randomPart}`;
      }
      await addProduct(productData as any);
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
  
  // Supplier handlers
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

  const onEditSupplierSubmit = async (data: SupplierFormValues) => {
    if (!editingSupplier) return;
    try {
      await updateSupplier(editingSupplier.id, data);
      toast({ title: "Success", description: "Supplier updated successfully." });
      setIsEditSupplierOpen(false);
      setEditingSupplier(null);
      await refetchData();
    } catch (error) {
       console.error(error);
       toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update supplier. Please try again.",
      });
    }
  };

  const handleEditSupplierClick = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditSupplierOpen(true);
  };
  
  const handleDeleteSupplierClick = (supplierId: string) => {
    setDeletingSupplierId(supplierId);
    setIsDeleteSupplierOpen(true);
  };

  const handleDeleteSupplierConfirm = async () => {
    if (!deletingSupplierId) return;
    try {
      await deleteSupplier(deletingSupplierId);
      toast({ title: "Success", description: "Supplier deleted successfully." });
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete supplier. Please try again.",
      });
    } finally {
      setIsDeleteSupplierOpen(false);
      setDeletingSupplierId(null);
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

  const handleCreatePOFromQueue = () => {
    const itemsForPO = selectedQueueItems.map(item => ({
      productId: item.productId,
      quantity: item.totalQuantity,
    }));
    poForm.reset({
      supplierId: "",
      items: itemsForPO,
    });
    setIsAddPOOpen(true);
  };

  const handleQueueSelectionChange = (productId: string, checked: boolean) => {
    setPurchaseQueueSelection(prev => ({...prev, [productId]: checked}));
  }

  const handleQueueSelectAll = (checked: boolean) => {
    const newSelection: {[key: string]: boolean} = {};
    if (checked) {
      purchaseQueue.forEach(item => newSelection[item.productId] = true);
    }
    setPurchaseQueueSelection(newSelection);
  }

  const isAllQueueSelected = purchaseQueue.length > 0 && selectedQueueItems.length === purchaseQueue.length;

  const formatDate = (date: Date | Timestamp) => {
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    return format(jsDate, 'PPpp');
  };
  
  const formatDateSimple = (date: Date) => {
    return format(date, 'PPP');
  };

  return (
    <>
    <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <div>
        {activeTab === 'orders' && (
             <Dialog open={isAddOrderOpen} onOpenChange={setIsAddOrderOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" className="gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Add Order
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                    <DialogTitle>Create New Order</DialogTitle>
                    <DialogDescription>Fill in the details to create a new internal order.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={orderForm.handleSubmit(onOrderSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Client / Project</Label>
                        <Select onValueChange={(value) => orderForm.setValue('clientId', value)} defaultValue={orderForm.getValues('clientId')}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a client or project" />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clientName} - {c.projectName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {orderForm.formState.errors.clientId && <p className="text-sm text-destructive">{orderForm.formState.errors.clientId.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Items Requested</Label>
                        </div>
                        <div className="space-y-2">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                            <Select onValueChange={(value) => orderForm.setValue(`items.${index}.productId`, value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    <Separator />
                                    <div
                                    className={cn(
                                        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    )}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setIsAddProductOpen(true);
                                    }}
                                    >
                                        <Plus className="h-4 w-4 mr-2"/> Add New Product
                                    </div>
                                </SelectContent>
                            </Select>
                            <Input 
                                type="number" 
                                placeholder="Qty" 
                                className="w-20"
                                {...orderForm.register(`items.${index}.quantity`)}
                            />
                            <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                                <X className="h-4 w-4" />
                            </Button>
                            </div>
                        ))}
                        </div>
                        {orderForm.formState.errors.items && <p className="text-sm text-destructive">{typeof orderForm.formState.errors.items === 'object' && 'message' in orderForm.formState.errors.items ? orderForm.formState.errors.items.message : 'Please add at least one item.'}</p>}
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1 })}>
                        <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                        </Button>
                    </div>
                    
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddOrderOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={orderForm.formState.isSubmitting}>
                        {orderForm.formState.isSubmitting ? "Creating..." : "Create Order"}
                        </Button>
                    </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        )}
        {activeTab === 'purchase-orders' && (
             <Dialog open={isAddPOOpen} onOpenChange={setIsAddPOOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" className="gap-1">
                    <PlusCircle className="h-4 w-4" />
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {poForm.formState.errors.supplierId && <p className="text-sm text-destructive">{poForm.formState.errors.supplierId.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Items</Label>
                        </div>
                        <div className="space-y-2">
                        {poFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                             <Controller
                                    control={poForm.control}
                                    name={`items.${index}.productId`}
                                    render={({ field: controllerField }) => (
                                        <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value} value={controllerField.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a product" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                        </Select>
                                    )}
                                />
                            <Input 
                                type="number" 
                                placeholder="Qty" 
                                className="w-20"
                                {...poForm.register(`items.${index}.quantity`)}
                            />
                            <Button variant="ghost" size="icon" onClick={() => poRemove(index)}>
                                <X className="h-4 w-4" />
                            </Button>
                            </div>
                        ))}
                        </div>
                        {poForm.formState.errors.items && <p className="text-sm text-destructive">{typeof poForm.formState.errors.items === 'object' && 'message' in poForm.formState.errors.items ? poForm.formState.errors.items.message : 'Please add at least one item.'}</p>}
                        <Button type="button" variant="outline" size="sm" onClick={() => poAppend({ productId: "", quantity: 1 })}>
                        <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                        </Button>
                    </div>
                     <div className="space-y-2">
                        <Label>Status</Label>
                        <p className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                            Pending
                        </p>
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
        )}
        {activeTab === 'suppliers' && (
            <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-4 w-4" />
                  Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Supplier</DialogTitle>
                  <DialogDescription>Fill in the details for the new supplier.</DialogDescription>
                </DialogHeader>
                <form onSubmit={supplierForm.handleSubmit(onAddSupplierSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Supplier Name</Label>
                    <Input id="name" {...supplierForm.register("name")} onChange={(e) => {
                        const { value } = e.target;
                        supplierForm.setValue("name", toTitleCase(value), { shouldValidate: true });
                    }} />
                    {supplierForm.formState.errors.name && <p className="text-sm text-destructive">{supplierForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input id="contactPerson" {...supplierForm.register("contactPerson")} onChange={(e) => {
                        const { value } = e.target;
                        supplierForm.setValue("contactPerson", toTitleCase(value), { shouldValidate: true });
                    }} />
                    {supplierForm.formState.errors.contactPerson && <p className="text-sm text-destructive">{supplierForm.formState.errors.contactPerson.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...supplierForm.register("email")} />
                    {supplierForm.formState.errors.email && <p className="text-sm text-destructive">{supplierForm.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" type="tel" {...supplierForm.register("phone")} />
                    {supplierForm.formState.errors.phone && <p className="text-sm text-destructive">{supplierForm.formState.errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" {...supplierForm.register("address")} />
                    {supplierForm.formState.errors.address && <p className="text-sm text-destructive">{supplierForm.formState.errors.address.message}</p>}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddSupplierOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={supplierForm.formState.isSubmitting}>
                    {supplierForm.formState.isSubmitting ? "Adding..." : "Add Supplier"}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
            </Dialog>
        )}
        </div>
      </div>
      <TabsContent value="orders" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>Manage all internal requisitions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
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
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id} onClick={() => setSelectedOrder(order)} className="cursor-pointer">
                      <TableCell className="font-medium">{order.id.substring(0, 7)}</TableCell>
                      <TableCell>{order.client.clientName}</TableCell>
                      <TableCell>{formatDateSimple(order.date)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[order.status] || "default"}>{order.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
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
                            <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             {order.status === 'Cancelled' ? (
                                <DropdownMenuItem 
                                  onClick={() => handleReorder(order)} 
                                  disabled={isReordered}
                                >
                                  {isReordered ? 'Already Reordered' : 'Reorder'}
                                </DropdownMenuItem>
                            ) : (
                                <>
                                    {order.status !== 'Awaiting Purchase' && order.status !== 'Ready for Issuance' && (
                                        <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Fulfilled')}>
                                            Mark as Fulfilled
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                             <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => handleDeleteOrderClick(order.id)} className="text-destructive">
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
      </TabsContent>
       <TabsContent value="purchase-orders" className="space-y-4">
        <div className="flex items-center gap-2">
            <Button
              variant={poView === 'queue' ? 'default' : 'outline'}
              onClick={() => setPoView('queue')}
            >
              Queue ({purchaseQueue.length})
            </Button>
            <Button
              variant={poView === 'list' ? 'default' : 'outline'}
              onClick={() => setPoView('list')}
            >
              Purchase Orders ({purchaseOrders.length})
            </Button>
        </div>
        
        {poView === 'queue' && (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Purchase Queue</CardTitle>
                            <CardDescription>Items from orders that require purchasing from a supplier.</CardDescription>
                        </div>
                        {selectedQueueItems.length > 0 && (
                            <Button size="sm" className="gap-1" onClick={handleCreatePOFromQueue}>
                                <PlusCircle className="h-4 w-4" />
                                Create Purchase Order ({selectedQueueItems.length})
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-12">
                            <Checkbox
                                checked={isAllQueueSelected}
                                onCheckedChange={(checked) => handleQueueSelectAll(!!checked)}
                                aria-label="Select all"
                            />
                        </TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-center">Needed</TableHead>
                        <TableHead>From Orders</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            </TableRow>
                        ))
                        ) : purchaseQueue.length > 0 ? (
                        purchaseQueue.map((item) => (
                            <TableRow key={item.productId}>
                            <TableCell>
                                <Checkbox
                                    checked={purchaseQueueSelection[item.productId] || false}
                                    onCheckedChange={(checked) => handleQueueSelectionChange(item.productId, !!checked)}
                                    aria-label={`Select ${item.name}`}
                                />
                            </TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell className="text-center">{item.totalQuantity}</TableCell>
                            <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                    {item.fromOrders.map(orderId => (
                                        <Badge key={orderId} variant="secondary" className="font-mono">{orderId}</Badge>
                                    ))}
                                </div>
                            </TableCell>
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No items are currently awaiting purchase.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    </Table>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
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
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      purchaseOrders.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.poNumber}</TableCell>
                          <TableCell>{po.supplier.name}</TableCell>
                          <TableCell>{formatDateSimple(po.orderDate)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[po.status] || "default"}>{po.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Toggle menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {po.status !== 'Received' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handlePOStatusChange(po.id, 'Shipped')}>
                                      Mark as Shipped
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePOStatusChange(po.id, 'Received')}>
                                      Mark as Received
                                    </DropdownMenuItem>
                                  </>
                                )}
                                 {po.status === 'Received' && <DropdownMenuItem disabled>Order Received</DropdownMenuItem>}
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
        )}
      </TabsContent>
      <TabsContent value="suppliers">
        <Card>
           <CardHeader>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>Manage your supplier database.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                    ))
                    ) : (
                    suppliers.map((supplier) => (
                        <TableRow key={supplier.id} onClick={() => handleEditSupplierClick(supplier)} className="cursor-pointer">
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contactPerson}</TableCell>
                        <TableCell>{supplier.email}</TableCell>
                        <TableCell>{supplier.phone}</TableCell>
                        <TableCell>{formatDate(supplier.createdAt)}</TableCell>
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
                                <DropdownMenuItem onClick={() => handleEditSupplierClick(supplier)}>Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteSupplierClick(supplier.id)} className="text-destructive">Delete</DropdownMenuItem>
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
      </TabsContent>
    </Tabs>
    
     <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
       <DialogContent className="sm:max-w-lg">
           <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Fill in the details for the new product.</DialogDescription>
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
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="price-order">Price</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                  <Input id="price-order" type="number" step="0.01" className="pl-8" placeholder="0.00" {...productForm.register("price")} />
                </div>
                {productForm.formState.errors.price && <p className="text-sm text-destructive">{productForm.formState.errors.price.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock-order">Stock</Label>
                <Input id="stock-order" type="number" placeholder="0" {...productForm.register("stock")} />
                {productForm.formState.errors.stock && <p className="text-sm text-destructive">{productForm.formState.errors.stock.message}</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="reorderLimit-order">Reorder Limit</Label>
                <Input id="reorderLimit-order" type="number" placeholder="10" {...productForm.register("reorderLimit")} />
                {productForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{productForm.formState.errors.reorderLimit.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label htmlFor="location-order">Location</Label>
                  <Input id="location-order" placeholder="e.g. 'Warehouse A'" {...productForm.register("location")} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="supplier-order">Supplier</Label>
                  <Input id="supplier-order" placeholder="e.g. 'ACME Inc.'" {...productForm.register("supplier")} />
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

    {selectedOrder && (
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details: {selectedOrder.id.substring(0,7)}</DialogTitle>
            <DialogDescription>
              Client: {selectedOrder.client.clientName} ({selectedOrder.client.projectName})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p><strong>Date:</strong> {formatDateSimple(selectedOrder.date)}</p>
            <p><strong>Total:</strong> {formatCurrency(selectedOrder.total)}</p>
            <p><strong>Status:</strong> <Badge variant={statusVariant[selectedOrder.status] || "default"}>{selectedOrder.status}</Badge></p>
             <p><strong>BOQ Number:</strong> {selectedOrder.client.boqNumber}</p>
            <p><strong>Address:</strong> {selectedOrder.client.address}</p>
            <div>
              <h4 className="font-semibold mt-2">Items:</h4>
              <ul className="list-disc list-inside text-muted-foreground">
                {selectedOrder.items.map(item => (
                   <li key={item.product.id}>{item.quantity} x {item.product.name}</li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter className="!justify-between">
             <div>
                {selectedOrder.status !== 'Cancelled' && (
                    <Button variant="destructive" onClick={() => handleCancelOrder(selectedOrder.id)}>Cancel Order</Button>
                )}
            </div>
            <div className="flex gap-2">
                {selectedOrder.status === 'Cancelled' ? (
                    <Button onClick={() => handleReorder(selectedOrder)} disabled={isReordered}>
                    {isReordered ? 'Already Reordered' : 'Reorder'}
                    </Button>
                ) : (
                    <Button variant="outline" disabled>Edit Order</Button>
                )}
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
      
    {editingSupplier && (
        <Dialog open={isEditSupplierOpen} onOpenChange={(isOpen) => {
            setIsEditSupplierOpen(isOpen);
            if(!isOpen) {
               setEditingSupplier(null);
               editSupplierForm.reset();
            }
        }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Supplier</DialogTitle>
                <DialogDescription>Update the details for {editingSupplier.name}.</DialogDescription>
              </DialogHeader>
              <form onSubmit={editSupplierForm.handleSubmit(onEditSupplierSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Supplier Name</Label>
                  <Input id="edit-name" {...editSupplierForm.register("name")} onChange={(e) => {
                      const { value } = e.target;
                      editSupplierForm.setValue("name", toTitleCase(value), { shouldValidate: true });
                  }} />
                  {editSupplierForm.formState.errors.name && <p className="text-sm text-destructive">{editSupplierForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contactPerson">Contact Person</Label>
                  <Input id="edit-contactPerson" {...editSupplierForm.register("contactPerson")} onChange={(e) => {
                      const { value } = e.target;
                      editSupplierForm.setValue("contactPerson", toTitleCase(value), { shouldValidate: true });
                  }} />
                  {editSupplierForm.formState.errors.contactPerson && <p className="text-sm text-destructive">{editSupplierForm.formState.errors.contactPerson.message}</p>}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" {...editSupplierForm.register("email")} />
                  {editSupplierForm.formState.errors.email && <p className="text-sm text-destructive">{editSupplierForm.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" type="tel" {...editSupplierForm.register("phone")} />
                  {editSupplierForm.formState.errors.phone && <p className="text-sm text-destructive">{editSupplierForm.formState.errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" {...editSupplierForm.register("address")} />
                  {editSupplierForm.formState.errors.address && <p className="text-sm text-destructive">{editSupplierForm.formState.errors.address.message}</p>}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditSupplierOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={editSupplierForm.formState.isSubmitting}>
                    {editSupplierForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
    )}
    
    <AlertDialog open={isDeleteSupplierOpen} onOpenChange={setIsDeleteSupplierOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            supplier from your records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteSupplierConfirm} className={buttonVariants({ variant: "destructive" })}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    
    <AlertDialog open={isDeleteOrderOpen} onOpenChange={setIsDeleteOrderOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            order from your records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteOrderConfirm} className={buttonVariants({ variant: "destructive" })}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
