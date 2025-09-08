
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, X, Printer } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getIssuances, getClients, getProducts, addIssuance, deleteIssuance } from "@/services/data-service";
import type { Issuance, Client, Product } from "@/types";
import { format } from "date-fns";
import React from 'react';
import { useAuth } from "@/hooks/use-auth";

const issuanceItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

// We need a way to pass the full product list to the schema for validation
const createIssuanceSchema = (products: Product[]) => z.object({
  clientId: z.string().min(1, "Client is required."),
  items: z.array(issuanceItemSchema)
    .min(1, "At least one item is required.")
    .superRefine((items, ctx) => {
        items.forEach((item, index) => {
            const product = products.find(p => p.id === item.productId);
            if (product && product.stock < item.quantity) {
                ctx.addIssue({
                    path: [`${index}.quantity`],
                    message: `Stock is insufficient. Only ${product.stock} available.`,
                    code: z.ZodIssueCode.custom
                });
            }
        });
    }),
  remarks: z.string().optional(),
});


type IssuanceFormValues = z.infer<ReturnType<typeof createIssuanceSchema>>;

// Printable Component
const PrintableIssuanceForm = React.forwardRef<HTMLDivElement, { issuance: Issuance }>(({ issuance }, ref) => {
  return (
    <div ref={ref} className="printable-content p-8 bg-white text-black">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
           <h1 className="text-3xl font-bold">Material Issuance</h1>
           <p className="text-gray-600">Issuance #: {issuance.issuanceNumber}</p>
        </div>
        <div className="text-right">
           <p className="text-sm">Date: {format(issuance.date, 'PPP')}</p>
           <p className="text-sm">Issued By: {issuance.issuedBy}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-lg font-semibold mb-2">Issued To</h2>
          <p className="font-bold">{issuance.client.clientName}</p>
          <p>{issuance.client.projectName}</p>
          <p>{issuance.client.address}</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">BOQ Number</h2>
          <p>{issuance.client.boqNumber}</p>
        </div>
      </div>
      
      <h2 className="text-lg font-semibold mb-2">Items Issued</h2>
      <table className="w-full text-left table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">#</th>
            <th className="p-2 border">Product Name</th>
            <th className="p-2 border">SKU</th>
            <th className="p-2 border text-center">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {issuance.items.map((item, index) => (
            <tr key={item.product.id}>
              <td className="p-2 border">{index + 1}</td>
              <td className="p-2 border">{item.product.name}</td>
              <td className="p-2 border">{item.product.sku}</td>
              <td className="p-2 border text-center">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {issuance.remarks && (
        <div className="mt-8">
            <h2 className="text-lg font-semibold mb-2">Remarks</h2>
            <p className="p-2 border bg-gray-50 rounded-md">{issuance.remarks}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-16 mt-24 pt-8">
        <div className="border-t pt-2">
            <p className="text-center">Issued By (Name & Signature)</p>
        </div>
        <div className="border-t pt-2">
            <p className="text-center">Received By (Name & Signature)</p>
        </div>
      </div>
    </div>
  );
});
PrintableIssuanceForm.displayName = "PrintableIssuanceForm";


export default function IssuancePage() {
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedIssuance, setSelectedIssuance] = useState<Issuance | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingIssuanceId, setDeletingIssuanceId] = useState<string | null>(null);


  // Memoize the schema so it's only recreated when products change
  const issuanceSchema = useMemo(() => createIssuanceSchema(products), [products]);

  const form = useForm<IssuanceFormValues>({
    resolver: zodResolver(issuanceSchema),
    defaultValues: {
      clientId: "",
      items: [{ productId: "", quantity: 1 }],
      remarks: "",
    },
    mode: "onChange", // Validate on change to give instant feedback
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  async function fetchPageData() {
    setLoading(true);
    try {
      const [fetchedIssuances, fetchedClients, fetchedProducts] = await Promise.all([
        getIssuances(),
        getClients(),
        getProducts()
      ]);
      setIssuances(fetchedIssuances);
      setClients(fetchedClients);
      setProducts(fetchedProducts);
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
  }

  useEffect(() => {
    fetchPageData();
  }, []);
  
  useEffect(() => {
    if(!isAddDialogOpen) {
      form.reset({
        clientId: "",
        items: [{ productId: "", quantity: 1 }],
        remarks: "",
      });
    }
  }, [isAddDialogOpen, form]);

  const onAddSubmit = async (data: IssuanceFormValues) => {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to create an issuance." });
        return;
    }
    try {
      await addIssuance({
          ...data,
          issuedBy: user.displayName || user.email || 'System'
      });
      toast({ title: "Success", description: "New issuance created and inventory updated." });
      setIsAddDialogOpen(false);
      fetchPageData(); // Refresh all data
    } catch (error) {
       console.error(error);
       const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };
  
  const handlePrint = () => {
    window.print();
  };

  const triggerPreview = (issuance: Issuance) => {
    setSelectedIssuance(issuance);
    setIsPreviewOpen(true);
  }

  const handleDeleteClick = (issuanceId: string) => {
    setDeletingIssuanceId(issuanceId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingIssuanceId) return;
    try {
      await deleteIssuance(deletingIssuanceId);
      toast({ title: "Success", description: "Issuance deleted and stock restored." });
      fetchPageData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete issuance.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingIssuanceId(null);
    }
  };


  const formatDate = (date: Date) => format(date, 'PPpp');
  
  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Material Issuance</CardTitle>
          <CardDescription>Track all materials issued to clients/projects.</CardDescription>
        </div>
         <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              Create Issuance
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Material Issuance</DialogTitle>
              <DialogDescription>Select the items to be issued from inventory.</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Client / Project</Label>
                 <Controller
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a client or project" />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clientName} - {c.projectName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                 />
                {form.formState.errors.clientId && <p className="text-sm text-destructive">{form.formState.errors.clientId.message}</p>}
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between items-center">
                    <Label>Items to Issue</Label>
                </div>
                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const selectedProductId = form.watch(`items.${index}.productId`);
                    const selectedProduct = products.find(p => p.id === selectedProductId);

                    return (
                      <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
                         <div className="flex flex-col gap-1">
                            <Controller
                                control={form.control}
                                name={`items.${index}.productId`}
                                render={({ field }) => (
                                    <Select onValueChange={(value) => field.onChange(value)} defaultValue={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.map(p => (
                                          <SelectItem key={p.id} value={p.id}>
                                            {p.name} (Stock: {p.stock})
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                )}
                            />
                            {form.formState.errors.items?.[index]?.productId && <p className="text-sm text-destructive">{form.formState.errors.items?.[index]?.productId?.message}</p>}
                        </div>
                        <div className="flex flex-col gap-1">
                            <Input 
                                type="number" 
                                placeholder="Qty" 
                                className="w-24"
                                {...form.register(`items.${index}.quantity`)}
                            />
                            {form.formState.errors.items?.[index]?.quantity ? (
                                <p className="text-sm text-destructive">{form.formState.errors.items?.[index]?.quantity?.message}</p>
                             ) : selectedProduct ? (
                                <span className="text-xs text-muted-foreground pl-1">Available: {selectedProduct.stock}</span>
                             ) : null
                           }
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                            <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                   })}
                </div>
                 {form.formState.errors.items && typeof form.formState.errors.items === 'object' && !Array.isArray(form.formState.errors.items) && <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1 })}>
                  <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea id="remarks" {...form.register("remarks")} placeholder="Optional notes about this issuance..." />
                </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!form.formState.isValid || form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Issuing..." : "Confirm & Issue"}
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
              <TableHead>Issuance #</TableHead>
              <TableHead>Client / Project</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items Issued</TableHead>
              <TableHead>Issued By</TableHead>
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
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (
              issuances.map((issuance) => (
                <TableRow key={issuance.id}>
                  <TableCell className="font-medium">{issuance.issuanceNumber}</TableCell>
                  <TableCell>{issuance.client.clientName} - {issuance.client.projectName}</TableCell>
                  <TableCell>{formatDate(issuance.date)}</TableCell>
                  <TableCell>{issuance.items.reduce((total, item) => total + item.quantity, 0)}</TableCell>
                  <TableCell>{issuance.issuedBy}</TableCell>
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
                        <DropdownMenuItem onClick={() => setSelectedIssuance(issuance)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => triggerPreview(issuance)}>
                          <Printer className="mr-2 h-4 w-4" />
                          <span>Print</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteClick(issuance.id)} className="text-destructive">
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
    
    {selectedIssuance && (
       <Dialog open={!!selectedIssuance} onOpenChange={(open) => !open && setSelectedIssuance(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Issuance Details: {selectedIssuance.issuanceNumber}</DialogTitle>
            <DialogDescription>
              Issued to: {selectedIssuance.client.clientName} ({selectedIssuance.client.projectName})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <strong>Date Issued:</strong>
              <p className="text-sm text-muted-foreground">{formatDate(selectedIssuance.date)}</p>
            </div>
            <div>
              <strong>Issued By:</strong>
              <p className="text-sm text-muted-foreground">{selectedIssuance.issuedBy}</p>
            </div>
            {selectedIssuance.remarks && (
              <div>
                <strong>Remarks:</strong>
                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">{selectedIssuance.remarks}</p>
              </div>
            )}
            <div>
              <h4 className="font-semibold mb-2">Items Issued:</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedIssuance.items.map(item => (
                   <div key={item.product.id} className="text-sm flex justify-between items-center bg-muted/50 p-2 rounded-md">
                        <span>{item.product.name} <span className="text-xs text-muted-foreground">({item.product.sku})</span></span>
                        <span className="font-mono text-xs">Qty: {item.quantity}</span>
                   </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIssuance(null)}>Close</Button>
            <Button onClick={() => triggerPreview(selectedIssuance)}>
              <Printer className="mr-2 h-4 w-4" />
              Preview & Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    
    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl print:max-w-none print:border-none print:shadow-none print:p-0">
            <DialogHeader className="print:hidden">
                <DialogTitle>Print Preview</DialogTitle>
                <DialogDescription>
                    Review the issuance form before printing.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto border rounded-md my-4 print:max-h-none print:overflow-visible print:border-none print:rounded-none print:my-0">
                {selectedIssuance && <PrintableIssuanceForm issuance={selectedIssuance} ref={printableRef} />}
            </div>
            <DialogFooter className="print:hidden">
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Cancel</Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            issuance record and restore the issued items back to inventory.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })}>
            Delete Issuance
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
