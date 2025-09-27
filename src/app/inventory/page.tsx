

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Package, ChevronsUpDown, Check, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { addProduct, updateProduct, deleteProduct, addSupplier } from "@/services/data-service";
import type { Product, Supplier } from "@/types";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CURRENCY_CONFIG } from "@/config/currency";
import { formatCurrency } from "@/lib/currency";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { useData } from "@/context/data-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import React from 'react';


const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const createProductSchema = (isSkuAuto: boolean) => z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative("Price must be a non-negative number.").optional(),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer.").optional(),
  reorderLimit: z.coerce.number().int().nonnegative("Reorder limit must be a non-negative integer."),
  maxStockLevel: z.coerce.number().int().nonnegative("Max stock must be a non-negative integer."),
  location: z.string().optional(),
  supplierId: z.string().optional(),
  photoFile: z.any().optional(),
}).refine(data => isSkuAuto || (data.sku && data.sku.length > 0), {
    message: "SKU is required when not auto-generated.",
    path: ["sku"],
});

const editProductSchema = z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative("Price must be a non-negative number."),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer."),
  reorderLimit: z.coerce.number().int().nonnegative("Reorder limit must be a non-negative integer."),
  maxStockLevel: z.coerce.number().int().nonnegative("Max stock must be a non-negative integer."),
  location: z.string().optional(),
  supplierId: z.string().optional(),
  photoFile: z.any().optional(),
});

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(1, "Phone number is required."),
  address: z.string().min(1, "Address is required."),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;


type ProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;
type StatusFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";

const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

export default function InventoryPage() {
  const { products, suppliers, loading, refetchData } = useData();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);

  const productSchema = useMemo(() => createProductSchema(autoGenerateSku), [autoGenerateSku]);

  const addForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: undefined,
      stock: undefined,
      reorderLimit: 10,
      maxStockLevel: 100,
      location: "",
      supplierId: "",
    },
  });

  const editForm = useForm<ProductFormValues>({
    resolver: zodResolver(editProductSchema),
  });

  const supplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });

  useEffect(() => {
    if (isAddDialogOpen) {
      addForm.reset();
      setAutoGenerateSku(true);
      setPreviewImage(null);
    }
  }, [isAddDialogOpen, addForm]);

  useEffect(() => {
    if (editingProduct) {
      editForm.reset({
        ...editingProduct,
        supplierId: suppliers.find(s => s.name === editingProduct.supplier)?.id || '',
      });
      setPreviewImage(editingProduct.photoURL || null);
    } else {
      setPreviewImage(null);
    }
  }, [editingProduct, editForm, suppliers]);

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
      const { supplierId, ...productData } = data;
      const supplierName = suppliers.find(s => s.id === supplierId)?.name || '';

      const finalProductData: any = { ...productData, supplier: supplierName };

      if (autoGenerateSku) {
        // Simple SKU generation logic: first 3 letters of name + random 4 digits
        const namePart = data.name.substring(0, 3).toUpperCase();
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        finalProductData.sku = `${namePart}-${randomPart}`;
      }
      if (data.photoFile?.[0]) {
        finalProductData.photoFile = data.photoFile[0];
      }

      await addProduct(finalProductData);
      toast({ title: "Success", description: "Product added successfully." });
      setIsAddDialogOpen(false);
      addForm.reset();
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

  const onEditSubmit = async (data: ProductFormValues) => {
    if (!editingProduct) return;
    try {
      const { sku, supplierId, ...updateData } = data;
      const supplierName = suppliers.find(s => s.id === supplierId)?.name || '';
      const payload: any = { ...updateData, supplier: supplierName };

      if (data.photoFile?.[0]) {
        payload.photoFile = data.photoFile[0];
      }
      
      await updateProduct(editingProduct.id, payload);
      toast({ title: "Success", description: "Product updated successfully." });
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      await refetchData();
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
      await refetchData();
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, formType: 'add' | 'edit') => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
      if (formType === 'add') {
        addForm.setValue('photoFile', event.target.files);
      } else {
        editForm.setValue('photoFile', event.target.files);
      }
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

  return (
    <>
      <Card className="printable-content">
        <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 print-hidden">
          <div>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>Manage your product inventory.</CardDescription>
            <div className="flex items-center gap-2 mt-4 flex-wrap print-hidden">
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
          <div className="flex items-center gap-2 print-hidden">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
              <Printer />
              Print Report
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 w-full md:w-auto">
                  <PlusCircle />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                  <DialogDescription>Fill in the details for the new product.</DialogDescription>
                </DialogHeader>
                <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                  <div className="space-y-2 text-center">
                      <div className="relative w-24 h-24 mx-auto">
                          <Avatar className="w-24 h-24 text-4xl rounded-md">
                              {previewImage ? (
                                  <Image
                                      src={previewImage}
                                      alt="Product preview"
                                      width={96}
                                      height={96}
                                      className="rounded-md object-cover aspect-square"
                                  />
                              ) : (
                                  <AvatarImage src={undefined} alt="Product preview" />
                              )}
                              <AvatarFallback className="rounded-md">
                                  {addForm.getValues('name')?.[0]?.toUpperCase() || <Package />}
                              </AvatarFallback>
                          </Avatar>
                      </div>
                        <Button type="button" variant="link" onClick={() => addFileInputRef.current?.click()}>
                          Upload Photo
                        </Button>
                        <Input
                          type="file"
                          className="hidden"
                          {...addForm.register("photoFile")}
                          ref={addFileInputRef}
                          onChange={(e) => handleFileChange(e, 'add')}
                          accept="image/png, image/jpeg, image/webp"
                        />
                        {addForm.formState.errors.photoFile && <p className="text-sm text-destructive">{addForm.formState.errors.photoFile.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input id="name" {...addForm.register("name")} onChange={(e) => {
                      const { value } = e.target;
                      e.target.value = toTitleCase(value);
                      addForm.setValue("name", e.target.value);
                    }}/>
                    {addForm.formState.errors.name && <p className="text-sm text-destructive">{addForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <Label htmlFor="price">Price (Optional)</Label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                        <Input id="price" type="number" step="0.01" className="pl-8" placeholder="0.00" {...addForm.register("price")} />
                      </div>
                      {addForm.formState.errors.price && <p className="text-sm text-destructive">{addForm.formState.errors.price.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock">Initial Stock (Optional)</Label>
                      <Input id="stock" type="number" placeholder="0" {...addForm.register("stock")} />
                      {addForm.formState.errors.stock && <p className="text-sm text-destructive">{addForm.formState.errors.stock.message}</p>}
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="reorderLimit">Reorder Limit</Label>
                      <Input id="reorderLimit" type="number" {...addForm.register("reorderLimit")} />
                      {addForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{addForm.formState.errors.reorderLimit.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxStockLevel">Max Stock Level</Label>
                      <Input id="maxStockLevel" type="number" {...addForm.register("maxStockLevel")} />
                      {addForm.formState.errors.maxStockLevel && <p className="text-sm text-destructive">{addForm.formState.errors.maxStockLevel.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" placeholder="e.g. 'Warehouse A'" {...addForm.register("location")} />
                      </div>
                      <div className="space-y-2">
                         <Label>Supplier</Label>
                          <Controller
                              control={addForm.control}
                              name="supplierId"
                              render={({ field }) => (
                                  <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                                      <PopoverTrigger asChild>
                                          <Button
                                              variant="outline"
                                              role="combobox"
                                              className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                          >
                                              {field.value ? suppliers.find(s => s.id === field.value)?.name : "Select supplier"}
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
                                                                  field.onChange(s.id);
                                                                  setIsSupplierPopoverOpen(false);
                                                              }}
                                                          >
                                                              <Check className={cn("mr-2 h-4 w-4", field.value === s.id ? "opacity-100" : "opacity-0")} />
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
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={addForm.formState.isSubmitting}>
                      {addForm.formState.isSubmitting ? "Adding..." : "Add Product"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
           <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="print-hidden">
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
                        <TableCell className="print-hidden"><Skeleton className="h-8 w-8" /></TableCell>
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
                              src={product.photoURL || `https://picsum.photos/seed/${product.id}/48/48`}
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
                          <TableCell>{product.supplier || 'N/A'}</TableCell>
                           <TableCell>{formatDate(product.lastUpdated)}</TableCell>
                          <TableCell className="print-hidden">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal />
                                  <span className="sr-only">Toggle menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
            </div>
            <div className="grid gap-4 md:hidden">
                 {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader>
                                 <div className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12 rounded-md" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-5 w-3/4" />
                                        <Skeleton className="h-4 w-1/4" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    filteredProducts.map((product) => {
                        const status = getStatus(product);
                        return (
                            <Card key={product.id}>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Image
                                          alt={product.name}
                                          className="aspect-square rounded-md object-cover"
                                          height="48"
                                          src={product.photoURL || `https://picsum.photos/seed/${product.id}/48/48`}
                                          width="48"
                                        />
                                        <div>
                                            <CardTitle className="text-base">{product.name}</CardTitle>
                                            <CardDescription>{product.sku}</CardDescription>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="icon" variant="ghost"><MoreHorizontal /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleEditClick(product)}>Edit</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDeleteClick(product.id)} className="text-destructive">Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="font-medium">Price</p>
                                        <p>{formatCurrency(product.price)}</p>
                                    </div>
                                     <div>
                                        <p className="font-medium">Stock</p>
                                        <p>{product.stock}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium">Status</p>
                                        <p><Badge variant={status.variant} className={status.className}>{status.text}</Badge></p>
                                    </div>
                                    <div>
                                        <p className="font-medium">Supplier</p>
                                        <p>{product.supplier || 'N/A'}</p>
                                    </div>
                                </CardContent>
                                <CardFooter className="text-xs text-muted-foreground">
                                    Last Updated: {formatDate(product.lastUpdated)}
                                </CardFooter>
                            </Card>
                        )
                    })
                )}
            </div>
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
              <div className="space-y-2 text-center">
                  <div className="relative w-24 h-24 mx-auto">
                      <Avatar className="w-24 h-24 text-4xl rounded-md">
                          {previewImage ? (
                              <Image
                                  src={previewImage}
                                  alt="Product preview"
                                  width={96}
                                  height={96}
                                  className="rounded-md object-cover aspect-square"
                              />
                          ) : (
                              <AvatarImage src={undefined} alt="Product preview" />
                          )}
                          <AvatarFallback className="rounded-md">
                              {editForm.getValues('name')?.[0]?.toUpperCase() || <Package />}
                          </AvatarFallback>
                      </Avatar>
                  </div>
                    <Button type="button" variant="link" onClick={() => editFileInputRef.current?.click()}>
                      Change Photo
                    </Button>
                    <Input
                      type="file"
                      className="hidden"
                      {...editForm.register("photoFile")}
                      ref={editFileInputRef}
                      onChange={(e) => handleFileChange(e, 'edit')}
                      accept="image/png, image/jpeg, image/webp"
                    />
                    {editForm.formState.errors.photoFile && <p className="text-sm text-destructive">{editForm.formState.errors.photoFile.message as string}</p>}
              </div>
               <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name</Label>
                  <Input id="edit-name" {...editForm.register("name")} onChange={(e) => {
                    const { value } = e.target;
                    e.target.value = toTitleCase(value);
                    editForm.setValue("name", e.target.value);
                  }}/>
                  {editForm.formState.errors.name && <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sku">SKU</Label>
                    <Input id="edit-sku" {...editForm.register("sku")} disabled />
                    {editForm.formState.errors.sku && <p className="text-sm text-destructive">{editForm.formState.errors.sku.message}</p>}
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="edit-price">Price</Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                      <Input id="edit-price" type="number" step="0.01" className="pl-8" placeholder="0.00" {...editForm.register("price")} />
                    </div>
                    {editForm.formState.errors.price && <p className="text-sm text-destructive">{editForm.formState.errors.price.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-maxStockLevel">Max Stock Level</Label>
                        <Input id="edit-maxStockLevel" type="number" {...editForm.register("maxStockLevel")} />
                        {editForm.formState.errors.maxStockLevel && <p className="text-sm text-destructive">{editForm.formState.errors.maxStockLevel.message}</p>}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-location">Location</Label>
                      <Input id="edit-location" {...editForm.register("location")} />
                    </div>
                    <div className="space-y-2">
                       <Label>Supplier</Label>
                        <Controller
                            control={editForm.control}
                            name="supplierId"
                            render={({ field }) => (
                                <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                        >
                                            {field.value ? suppliers.find(s => s.id === field.value)?.name : "Select supplier"}
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
                                                                field.onChange(s.id);
                                                                setIsSupplierPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", field.value === s.id ? "opacity-100" : "opacity-0")} />
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
      
       <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>Fill in the details for the new supplier.</DialogDescription>
            </DialogHeader>
            <form onSubmit={supplierForm.handleSubmit(onAddSupplierSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Supplier Name</Label>
                <Input id="name" {...supplierForm.register("name")} />
                {supplierForm.formState.errors.name && <p className="text-sm text-destructive">{supplierForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input id="contactPerson" {...supplierForm.register("contactPerson")} />
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
    </>
  );
}

    


