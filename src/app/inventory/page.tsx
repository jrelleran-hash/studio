
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getProducts, addProduct, updateProduct, deleteProduct } from "@/services/data-service";
import type { Product } from "@/types";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CURRENCY_CONFIG } from "@/config/currency";
import { formatCurrency } from "@/lib/currency";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

const createProductSchema = (isSkuAuto: boolean) => z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative("Price must be a non-negative number."),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer."),
  reorderLimit: z.coerce.number().int().nonnegative("Reorder limit must be a non-negative integer."),
  location: z.string().optional(),
}).refine(data => isSkuAuto || (data.sku && data.sku.length > 0), {
    message: "SKU is required when not auto-generated.",
    path: ["sku"],
});


type ProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;
type StatusFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";

const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);

  const productSchema = useMemo(() => createProductSchema(autoGenerateSku), [autoGenerateSku]);

  const addForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: 0,
      stock: 0,
      reorderLimit: 10,
      location: "",
    },
  });

  const editForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  });

  useEffect(() => {
    if (isAddDialogOpen) {
      addForm.reset();
      setAutoGenerateSku(true);
    }
  }, [isAddDialogOpen, addForm]);

  async function fetchProducts() {
    setLoading(true);
    const fetchedProducts = await getProducts();
    setProducts(fetchedProducts);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (editingProduct) {
      editForm.reset(editingProduct);
      setAutoGenerateSku(false); // When editing, default to showing the existing SKU
    }
  }, [editingProduct, editForm]);

   const getStatus = (product: Product): { text: string; variant: "default" | "secondary" | "destructive", className?: string } => {
    if (product.stock === 0) return { text: "Out of Stock", variant: "destructive", className: "font-semibold" };
    if (product.stock <= product.reorderLimit) return { text: "Low Stock", variant: "secondary", className: "bg-destructive/40 text-destructive-foreground border-destructive/50" };
    return { text: "In Stock", variant: "default" };
  };

  const filteredProducts = useMemo(() => {
    if (statusFilter === "all") {
      return products;
    }
    return products.filter(product => {
      const status = getStatus(product);
      if (statusFilter === "in-stock") return status.text === "In Stock";
      if (statusFilter === "low-stock") return status.text === "Low Stock";
      if (statusFilter === "out-of-stock") return status.text === "Out of Stock";
      return true;
    });
  }, [products, statusFilter]);

  
  const onAddSubmit = async (data: ProductFormValues) => {
    try {
      const productData = { ...data };
      if (autoGenerateSku) {
        // Simple SKU generation logic: first 3 letters of name + random 4 digits
        const namePart = data.name.substring(0, 3).toUpperCase();
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        productData.sku = `${namePart}-${randomPart}`;
      }

      await addProduct(productData as Product);
      toast({ title: "Success", description: "Product added successfully." });
      setIsAddDialogOpen(false);
      addForm.reset();
      fetchProducts();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add product. Please try again.",
      });
    }
  };

  const onEditSubmit = async (data: ProductFormValues) => {
    if (!editingProduct) return;
    try {
      await updateProduct(editingProduct.id, data);
      toast({ title: "Success", description: "Product updated successfully." });
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
       console.error(error);
       toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update product. Please try again.",
      });
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (productId: string) => {
    setDeletingProductId(productId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProductId) return;
    try {
      await deleteProduct(deletingProductId);
      toast({ title: "Success", description: "Product deleted successfully." });
      fetchProducts();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete product. Please try again.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingProductId(null);
    }
  };
  
  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    return format(timestamp.toDate(), 'PPpp');
  }


  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>Manage your product inventory.</CardDescription>
            <div className="flex items-center gap-2 mt-4">
              {(["all", "in-stock", "low-stock", "out-of-stock"] as StatusFilter[]).map((filter) => (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter)}
                  className="capitalize"
                >
                  {filter.replace("-", " ")}
                </Button>
              ))}
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>Fill in the details for the new product.</DialogDescription>
              </DialogHeader>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" {...addForm.register("name")} onChange={(e) => {
                    const { value } = e.target;
                    e.target.value = toTitleCase(value);
                    addForm.setValue("name", e.target.value);
                  }}/>
                  {addForm.formState.errors.name && <p className="text-sm text-destructive">{addForm.formState.errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="sku">SKU</Label>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Switch id="auto-generate-sku-add" checked={autoGenerateSku} onCheckedChange={setAutoGenerateSku} />
                            <Label htmlFor="auto-generate-sku-add">Auto-generate</Label>
                        </div>
                    </div>
                    <Input id="sku" {...addForm.register("sku")} disabled={autoGenerateSku} placeholder={autoGenerateSku ? "Will be generated" : "Manual SKU"} />
                    {addForm.formState.errors.sku && <p className="text-sm text-destructive">{addForm.formState.errors.sku.message}</p>}
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                      <Input id="price" type="number" step="0.01" className="pl-8" {...addForm.register("price")} />
                    </div>
                    {addForm.formState.errors.price && <p className="text-sm text-destructive">{addForm.formState.errors.price.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock</Label>
                    <Input id="stock" type="number" {...addForm.register("stock")} />
                    {addForm.formState.errors.stock && <p className="text-sm text-destructive">{addForm.formState.errors.stock.message}</p>}
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="reorderLimit">Reorder Limit</Label>
                    <Input id="reorderLimit" type="number" {...addForm.register("reorderLimit")} />
                    {addForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{addForm.formState.errors.reorderLimit.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="e.g. 'Warehouse A'" {...addForm.register("location")} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={addForm.formState.isSubmitting}>
                    {addForm.formState.isSubmitting ? "Adding..." : "Add Product"}
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
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-12 w-12 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : (
                filteredProducts.map((product) => {
                  const status = getStatus(product);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Image
                          alt={product.name}
                          className="aspect-square rounded-md object-cover"
                          height="48"
                          src={`https://picsum.photos/seed/${product.id}/48/48`}
                          width="48"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{formatCurrency(product.price)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={status.className}>{status.text}</Badge>
                      </TableCell>
                      <TableCell>{product.location}</TableCell>
                       <TableCell>{formatDate(product.lastUpdated)}</TableCell>
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
                            <DropdownMenuItem onClick={() => handleEditClick(product)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteClick(product.id)} className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {editingProduct && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>Update the details for {editingProduct.name}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
               <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name</Label>
                  <Input id="edit-name" {...editForm.register("name")} onChange={(e) => {
                    const { value } = e.target;
                    e.target.value = toTitleCase(value);
                    editForm.setValue("name", e.target.value);
                  }}/>
                  {editForm.formState.errors.name && <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sku">SKU</Label>
                    <Input id="edit-sku" {...editForm.register("sku")} />
                    {editForm.formState.errors.sku && <p className="text-sm text-destructive">{editForm.formState.errors.sku.message}</p>}
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="edit-price">Price</Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                      <Input id="edit-price" type="number" step="0.01" className="pl-8" {...editForm.register("price")} />
                    </div>
                    {editForm.formState.errors.price && <p className="text-sm text-destructive">{editForm.formState.errors.price.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-stock">Stock</Label>
                    <Input id="edit-stock" type="number" {...editForm.register("stock")} />
                    {editForm.formState.errors.stock && <p className="text-sm text-destructive">{editForm.formState.errors.stock.message}</p>}
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="edit-reorderLimit">Reorder Limit</Label>
                    <Input id="edit-reorderLimit" type="number" {...editForm.register("reorderLimit")} />
                    {editForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{editForm.formState.errors.reorderLimit.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input id="edit-location" {...editForm.register("location")} />
                </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              product from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    