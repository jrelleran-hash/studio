

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, X, ChevronsUpDown, Check } from "lucide-react";
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
import { updateOrderStatus, addOrder, addProduct, addSupplier, deleteOrder, addClient } from "@/services/data-service";
import type { Order, Supplier, Product, Client, Backorder, OrderItem } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { CURRENCY_CONFIG } from "@/config/currency";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useData } from "@/context/data-context";
import { Separator } from "@/components/ui/separator";

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Fulfilled: "default",
  "Partially Fulfilled": "default",
  "Ready for Issuance": "default",
  "Awaiting Purchase": "secondary",
  Shipped: "outline",
  Cancelled: "destructive",
  Processing: "secondary",
  Delivered: "default",
  Completed: "default",
  "PO Pending": "secondary",
};

// Order Schemas
const orderItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.number().min(1, "Quantity must be at least 1."),
});

const orderSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  items: z.array(orderItemSchema).min(1, "At least one item is required."),
});

type OrderFormValues = z.infer<typeof orderSchema>;

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


export default function OrdersPage() {
  const { orders, clients, products, suppliers, loading, refetchData } = useData();
  const { toast } = useToast();

  // Dialog states
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isDeleteOrderOpen, setIsDeleteOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReordered, setIsReordered] = useState(false);
  
  // Data states
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  
  // Popover states
  const [orderClientPopover, setOrderClientPopover] = useState(false);
  const [orderProductPopovers, setOrderProductPopovers] = useState<Record<number, boolean>>({});
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  
  const productSchema = useMemo(() => createProductSchema(autoGenerateSku), [autoGenerateSku]);

  // Forms
  const orderForm = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      clientId: "",
      items: [{ productId: "", quantity: 1 }],
    },
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
    if (selectedOrder && selectedOrder.status === 'Cancelled') {
      const alreadyReordered = orders.some(o => o.reorderedFrom === selectedOrder.id);
      setIsReordered(alreadyReordered);
    } else {
      setIsReordered(false);
    }
  }, [selectedOrder, orders]);
  
  // Order handlers
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
  
  const onAddClientSubmit = async (data: ClientFormValues) => {
    try {
      const docRef = await addClient(data);
      toast({ title: "Success", description: "Client added successfully." });
      setIsAddClientOpen(false);
      await refetchData();
      orderForm.setValue('clientId', docRef.id);
      setOrderClientPopover(true);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add client. Please try again.",
      });
    }
  };

  const formatDate = (date: Date | Timestamp) => {
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    return format(jsDate, 'PPpp');
  };
  
  const formatDateSimple = (date: Date | Timestamp) => {
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    return format(jsDate, 'PPP');
  };

  return (
    <>
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Client Orders</h1>
        <p className="text-muted-foreground">Manage all client requisitions.</p>
      </div>
      <Dialog open={isAddOrderOpen} onOpenChange={setIsAddOrderOpen}>
          <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
              <PlusCircle />
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
                  <Controller
                      control={orderForm.control}
                      name="clientId"
                      render={({ field }) => (
                          <Popover open={orderClientPopover} onOpenChange={setOrderClientPopover}>
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
                                      <CommandEmpty>
                                          <Button variant="ghost" className="w-full" onClick={() => { setIsAddClientOpen(true); setOrderClientPopover(false); }}>
                                              Add new client
                                          </Button>
                                      </CommandEmpty>
                                      <CommandList>
                                          <CommandGroup>
                                              {clients.map(c => (
                                                  <CommandItem
                                                      key={c.id}
                                                      value={c.clientName}
                                                      onSelect={() => {
                                                          field.onChange(c.id)
                                                          setOrderClientPopover(false);
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
                      <Label>Items Requested</Label>
                  </div>
                  <div className="space-y-2">
                  {fields.map((field, index) => {
                      const selectedProductId = watchedOrderItems.items?.[index]?.productId;
                      const selectedProduct = products.find(p => p.id === selectedProductId);
                      const lineSubtotal = selectedProduct ? selectedProduct.price * (watchedOrderItems.items?.[index]?.quantity || 0) : 0;
                      
                      return (
                          <div key={field.id} className="space-y-2">
                              <div className="flex items-start gap-2">
                                  <div className="flex-grow">
                                      <Controller
                                          control={orderForm.control}
                                          name={`items.${index}.productId`}
                                          render={({ field: controllerField }) => (
                                              <Popover open={orderProductPopovers[index]} onOpenChange={(open) => setOrderProductPopovers(prev => ({...prev, [index]: open}))}>
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
                                                                              setOrderProductPopovers(prev => ({...prev, [index]: false}));
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
                                    className="w-24 caret-transparent"
                                    onKeyDown={(e) => e.preventDefault()}
                                    {...orderForm.register(`items.${index}.quantity`, { valueAsNumber: true })}
                                  />
                                  <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                                      <X />
                                  </Button>
                              </div>
                              {orderForm.formState.errors.items?.[index]?.quantity && <p className="text-sm text-destructive">{orderForm.formState.errors.items[index]?.quantity?.message}</p>}
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
                  <PlusCircle className="mr-2" /> Add Item
                  </Button>
              </div>

              <Separator />
              
              <div className="flex justify-end items-center gap-4 pr-12">
                  <span className="font-semibold">Grand Total:</span>
                  <span className="font-bold text-lg">{formatCurrency(orderTotal || 0)}</span>
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
    </div>
    <Card>
      <CardHeader>
        <CardTitle>All Orders</CardTitle>
        <CardDescription>A complete history of all requisitions, new and old.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block">
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
                              <MoreHorizontal />
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
                                <></>
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
        </div>
        <div className="grid gap-4 md:hidden">
            {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-4 w-full" /></CardContent></Card>
                ))
            ) : (
                orders.map((order) => (
                    <Card key={order.id} onClick={() => setSelectedOrder(order)}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-base">Order {order.id.substring(0, 7)}</CardTitle>
                                    <CardDescription>{order.client.clientName}</CardDescription>
                                </div>
                                <Badge variant={statusVariant[order.status] || "default"}>{order.status}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="font-semibold">{formatCurrency(order.total)}</p>
                        </CardContent>
                        <CardFooter className="text-xs text-muted-foreground">
                            {formatDateSimple(order.date)}
                        </CardFooter>
                    </Card>
                ))
            )}
        </div>
      </CardContent>
    </Card>
    
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

    {selectedOrder && (
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details: {selectedOrder.id.substring(0,7)}</DialogTitle>
            <DialogDescription>
              Client: {selectedOrder.client.clientName} ({selectedOrder.client.projectName})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p><strong>Date:</strong></p><p className="text-sm text-muted-foreground">{formatDateSimple(selectedOrder.date)}</p></div>
                <div><p><strong>Total:</strong></p><p className="text-sm text-muted-foreground">{formatCurrency(selectedOrder.total)}</p></div>
                <div><p><strong>Status:</strong></p><p><Badge variant={statusVariant[selectedOrder.status] || "default"}>{selectedOrder.status}</Badge></p></div>
                <div><p><strong>BOQ Number:</strong></p><p className="text-sm text-muted-foreground">{selectedOrder.client.boqNumber}</p></div>
            </div>
            <div>
                <p><strong>Address:</strong></p><p className="text-sm text-muted-foreground">{selectedOrder.client.address}</p>
            </div>
            <div>
              <h4 className="font-semibold mt-2">Items Ordered:</h4>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                {selectedOrder.items.map(item => (
                    <li key={item.product.id} className="flex justify-between items-center">
                        <span>{item.quantity} x {item.product.name}</span>
                        <Badge variant={statusVariant[item.status] || "secondary"} className="text-xs">{item.status.replace(/Ready for /g, '')}</Badge>
                    </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter className="!justify-between flex-col-reverse sm:flex-row gap-2">
              <div>
                {selectedOrder.status !== 'Cancelled' && (
                    <Button 
                      variant="destructive" 
                      onClick={() => handleCancelOrder(selectedOrder.id)}
                      disabled={selectedOrder.status === 'Fulfilled' || selectedOrder.status === 'Shipped'}
                    >
                      Cancel Order
                    </Button>
                )}
            </div>
            <div className="flex gap-2">
                {selectedOrder.status === 'Cancelled' ? (
                    <Button onClick={() => handleReorder(selectedOrder)} disabled={isReordered}>
                    {isReordered ? 'Already Reordered' : 'Reorder'}
                    </Button>
                ) : (
                    <></>
                )}
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
      
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

    <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
          <DialogDescription>Fill in the details for the new supplier.</DialogDescription>
        </DialogHeader>
        <form onSubmit={supplierForm.handleSubmit(onAddSupplierSubmit)} className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="name-dash-sup">Supplier Name</Label>
            <Input id="name-dash-sup" {...supplierForm.register("name")} onChange={(e) => {
                const { value } = e.target;
                supplierForm.setValue("name", toTitleCase(value), { shouldValidate: true });
            }} />
            {supplierForm.formState.errors.name && <p className="text-sm text-destructive">{supplierForm.formState.errors.name.message}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="contactPerson-dash-sup">Contact Person</Label>
            <Input id="contactPerson-dash-sup" {...supplierForm.register("contactPerson")} onChange={(e) => {
                const { value } = e.target;
                supplierForm.setValue("contactPerson", toTitleCase(value), { shouldValidate: true });
            }} />
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
          <AlertDialogAction onClick={handleDeleteOrderConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}


    