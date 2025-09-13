

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { addOrder, addProduct, updateOrderStatus, deleteOrder, addSupplier } from "@/services/data-service";
import type { Order, Client, Product, Supplier } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { PlusCircle, X, Plus, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { CURRENCY_CONFIG } from "@/config/currency";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Fulfilled: "default",
  "Ready for Issuance": "default",
  "Awaiting Purchase": "secondary",
  Processing: "secondary",
  Shipped: "outline",
  Cancelled: "destructive",
};

const orderItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

const orderSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  items: z.array(orderItemSchema).min(1, "At least one item is required."),
});

type OrderFormValues = z.infer<typeof orderSchema>;

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

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone: z.string().min(1, "Phone number is required."),
  address: z.string().min(1, "Address is required."),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;


const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

export function ActiveOrders() {
  const { orders, clients, products, suppliers, loading, refetchData } = useData();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isDeleteOrderOpen, setIsDeleteOrderOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);

  const { toast } = useToast();
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [isReordered, setIsReordered] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
  const [productPopovers, setProductPopovers] = useState<Record<number, boolean>>({});
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);

  const activeOrders = useMemo(() => {
    const activeStatuses: Order['status'][] = ["Processing", "Awaiting Purchase", "Ready for Issuance"];
    return orders
        .filter(o => activeStatuses.includes(o.status))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [orders]);


  const productSchema = useMemo(() => createProductSchema(autoGenerateSku), [autoGenerateSku]);

  const orderForm = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      clientId: "",
      items: [{ productId: "", quantity: 1 }],
    },
  });

   const { fields, append, remove } = useFieldArray({
    control: orderForm.control,
    name: "items",
  });
  
  const watchedOrderItems = orderForm.watch();
  const orderTotal = useMemo(() => {
    return watchedOrderItems.items?.reduce((total, item) => {
      const product = products.find(p => p.id === item.productId);
      return total + (product ? product.price * (item.quantity || 0) : 0);
    }, 0);
  }, [watchedOrderItems, products]);


   const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: undefined,
      stock: 0,
      reorderLimit: 10,
      maxStockLevel: 100,
      location: "",
      supplier: "",
    },
  });

  const supplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });
  
  useEffect(() => {
    if (!isAddProductOpen) {
      productForm.reset();
      setAutoGenerateSku(true);
    }
  }, [isAddProductOpen, productForm]);
  
  useEffect(() => {
    if(!isAddOrderOpen) {
      orderForm.reset({
        clientId: "",
        items: [{ productId: "", quantity: 1 }],
      });
    }
  }, [isAddOrderOpen, orderForm]);
  
  useEffect(() => {
    if (!isAddSupplierOpen) {
      supplierForm.reset();
    }
  }, [isAddSupplierOpen, supplierForm]);

  useEffect(() => {
    if (selectedOrder && selectedOrder.status === 'Cancelled') {
      const alreadyReordered = orders.some(o => o.reorderedFrom === selectedOrder.id);
      setIsReordered(alreadyReordered);
    } else {
      setIsReordered(false);
    }
  }, [selectedOrder, orders]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };
  
  const onOrderSubmit = async (data: OrderFormValues) => {
    try {
      await addOrder({ ...data });
      toast({ title: "Success", description: "New order created." });
      setIsAddOrderOpen(false);
      orderForm.reset();
      await refetchData(); 
    } catch (error) {
       console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create order.",
      });
    }
  };

  const onProductSubmit = async (data: ProductFormValues) => {
    try {
       const productData: any = { ...data, stock: 0 };
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
      supplierForm.reset();
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


  return (
    <>
    <Card className="card-gradient">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Active Orders</CardTitle>
          <CardDescription>
            A list of all orders currently in progress.
          </CardDescription>
        </div>
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
              <DialogDescription>Fill in the details to create a new order.</DialogDescription>
            </DialogHeader>
            <form onSubmit={orderForm.handleSubmit(onOrderSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                 <Controller
                    control={orderForm.control}
                    name="clientId"
                    render={({ field }) => (
                        <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
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
                                                    onSelect={(currentValue) => {
                                                        const selectedId = clients.find(client => client.clientName.toLowerCase() === currentValue.toLowerCase())?.id;
                                                        if(selectedId){
                                                            field.onChange(selectedId)
                                                        }
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
                {orderForm.formState.errors.clientId && <p className="text-sm text-destructive">{orderForm.formState.errors.clientId.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>Items</Label>
                </div>
                <div className="space-y-2">
                  {fields.map((field, index) => {
                     const selectedProductId = orderForm.watch(`items.${index}.productId`);
                     const selectedProduct = products.find(p => p.id === selectedProductId);
                     const lineSubtotal = selectedProduct ? selectedProduct.price * (orderForm.watch(`items.${index}.quantity`) || 0) : 0;

                    return (
                        <div key={field.id} className="space-y-2">
                            <div className="flex items-start gap-2">
                                <div className="flex-grow">
                                    <Controller
                                        control={orderForm.control}
                                        name={`items.${index}.productId`}
                                        render={({ field: controllerField }) => (
                                            <Popover open={productPopovers[index]} onOpenChange={(open) => setProductPopovers(prev => ({...prev, [index]: open}))}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn("w-full justify-between", !controllerField.value && "text-muted-foreground")}
                                                    >
                                                        {controllerField.value ? products.find(p => p.id === controllerField.value)?.name : "Select a product"}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search product..." />
                                                        <CommandEmpty>
                                                            <Button variant="ghost" className="w-full" onClick={() => { setProductPopovers(prev => ({...prev, [index]: false})); setIsAddProductOpen(true); }}>
                                                                Add new product
                                                            </Button>
                                                        </CommandEmpty>
                                                        <CommandList>
                                                            <CommandGroup>
                                                                {products.map(p => (
                                                                    <CommandItem
                                                                        key={p.id}
                                                                        value={p.name}
                                                                        onSelect={(currentValue) => {
                                                                            const selectedId = products.find(prod => prod.name.toLowerCase() === currentValue.toLowerCase())?.id
                                                                            if(selectedId) {
                                                                                controllerField.onChange(selectedId)
                                                                            }
                                                                            setProductPopovers(prev => ({...prev, [index]: false}));
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
                                </div>
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
                            {selectedProduct && (
                                <div className="flex justify-between items-center text-xs text-muted-foreground pl-1 pr-12">
                                    <span>Price: {formatCurrency(selectedProduct.price)}</span>
                                    <span>Subtotal: {formatCurrency(lineSubtotal)}</span>
                                </div>
                            )}
                        </div>
                    );
                   })}
                </div>
                 {orderForm.formState.errors.items && <p className="text-sm text-destructive">{typeof orderForm.formState.errors.items === 'object' && 'message' in orderForm.formState.errors.items ? orderForm.formState.errors.items.message : 'Please add at least one item.'}</p>}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1 })}>
                  <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>

               <Separator />
                    
                <div className="flex justify-end items-center gap-4 pr-12">
                    <span className="font-semibold">Grand Total:</span>
                    <span className="font-bold text-lg">{formatCurrency(orderTotal)}</span>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : activeOrders.length > 0 ? (
              activeOrders.map((order) => (
                <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                  <TableCell className="font-medium">{order.id.substring(0, 7)}</TableCell>
                  <TableCell>{order.client.clientName}</TableCell>
                  <TableCell>{formatDate(order.date)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[order.status] || "default"}>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                </TableRow>
              ))
            ) : (
                 <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No active orders at the moment.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>

      </CardContent>
    </Card>

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
            <p><strong>Date:</strong> {formatDate(selectedOrder.date)}</p>
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
                <Button
                    variant="destructive"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOrderClick(selectedOrder.id);
                        setSelectedOrder(null);
                    }}
                >
                    Delete Order
                </Button>
            </div>
            <div className="flex gap-2">
                {selectedOrder.status === 'Cancelled' ? (
                    <Button onClick={() => handleReorder(selectedOrder)} disabled={isReordered}>
                    {isReordered ? 'Already Reordered' : 'Reorder'}
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => handleCancelOrder(selectedOrder.id)}>Cancel Order</Button>
                )}
                <Button onClick={() => setSelectedOrder(null)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-lg">
           <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Fill in the details for the new product. Stock will be added later via a Purchase Order.</DialogDescription>
          </DialogHeader>
          <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name-dash">Product Name</Label>
              <Input id="name-dash" {...productForm.register("name")} onChange={(e) => {
                const { value } = e.target;
                e.target.value = toTitleCase(value);
                productForm.setValue("name", e.target.value);
              }}/>
              {productForm.formState.errors.name && <p className="text-sm text-destructive">{productForm.formState.errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sku-dash">SKU</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch id="auto-generate-sku-dash" checked={autoGenerateSku} onCheckedChange={setAutoGenerateSku} />
                      <Label htmlFor="auto-generate-sku-dash">Auto-generate</Label>
                  </div>
                </div>
                <Input id="sku-dash" {...productForm.register("sku")} disabled={autoGenerateSku} placeholder={autoGenerateSku ? "Will be generated" : "Manual SKU"} />
                {productForm.formState.errors.sku && <p className="text-sm text-destructive">{productForm.formState.errors.sku.message}</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="price-dash">Price (Optional)</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                  <Input id="price-dash" type="number" step="0.01" className="pl-8" placeholder="0.00" {...productForm.register("price")} />
                </div>
                {productForm.formState.errors.price && <p className="text-sm text-destructive">{productForm.formState.errors.price.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                <Label htmlFor="reorderLimit-dash">Reorder Limit</Label>
                <Input id="reorderLimit-dash" type="number" {...productForm.register("reorderLimit")} />
                {productForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{productForm.formState.errors.reorderLimit.message}</p>}
              </div>
               <div className="space-y-2">
                  <Label htmlFor="location-dash">Location (Optional)</Label>
                  <Input id="location-dash" placeholder="e.g. 'Warehouse A'" {...productForm.register("location")} />
              </div>
            </div>
             <div className="space-y-2">
                  <Label htmlFor="supplier-dash">Supplier (Optional)</Label>
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
                                             <Button variant="ghost" className="w-full" onClick={() => { setIsSupplierPopoverOpen(false); setIsAddSupplierOpen(true); }}>
                                                Add new supplier
                                            </Button>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddProductOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={productForm.formState.isSubmitting}>
                {productForm.formState.isSubmitting ? "Adding..." : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>
    
    <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>Fill in the details for the new supplier.</DialogDescription>
            </DialogHeader>
            <form onSubmit={supplierForm.handleSubmit(onAddSupplierSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name-dash-sup">Supplier Name</Label>
                <Input id="name-dash-sup" {...supplierForm.register("name")} />
                {supplierForm.formState.errors.name && <p className="text-sm text-destructive">{supplierForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="contactPerson-dash-sup">Contact Person</Label>
                <Input id="contactPerson-dash-sup" {...supplierForm.register("contactPerson")} />
                {supplierForm.formState.errors.contactPerson && <p className="text-sm text-destructive">{supplierForm.formState.errors.contactPerson.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="email-dash-sup">Email</Label>
                <Input id="email-dash-sup" type="email" {...supplierForm.register("email")} />
                {supplierForm.formState.errors.email && <p className="text-sm text-destructive">{supplierForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone-dash-sup">Phone</Label>
                <Input id="phone-dash-sup" type="tel" {...supplierForm.register("phone")} />
                {supplierForm.formState.errors.phone && <p className="text-sm text-destructive">{supplierForm.formState.errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="address-dash-sup">Address</Label>
                <Input id="address-dash-sup" {...supplierForm.register("address")} />
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

    