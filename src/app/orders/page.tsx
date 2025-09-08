

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { getOrders, updateOrderStatus, getClients, getProducts, addOrder, addProduct, getSuppliers, addSupplier, updateSupplier, deleteSupplier } from "@/services/data-service";
import type { Order, Client, Product, Supplier } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { CURRENCY_CONFIG } from "@/config/currency";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Fulfilled: "default",
  Processing: "secondary",
  Shipped: "outline",
  Cancelled: "destructive"
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

// Product Schema
const createProductSchema = (isSkuAuto: boolean) => z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative("Price must be a non-negative number."),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer."),
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


const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};


export default function OrdersAndSuppliersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Dialog states
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [isDeleteSupplierOpen, setIsDeleteSupplierOpen] = useState(false);

  // Data states
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);

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
  
  const fetchPageData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedClients, fetchedProducts, fetchedSuppliers] = await Promise.all([
        getOrders(),
        getClients(),
        getProducts(),
        getSuppliers()
      ]);
      setOrders(fetchedOrders);
      setClients(fetchedClients);
      setProducts(fetchedProducts);
      setSuppliers(fetchedSuppliers);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch page data.",
      });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);
  
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

  // Order handlers
  const handleStatusChange = async (orderId: string, status: Order["status"]) => {
    try {
      await updateOrderStatus(orderId, status);
      toast({ title: "Success", description: `Order marked as ${status}.` });
      fetchPageData(); // Refresh the list
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update order status.",
      });
    }
  };

  const onOrderSubmit = async (data: OrderFormValues) => {
    try {
      await addOrder({...data, status: "Processing"});
      toast({ title: "Success", description: "New order created." });
      setIsAddOrderOpen(false);
      fetchPageData();
    } catch (error) {
       console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create order.",
      });
    }
  };
  
  // Product handler
  const onProductSubmit = async (data: ProductFormValues) => {
    try {
      const productData = { ...data };
      if (autoGenerateSku) {
        const namePart = data.name.substring(0, 3).toUpperCase();
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        productData.sku = `${namePart}-${randomPart}`;
      }
      await addProduct(productData as Product);
      toast({ title: "Success", description: "Product added successfully." });
      setIsAddProductOpen(false);
      const fetchedProducts = await getProducts(); // Refetch just products
      setProducts(fetchedProducts);
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
      fetchPageData();
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
      fetchPageData();
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
      fetchPageData();
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

  const formatDate = (date: Date | Timestamp) => {
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    return format(jsDate, 'PPpp');
  };

  return (
    <>
    <Tabs defaultValue="orders" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
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
                 <Select onValueChange={(value) => orderForm.setValue('clientId', value)} defaultValue={orderForm.getValues('clientId')}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clientName} - {c.projectName}</SelectItem>)}
                    </SelectContent>
                </Select>
                {orderForm.formState.errors.clientId && <p className="text-sm text-destructive">{orderForm.formState.errors.clientId.message}</p>}
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between items-center">
                    <Label>Items</Label>
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
                                // Prevent the select from closing
                                e.preventDefault();
                                // Open the product dialog
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
              <div className="space-y-2">
                  <Label>Status</Label>
                  <p className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                    Processing
                  </p>
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
      <TabsContent value="orders">
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>Manage all client sales orders.</CardDescription>
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
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id.substring(0, 7)}</TableCell>
                      <TableCell>{order.client.clientName}</TableCell>
                      <TableCell>{formatDate(order.date)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[order.status] || "default"}>{order.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Fulfilled')}>
                              Mark as Fulfilled
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Shipped')}>
                              Mark as Shipped
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Cancelled')}>
                              Cancel Order
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
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
                    <TableHead>
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
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                        </TableRow>
                    ))
                    ) : (
                    suppliers.map((supplier) => (
                        <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contactPerson}</TableCell>
                        <TableCell>{supplier.email}</TableCell>
                        <TableCell>{supplier.phone}</TableCell>
                        <TableCell>{formatDate(supplier.createdAt)}</TableCell>
                        <TableCell>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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

    <Dialog open={isAddSupplierOpen} onOpenChange={(isOpen) => {
        setIsAddSupplierOpen(isOpen);
        if(!isOpen) supplierForm.reset();
    }}>
        <DialogTrigger asChild>
        {/* This button is hidden, we trigger it from the tab bar logic if we want a dedicated button */}
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
    </>
  );
}

