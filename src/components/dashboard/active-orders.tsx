

"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getRecentOrders, getClients, getProducts, addOrder, addProduct } from "@/services/data-service";
import type { Order, Client, Product } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { PlusCircle, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { CURRENCY_CONFIG } from "@/config/currency";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Fulfilled: "default",
  Processing: "secondary",
  Shipped: "outline",
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

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

export function ActiveOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const { toast } = useToast();
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);

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

   const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      stock: 0,
      reorderLimit: 10,
      location: "",
      supplier: "",
    },
  });

  async function fetchInitialData() {
      try {
        const [fetchedOrders, fetchedClients, fetchedProducts] = await Promise.all([
          getRecentOrders(5),
          getClients(),
          getProducts()
        ]);
        setOrders(fetchedOrders);
        setClients(fetchedClients);
        setProducts(fetchedProducts);
      } catch (error) {
         toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch necessary data.",
        });
      }
    }

  useEffect(() => {
    setLoading(true);
    fetchInitialData().finally(() => setLoading(false));
  }, []);
  
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };
  
  const onOrderSubmit = async (data: OrderFormValues) => {
    try {
      await addOrder({ ...data, status: "Processing" });
      toast({ title: "Success", description: "New order created." });
      setIsAddOrderOpen(false);
      orderForm.reset();
      setLoading(true);
      fetchInitialData().finally(() => setLoading(false));
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
       const productData = { ...data };
      if (autoGenerateSku) {
        // Simple SKU generation logic: first 3 letters of name + random 4 digits
        const namePart = data.name.substring(0, 3).toUpperCase();
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        productData.sku = `\'\'\'${namePart}-${randomPart}\'\'\'`;
      }
      await addProduct(productData as Product);
      toast({ title: "Success", description: "Product added successfully." });
      setIsAddProductOpen(false);
      productForm.reset();
      const fetchedProducts = await getProducts();
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

  return (
    <>
    <Card className="card-gradient">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Active Orders</CardTitle>
          <CardDescription>
            A list of your store's most recent orders.
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
            ) : (
              orders.map((order) => (
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
            )}
          </TableBody>
        </Table>

      </CardContent>
    </Card>

    {selectedOrder && (
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details: {selectedOrder.id}</DialogTitle>
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
          <DialogFooter>
            <Button variant="destructive">Cancel Order</Button>
            <Button variant="outline">Edit Order</Button>
            <Button onClick={() => setSelectedOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-lg">
           <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Fill in the details for the new product.</DialogDescription>
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
                <Label htmlFor="price-dash">Price</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                  <Input id="price-dash" type="number" step="0.01" className="pl-8" placeholder="0.00" {...productForm.register("price")} />
                </div>
                {productForm.formState.errors.price && <p className="text-sm text-destructive">{productForm.formState.errors.price.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock-dash">Stock</Label>
                <Input id="stock-dash" type="number" {...productForm.register("stock")} />
                {productForm.formState.errors.stock && <p className="text-sm text-destructive">{productForm.formState.errors.stock.message}</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="reorderLimit-dash">Reorder Limit</Label>
                <Input id="reorderLimit-dash" type="number" {...productForm.register("reorderLimit")} />
                {productForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{productForm.formState.errors.reorderLimit.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label htmlFor="location-dash">Location</Label>
                  <Input id="location-dash" placeholder="e.g. 'Warehouse A'" {...productForm.register("location")} />
              </div>
               <div className="space-y-2">
                  <Label htmlFor="supplier-dash">Supplier</Label>
                  <Input id="supplier-dash" placeholder="e.g. 'ACME Inc.'" {...productForm.register("supplier")} />
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

    </>
  );
}
