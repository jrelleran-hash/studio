

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, X, Plus, RefreshCcw } from "lucide-react";
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
import { updateOrderStatus, addOrder, addProduct, updateSupplier, deleteSupplier, addSupplier, deleteOrder, addPurchaseOrder, updatePurchaseOrderStatus, deletePurchaseOrder, initiateOutboundReturn } from "@/services/data-service";
import type { Order, Supplier, PurchaseOrder, Product, OutboundReturnItem } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { CURRENCY_CONFIG } from "@/config/currency";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/context/data-context";
import { Checkbox } from "@/components/ui/checkbox";
import { validateEmailAction } from "./actions";
import { Textarea } from "@/components/ui/textarea";


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Fulfilled: "default",
  "Ready for Issuance": "default",
  "Awaiting Purchase": "secondary",
  Shipped: "outline",
  Cancelled: "destructive",
  Processing: "secondary",
  Received: "default",
  Pending: "secondary",
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
  maxStockLevel: z.coerce.number().int().nonnegative("Max stock must be a non-negative integer."),
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
  cellphoneNumber: z.string().optional(),
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
                        path: [`${index}.returnQuantity`],
                        message: "Quantity must be greater than 0.",
                        code: z.ZodIssueCode.custom,
                    });
                } else if (item.returnQuantity > item.receivedQuantity) {
                    ctx.addIssue({
                        path: [`${index}.returnQuantity`],
                        message: `Cannot return more than ${item.receivedQuantity} received items.`,
                        code: z.ZodIssueCode.custom,
                    });
                }
            }
        });
    }),
});

type OutboundReturnFormValues = z.infer<ReturnType<typeof createOutboundReturnSchema>>;


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
  const [isDeletePOOpen, setIsDeletePOOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isReordered, setIsReordered] = useState(false);
  const [purchaseQueueSelection, setPurchaseQueueSelection] = useState<{[key: string]: boolean}>({});
  const [poForReturn, setPoForReturn] = useState<PurchaseOrder | null>(null);


  // Data states
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [deletingPOId, setDeletingPOId] = useState<string | null>(null);
  const [poView, setPoView] = useState<'queue' | 'list'>('queue');
  const [emailValidation, setEmailValidation] = useState<{ isValid: boolean; reason?: string; error?: string } | null>(null);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [emailValidationTimeout, setEmailValidationTimeout] = useState<NodeJS.Timeout | null>(null);


  const productSchema = useMemo(() => createProductSchema(autoGenerateSku), [autoGenerateSku]);
  const outboundReturnSchema = useMemo(() => createOutboundReturnSchema(poForReturn), [poForReturn]);


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
      maxStockLevel: 100,
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

  const outboundReturnForm = useForm<OutboundReturnFormValues>({
    resolver: zodResolver(outboundReturnSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: orderForm.control,
    name: "items",
  });
  
  const { fields: poFields, append: poAppend, remove: poRemove } = useFieldArray({
    control: poForm.control,
    name: "items",
  });

  const { fields: outboundReturnFields } = useFieldArray({
    control: outboundReturnForm.control,
    name: "items",
  });

  const purchaseQueue = useMemo((): PurchaseQueueItem[] => {
    const neededQuantities: { [productId: string]: { name: string; sku: string; quantity: number; orders: Set<string> } } = {};

    // Calculate total needed quantities from orders awaiting purchase that are not met by current stock
    orders
      .filter(order => order.status === 'Awaiting Purchase')
      .forEach(order => {
        order.items.forEach(item => {
          const productInfo = products.find(p => p.id === item.product.id);
          const stock = productInfo?.stock || 0;
          const needed = item.quantity - stock;
          
          if (needed > 0) {
              if (!neededQuantities[item.product.id]) {
                neededQuantities[item.product.id] = {
                  name: item.product.name,
                  sku: item.product.sku,
                  quantity: 0,
                  orders: new Set(),
                };
              }
              neededQuantities[item.product.id].quantity += needed;
              neededQuantities[item.product.id].orders.add(order.id.substring(0, 7));
          }
        });
      });
      
    // Add items that have hit their reorder limit and are not already queued for purchase
    products.forEach(product => {
      if (product.stock <= product.reorderLimit) {
        const reorderQty = (product.maxStockLevel || product.reorderLimit + 20) - product.stock;
        if (reorderQty > 0) {
          if (!neededQuantities[product.id]) {
            neededQuantities[product.id] = {
              name: product.name,
              sku: product.sku,
              quantity: 0,
              orders: new Set(),
            };
          }
          // Use Math.max to not override a larger quantity needed for an order
          neededQuantities[product.id].quantity = Math.max(neededQuantities[product.id].quantity, reorderQty);
          if (neededQuantities[product.id].orders.size === 0) {
             neededQuantities[product.id].orders.add("Reorder");
          }
        }
      }
    });
      
      // Calculate quantities already on purchase orders (not yet received)
      const onOrderQuantities: { [productId: string]: number } = {};
       purchaseOrders
        .filter(po => po.status !== 'Received')
        .forEach(po => {
            po.items.forEach(item => {
                const productId = item.product.id;
                if (!onOrderQuantities[productId]) {
                    onOrderQuantities[productId] = 0;
                }
                onOrderQuantities[productId] += item.quantity;
            });
        });

      // Calculate the final queue by subtracting on-order quantities from needed quantities
      const queue: PurchaseQueueItem[] = [];
      Object.keys(neededQuantities).forEach(productId => {
          const needed = neededQuantities[productId];
          const onOrder = onOrderQuantities[productId] || 0;
          const stillNeeded = needed.quantity - onOrder;

          if (stillNeeded > 0) {
              queue.push({
                  productId: productId,
                  name: needed.name,
                  sku: needed.sku,
                  totalQuantity: stillNeeded,
                  fromOrders: Array.from(needed.orders),
              });
          }
      });
    
    return queue;
  }, [orders, purchaseOrders, products]);

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
    if (!isAddSupplierOpen && !isEditSupplierOpen) {
      supplierForm.reset();
      editSupplierForm.reset();
      setEmailValidation(null);
      setIsEmailChecking(false);
    }
  }, [isAddSupplierOpen, isEditSupplierOpen, supplierForm, editSupplierForm]);

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
      const productData = { ...data };
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
    const handleEmailBlur = async (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            setEmailValidation(null);
            return;
        }

        setIsEmailChecking(true);
        setEmailValidation(null);
        const result = await validateEmailAction({ email });
        setIsEmailChecking(false);

        if (result.error) {
            toast({ variant: 'destructive', title: 'Validation Error', description: result.error });
        } else {
            setEmailValidation(result);
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (emailValidationTimeout) {
            clearTimeout(emailValidationTimeout);
        }
        setEmailValidation(null);
        const newTimeout = setTimeout(() => handleEmailBlur(e.target.value), 1000);
        setEmailValidationTimeout(newTimeout);
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
  
  const handleReorderFromQueue = (item: PurchaseQueueItem) => {
    const itemForPO = {
      productId: item.productId,
      quantity: item.totalQuantity,
    };
    poForm.reset({
      supplierId: "",
      items: [itemForPO],
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

  const renderEmailValidation = () => {
    if (isEmailChecking) {
        return <p className="text-xs text-muted-foreground">Checking email...</p>;
    }
    if (emailValidation) {
        return <p className={`text-xs ${emailValidation.isValid ? 'text-green-500' : 'text-destructive'}`}>{emailValidation.reason}</p>;
    }
    return null;
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
                    <Input 
                        id="email" 
                        type="email" 
                        {...supplierForm.register("email")}
                        onBlur={(e) => handleEmailBlur(e.target.value)}
                        onChange={(e) => {
                           supplierForm.setValue("email", e.target.value);
                           supplierForm.trigger("email");
                           handleEmailChange(e);
                        }}
                    />
                    {supplierForm.formState.errors.email && <p className="text-sm text-destructive">{supplierForm.formState.errors.email.message}</p>}
                    {renderEmailValidation()}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" type="tel" {...supplierForm.register("phone")} />
                        {supplierForm.formState.errors.phone && <p className="text-sm text-destructive">{supplierForm.formState.errors.phone.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cellphoneNumber">Cellphone #</Label>
                        <Input id="cellphoneNumber" type="tel" {...supplierForm.register("cellphoneNumber")} />
                        {supplierForm.formState.errors.cellphoneNumber && <p className="text-sm text-destructive">{supplierForm.formState.errors.cellphoneNumber.message}</p>}
                    </div>
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
                            <CardDescription>Items that require purchasing from a supplier.</CardDescription>
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
                                        orderId === "Reorder" 
                                        ? <Button key={orderId} variant="outline" size="sm" className="h-6 px-2 font-mono" onClick={() => handleReorderFromQueue(item)}>Reorder</Button>
                                        : <Badge key={orderId} variant="secondary" className="font-mono">{orderId}</Badge>
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
                        <TableRow key={po.id} onClick={() => setSelectedPO(po)} className="cursor-pointer">
                          <TableCell className="font-medium">{po.poNumber}</TableCell>
                          <TableCell>{po.supplier.name}</TableCell>
                          <TableCell>{formatDateSimple(po.orderDate)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[po.status] || "default"}>{po.status}</Badge>
                          </TableCell>
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
                                 <DropdownMenuItem onClick={() => setSelectedPO(po)}>View Details</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {po.status === 'Pending' && (
                                    <DropdownMenuItem onClick={() => handlePOStatusChange(po.id, 'Shipped')}>
                                    Mark as Shipped
                                    </DropdownMenuItem>
                                )}
                                {po.status === 'Shipped' && (
                                    <DropdownMenuItem onClick={() => handlePOStatusChange(po.id, 'Received')}>
                                    Mark as Received
                                    </DropdownMenuItem>
                                )}
                                {po.status === 'Received' && <DropdownMenuItem disabled>Order Received</DropdownMenuItem>}
                                {po.status === 'Received' && (
                                    <DropdownMenuItem onClick={() => setPoForReturn(po)}>
                                      <RefreshCcw className="mr-2 h-4 w-4" />
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
                    <TableHead>Cellphone #</TableHead>
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
                        <TableCell>{supplier.cellphoneNumber || 'N/A'}</TableCell>
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
                <Label htmlFor="price-order">Price (Optional)</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                  <Input id="price-order" type="number" step="0.01" className="pl-8" placeholder="0.00" {...productForm.register("price")} />
                </div>
                {productForm.formState.errors.price && <p className="text-sm text-destructive">{productForm.formState.errors.price.message}</p>}
              </div>
            </div>
             <div className="grid grid-cols-2 gap-4">
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
                  <Input 
                    id="edit-email" 
                    type="email" 
                    {...editSupplierForm.register("email")}
                    onBlur={(e) => handleEmailBlur(e.target.value)}
                    onChange={(e) => {
                        editSupplierForm.setValue("email", e.target.value);
                        editSupplierForm.trigger("email");
                        handleEmailChange(e);
                    }}
                   />
                  {editSupplierForm.formState.errors.email && <p className="text-sm text-destructive">{editSupplierForm.formState.errors.email.message}</p>}
                   {renderEmailValidation()}
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-phone">Phone</Label>
                        <Input id="edit-phone" type="tel" {...editSupplierForm.register("phone")} />
                        {editSupplierForm.formState.errors.phone && <p className="text-sm text-destructive">{editSupplierForm.formState.errors.phone.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-cellphoneNumber">Cellphone #</Label>
                        <Input id="edit-cellphoneNumber" type="tel" {...editSupplierForm.register("cellphoneNumber")} />
                        {editSupplierForm.formState.errors.cellphoneNumber && <p className="text-sm text-destructive">{editSupplierForm.formState.errors.cellphoneNumber.message}</p>}
                    </div>
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

    {poForReturn && (
      <Dialog open={!!poForReturn} onOpenChange={(isOpen) => { if (!isOpen) setPoForReturn(null) }}>
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

              <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setPoForReturn(null)}>Cancel</Button>
                  <Button type="submit" disabled={outboundReturnForm.formState.isSubmitting}>
                      {outboundReturnForm.formState.isSubmitting ? "Initiating..." : "Initiate Return"}
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
          <AlertDialogAction onClick={handleDeletePOConfirm} className={buttonVariants({ variant: "destructive" })}>
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )}
    </>
  );
}
