

"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Package, ChevronsUpDown, Check, Printer, FileDown, SlidersHorizontal, QrCode, Camera, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { addProduct, updateProduct, deleteProduct, addSupplier, adjustStock } from "@/services/data-service";
import type { Product, Supplier, ProductCategory, ProductLocation } from "@/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import QRCode from "react-qr-code";
import { useZxing } from "react-zxing";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CoreFlowLogo } from "@/components/icons";
import { toPng } from 'html-to-image';


const categories: ProductCategory[] = ["Tools", "Consumables", "Raw Materials", "Finished Goods", "Other"];

const locationSchema = z.object({
  zone: z.string().optional(),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  level: z.string().optional(),
  bin: z.string().optional(),
}).optional();

const createProductSchema = (isSkuAuto: boolean) => z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  category: z.enum(categories),
  price: z.coerce.number().nonnegative("Price must be a non-negative number.").optional(),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer.").optional(),
  reorderLimit: z.coerce.number().int().nonnegative("Reorder limit must be a non-negative integer."),
  maxStockLevel: z.coerce.number().int().nonnegative("Max stock must be a non-negative integer."),
  location: locationSchema,
  supplierId: z.string().optional(),
}).refine(data => isSkuAuto || (data.sku && data.sku.length > 0), {
    message: "SKU is required when not auto-generated.",
    path: ["sku"],
});

const editProductSchema = z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  category: z.enum(categories),
  price: z.coerce.number().nonnegative("Price must be a non-negative number."),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer."),
  reorderLimit: z.coerce.number().int().nonnegative("Reorder limit must be a non-negative integer."),
  maxStockLevel: z.coerce.number().int().nonnegative("Max stock must be a non-negative integer."),
  location: locationSchema,
  supplierId: z.string().optional(),
});

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(1, "Phone number is required."),
  address: z.string().min(1, "Address is required."),
});

const stockAdjustmentSchema = z.object({
  adjustmentType: z.enum(["add", "remove"]),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  reason: z.string().min(5, "A reason is required for the adjustment."),
});

type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>;

type SupplierFormValues = z.infer<typeof supplierSchema>;


type ProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;
type StatusFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";
type CategoryFilter = "all" | ProductCategory;

type LocationFilter = {
    zone?: string;
    aisle?: string;
    rack?: string;
    level?: string;
    bin?: string;
};

const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

const Scanner = ({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) => {
    const { toast } = useToast();
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const { ref } = useZxing({
        onDecodeResult(result) {
            onResult(result.getText());
        },
        videoRef,
    });
    
     useEffect(() => {
        const getCameraPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setHasCameraPermission(true);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this app.',
            });
        }
        };
        getCameraPermission();
    }, [toast]);


    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Scan Product QR Code</DialogTitle>
                </DialogHeader>
                <div className="relative">
                    <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted />
                     {hasCameraPermission === false && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                            <Alert variant="destructive" className="w-auto">
                                <AlertTitle>Camera Access Required</AlertTitle>
                                <AlertDescription>
                                    Please allow camera access to use this feature.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};


export default function InventoryPage() {
  const { products, suppliers, loading, refetchData } = useData();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null);
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({});
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [qrCodeProduct, setQrCodeProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const qrCodeLabelRef = useRef<HTMLDivElement>(null);

  const productSchema = useMemo(() => createProductSchema(autoGenerateSku), [autoGenerateSku]);

  const addForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      category: "Other",
      price: undefined,
      stock: undefined,
      reorderLimit: 10,
      maxStockLevel: 100,
      location: { zone: "", aisle: "", rack: "", level: "", bin: "" },
      supplierId: "",
    },
  });

  const editForm = useForm<ProductFormValues>({
    resolver: zodResolver(editProductSchema),
  });

  const supplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });
  
  const adjustmentForm = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      adjustmentType: "add",
      quantity: 1,
      reason: "",
    },
  });

  useEffect(() => {
    if (isAddDialogOpen) {
      addForm.reset();
      setAutoGenerateSku(true);
    }
  }, [isAddDialogOpen, addForm]);

  useEffect(() => {
    if (editingProduct) {
      editForm.reset({
        ...editingProduct,
        supplierId: suppliers.find(s => s.name === editingProduct.supplier)?.id || '',
      });
    }
  }, [editingProduct, editForm, suppliers]);

   useEffect(() => {
    if (adjustmentProduct) {
      adjustmentForm.reset();
      setIsAdjustmentOpen(true);
    } else {
      setIsAdjustmentOpen(false);
    }
  }, [adjustmentProduct, adjustmentForm]);

   const getStatus = (product: Product): { text: string; variant: "default" | "secondary" | "destructive", className?: string } => {
    if (product.stock === 0) return { text: "Out of Stock", variant: "destructive", className: "font-semibold" };
    if (product.stock <= product.reorderLimit) return { text: "Low Stock", variant: "secondary", className: "bg-destructive/40 text-destructive-foreground border-destructive/50" };
    return { text: "In Stock", variant: "default" };
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const statusCheck = statusFilter === "all" || getStatus(product).text.replace(' ', '-')
.toLowerCase() === statusFilter;
      const categoryCheck = categoryFilter === "all" || product.category === categoryFilter;

      const locationCheck = Object.entries(locationFilter).every(([key, value]) => 
        !value || (product.location && product.location[key as keyof ProductLocation] === value)
      );

      return statusCheck && categoryCheck && locationCheck;
    });
  }, [products, statusFilter, categoryFilter, locationFilter]);

  const locationOptions = useMemo(() => {
    const options: { [key in keyof ProductLocation]: Set<string> } = {
        zone: new Set(),
        aisle: new Set(),
        rack: new Set(),
        level: new Set(),
        bin: new Set(),
    };
    products.forEach(p => {
        if (p.location) {
            (Object.keys(p.location) as (keyof ProductLocation)[]).forEach(key => {
                if (p.location![key]) {
                    options[key].add(p.location![key]!);
                }
            });
        }
    });
    return {
        zone: Array.from(options.zone).sort(),
        aisle: Array.from(options.aisle).sort(),
        rack: Array.from(options.rack).sort(),
        level: Array.from(options.level).sort(),
        bin: Array.from(options.bin).sort(),
    };
}, [products]);
  
  const onAddSubmit = async (data: ProductFormValues) => {
    try {
      const { supplierId, ...productData } = data;
      const supplierName = suppliers.find(s => s.id === supplierId)?.name || '';
      
      const finalProductData: any = { ...productData, supplier: supplierName };

      if (autoGenerateSku) {
        const namePart = data.name.substring(0, 3).toUpperCase();
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        finalProductData.sku = `${namePart}-${randomPart}`;
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

  const onAdjustmentSubmit = async (data: StockAdjustmentFormValues) => {
    if (!adjustmentProduct) return;
    try {
      const quantity = data.adjustmentType === 'add' ? data.quantity : -data.quantity;
      await adjustStock(adjustmentProduct.id, quantity, data.reason);
      toast({ title: "Success", description: "Stock adjusted successfully." });
      setAdjustmentProduct(null);
      await refetchData();
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        variant: "destructive",
        title: "Error Adjusting Stock",
        description: errorMessage,
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

  const formatLocation = (location?: ProductLocation) => {
    if (!location) return 'N/A';
    return Object.values(location).filter(Boolean).join(' - ');
  }

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

  const handleExport = () => {
    const headers = ["SKU", "Name", "Category", "Price", "Stock", "Status", "Supplier", "Location", "Last Updated"];
    const rows = filteredProducts.map(p => {
        const status = getStatus(p);
        const lastUpdated = p.lastUpdated ? formatDate(p.lastUpdated) : 'N/A';
        const name = `"${p.name.replace(/"/g, '""')}"`;
        const supplier = `"${(p.supplier || 'N/A').replace(/"/g, '""')}"`;
        const location = `"${formatLocation(p.location)}"`;

        return [p.sku, name, p.category, p.price, p.stock, status.text, supplier, location, lastUpdated].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(',') + "\n" 
        + rows.join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventory-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  const handleScanResult = (text: string) => {
      setIsScannerOpen(false);
      const product = products.find(p => p.id === text);
      if (product) {
          handleEditClick(product);
      } else {
          toast({
              variant: "destructive",
              title: "Product Not Found",
              description: "The scanned QR code does not match any product in your inventory.",
          });
      }
  };

  const handleExportAsImage = useCallback(() => {
    if (qrCodeLabelRef.current === null || !qrCodeProduct) {
      return;
    }

    toPng(qrCodeLabelRef.current, { cacheBust: true, pixelRatio: 2 })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${qrCodeProduct.sku || 'product-label'}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error(err);
        toast({
            variant: "destructive",
            title: "Export Failed",
            description: "Could not export the label as an image.",
        });
      });
  }, [qrCodeProduct, toast]);


  return (
    <>
      {isScannerOpen && (
        <Scanner 
            onResult={handleScanResult}
            onClose={() => setIsScannerOpen(false)}
        />
      )}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 print-hidden">
          <div>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>Manage your product inventory.</CardDescription>
             <div className="flex items-center gap-2 mt-4 print-hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 capitalize">
                           <SlidersHorizontal className="h-4 w-4" />
                           Status: {statusFilter.replace("-", " ")}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                          {(["all", "in-stock", "low-stock", "out-of-stock"] as StatusFilter[]).map((filter) => (
                            <DropdownMenuRadioItem key={filter} value={filter} className="capitalize">
                                {filter.replace("-", " ")}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 capitalize">
                           <SlidersHorizontal className="h-4 w-4" />
                           Category: {categoryFilter}
                        </Button>
                    </DropdownMenuTrigger>
                     <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}>
                            {(["all", ...categories] as CategoryFilter[]).map((filter) => (
                                <DropdownMenuRadioItem key={filter} value={filter} className="capitalize">
                                    {filter}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <SlidersHorizontal className="h-4 w-4" />
                            Location
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Filter by Location</DropdownMenuLabel>
                        {(Object.keys(locationOptions) as (keyof ProductLocation)[]).map((key) => (
                            <DropdownMenuSub key={key}>
                                <DropdownMenuSubTrigger>{key.charAt(0).toUpperCase() + key.slice(1)}: {locationFilter[key] || 'Any'}</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup value={locationFilter[key]} onValueChange={(value) => setLocationFilter(prev => ({ ...prev, [key]: value }))}>
                                        <DropdownMenuRadioItem value="">Any</DropdownMenuRadioItem>
                                        {locationOptions[key].map(opt => (
                                            <DropdownMenuRadioItem key={opt} value={opt}>{opt}</DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        ))}
                         <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setLocationFilter({})}>Clear Filters</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
             <div className="flex items-center gap-2 print-hidden">
                <Button size="sm" variant="outline" className="gap-1" onClick={handleExport}>
                    <FileDown />
                    Export to CSV
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
                    <Printer />
                    Print Report
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1 w-full md:w-auto" onClick={() => setIsScannerOpen(true)}>
                  <Camera />
                  Scan Product
                </Button>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild className="print-hidden">
                    <Button size="sm" className="gap-1 w-full md:w-auto">
                    <PlusCircle />
                    Add Product
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>Fill in the details for the new product.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="name">Product Name</Label>
                            <Input id="name" {...addForm.register("name")} onChange={(e) => {
                            const { value } = e.target;
                            e.target.value = toTitleCase(value);
                            addForm.setValue("name", e.target.value);
                            }}/>
                            {addForm.formState.errors.name && <p className="text-sm text-destructive">{addForm.formState.errors.name.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Controller
                                name="category"
                                control={addForm.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {addForm.formState.errors.category && <p className="text-sm text-destructive">{addForm.formState.errors.category.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="sku">SKU</Label>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Switch id="auto-generate-sku-add" checked={autoGenerateSku} onCheckedChange={setAutoGenerateSku} />
                                    <Label htmlFor="auto-generate-sku-add">Auto</Label>
                                </div>
                            </div>
                            <Input id="sku" {...addForm.register("sku")} disabled={autoGenerateSku} placeholder={autoGenerateSku ? "Generated" : "Manual SKU"} />
                            {addForm.formState.errors.sku && <p className="text-sm text-destructive">{addForm.formState.errors.sku.message}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                        <Label htmlFor="price">Price (Optional)</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                            <Input id="price" type="number" step="0.01" className="pl-8" placeholder="0.00" {...addForm.register("price")} />
                        </div>
                        {addForm.formState.errors.price && <p className="text-sm text-destructive">{addForm.formState.errors.price.message}</p>}
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="stock">Initial Stock</Label>
                        <Input id="stock" type="number" placeholder="0" {...addForm.register("stock")} />
                        {addForm.formState.errors.stock && <p className="text-sm text-destructive">{addForm.formState.errors.stock.message}</p>}
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="reorderLimit">Reorder At</Label>
                        <Input id="reorderLimit" type="number" {...addForm.register("reorderLimit")} />
                        {addForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{addForm.formState.errors.reorderLimit.message}</p>}
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="maxStockLevel">Max Stock</Label>
                        <Input id="maxStockLevel" type="number" {...addForm.register("maxStockLevel")} />
                        {addForm.formState.errors.maxStockLevel && <p className="text-sm text-destructive">{addForm.formState.errors.maxStockLevel.message}</p>}
                        </div>
                    </div>
                    <div className="space-y-4 rounded-md border p-4">
                        <Label className="text-base">Storage Location</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                            <Input placeholder="Zone" {...addForm.register("location.zone")} />
                            <Input placeholder="Aisle" {...addForm.register("location.aisle")} />
                            <Input placeholder="Rack" {...addForm.register("location.rack")} />
                            <Input placeholder="Level" {...addForm.register("location.level")} />
                            <Input placeholder="Bin" {...addForm.register("location.bin")} />
                        </div>
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
          </div>
        </CardHeader>
        <CardContent>
           <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
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
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
                        <TableRow key={product.id} onClick={() => handleEditClick(product)} className="cursor-pointer">
                          <TableCell className="font-medium">
                            {product.name}
                          </TableCell>
                          <TableCell>{product.sku}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>{formatCurrency(product.price)}</TableCell>
                          <TableCell>{product.stock}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className={status.className}>{status.text}</Badge>
                          </TableCell>
                          <TableCell>{formatLocation(product.location)}</TableCell>
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
                                <DropdownMenuItem onClick={() => setAdjustmentProduct(product)}>
                                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                                    <span>Adjust Stock</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setQrCodeProduct(product)}>
                                    <QrCode className="mr-2 h-4 w-4" />
                                    <span>View QR Code</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
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
                            <Card key={product.id} onClick={() => handleEditClick(product)} className="cursor-pointer">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">{product.name}</CardTitle>
                                        <CardDescription>{product.sku}</CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleEditClick(product)}>Edit</DropdownMenuItem>
                                             <DropdownMenuItem onClick={() => setAdjustmentProduct(product)}>
                                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                                <span>Adjust Stock</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setQrCodeProduct(product)}>
                                                <QrCode className="mr-2 h-4 w-4" />
                                                <span>View QR Code</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleDeleteClick(product.id)} className="text-destructive">Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="font-medium">Category</p>
                                        <p>{product.category}</p>
                                    </div>
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
                                    <div className="col-span-2">
                                        <p className="font-medium">Location</p>
                                        <p>{formatLocation(product.location)}</p>
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
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>Update the details for {editingProduct.name}.</DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-[2fr_1fr] gap-8">
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="edit-name">Product Name</Label>
                          <Input id="edit-name" {...editForm.register("name")} onChange={(e) => {
                              const { value } = e.target;
                              e.target.value = toTitleCase(value);
                              editForm.setValue("name", e.target.value);
                          }}/>
                          {editForm.formState.errors.name && <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>}
                      </div>
                       <div className="space-y-2">
                          <Label htmlFor="edit-category">Category</Label>
                          <Controller
                              name="category"
                              control={editForm.control}
                              render={({ field }) => (
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <SelectTrigger>
                                          <SelectValue placeholder="Select a category" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                              )}
                          />
                          {editForm.formState.errors.category && <p className="text-sm text-destructive">{editForm.formState.errors.category.message}</p>}
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="edit-sku">SKU</Label>
                          <Input id="edit-sku" {...editForm.register("sku")} disabled />
                          {editForm.formState.errors.sku && <p className="text-sm text-destructive">{editForm.formState.errors.sku.message}</p>}
                      </div>
                  </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                   <div className="space-y-2">
                    <Label htmlFor="edit-price">Price</Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                      <Input id="edit-price" type="number" step="0.01" className="pl-8" placeholder="0.00" {...editForm.register("price")} />
                    </div>
                    {editForm.formState.errors.price && <p className="text-sm text-destructive">{editForm.formState.errors.price.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-stock">Stock</Label>
                    <Input id="edit-stock" type="number" {...editForm.register("stock")} />
                    {editForm.formState.errors.stock && <p className="text-sm text-destructive">{editForm.formState.errors.stock.message}</p>}
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="edit-reorderLimit">Reorder At</Label>
                    <Input id="edit-reorderLimit" type="number" {...editForm.register("reorderLimit")} />
                    {editForm.formState.errors.reorderLimit && <p className="text-sm text-destructive">{editForm.formState.errors.reorderLimit.message}</p>}
                  </div>
                   <div className="space-y-2">
                        <Label htmlFor="edit-maxStockLevel">Max Stock</Label>
                        <Input id="edit-maxStockLevel" type="number" {...editForm.register("maxStockLevel")} />
                        {editForm.formState.errors.maxStockLevel && <p className="text-sm text-destructive">{editForm.formState.errors.maxStockLevel.message}</p>}
                    </div>
                </div>
                 <div className="space-y-4 rounded-md border p-4">
                    <Label className="text-base">Storage Location</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                        <Input placeholder="Zone" {...editForm.register("location.zone")} />
                        <Input placeholder="Aisle" {...editForm.register("location.aisle")} />
                        <Input placeholder="Rack" {...editForm.register("location.rack")} />
                        <Input placeholder="Level" {...editForm.register("location.level")} />
                        <Input placeholder="Bin" {...editForm.register("location.bin")} />
                    </div>
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
            <div className="flex flex-col items-center justify-center space-y-2 border-l pl-8">
                <div className="bg-white p-2 inline-block rounded-md">
                  <QRCode value={editingProduct.id || ""} size={128} />
                </div>
                <p className="text-sm text-muted-foreground">ID: {editingProduct.id}</p>
                <Button variant="outline" size="sm" onClick={() => setQrCodeProduct(editingProduct)}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
            </div>
            </div>
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
      
       <Dialog open={isAdjustmentOpen} onOpenChange={(open) => !open && setAdjustmentProduct(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Adjust Stock for {adjustmentProduct?.name}</DialogTitle>
                <DialogDescription>Current Stock: {adjustmentProduct?.stock}</DialogDescription>
            </DialogHeader>
            <form onSubmit={adjustmentForm.handleSubmit(onAdjustmentSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label>Adjustment Type</Label>
                    <Controller
                        name="adjustmentType"
                        control={adjustmentForm.control}
                        render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                <Label className="flex items-center gap-2 cursor-pointer">
                                    <RadioGroupItem value="add" id="add" />
                                    Add to Stock
                                </Label>
                                <Label className="flex items-center gap-2 cursor-pointer">
                                    <RadioGroupItem value="remove" id="remove" />
                                    Remove from Stock
                                </Label>
                            </RadioGroup>
                        )}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input id="quantity" type="number" {...adjustmentForm.register("quantity")} />
                    {adjustmentForm.formState.errors.quantity && <p className="text-sm text-destructive">{adjustmentForm.formState.errors.quantity.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Adjustment</Label>
                    <Textarea id="reason" {...adjustmentForm.register("reason")} placeholder="e.g., Damaged item, Cycle count correction, etc." />
                    {adjustmentForm.formState.errors.reason && <p className="text-sm text-destructive">{adjustmentForm.formState.errors.reason.message}</p>}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAdjustmentProduct(null)}>Cancel</Button>
                    <Button type="submit" disabled={adjustmentForm.formState.isSubmitting}>
                        {adjustmentForm.formState.isSubmitting ? "Adjusting..." : "Apply Adjustment"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!qrCodeProduct} onOpenChange={(open) => !open && setQrCodeProduct(null)}>
        <DialogContent className="sm:max-w-sm">
            <DialogHeader className="print-hidden sr-only">
                <DialogTitle>Product QR Code</DialogTitle>
            </DialogHeader>
            <div ref={qrCodeLabelRef} className="printable-content flex flex-col items-center justify-center p-4 bg-white text-black rounded-lg">
                <div className="flex items-center gap-2 font-semibold">
                    <CoreFlowLogo className="h-6 w-6 text-black" />
                    <span>CoreFlow</span>
                </div>
                <p className="text-lg font-bold mt-4 text-center">{qrCodeProduct?.name}</p>
                <div className="p-2 inline-block my-2">
                    <QRCode value={qrCodeProduct?.id || ""} size={128} />
                </div>
                <p className="text-sm font-mono text-gray-600">SKU: {qrCodeProduct?.sku}</p>
            </div>
            <DialogFooter className="print-hidden mt-4">
                <Button variant="outline" onClick={() => setQrCodeProduct(null)}>Close</Button>
                <Button onClick={handleExportAsImage}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
                <Button onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
