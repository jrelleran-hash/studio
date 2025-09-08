
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { getIssuances, getClients, getProducts, addIssuance } from "@/services/data-service";
import type { Issuance, Client, Product } from "@/types";
import { format } from "date-fns";

const issuanceItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

const issuanceSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  items: z.array(issuanceItemSchema).min(1, "At least one item is required."),
  remarks: z.string().optional(),
});

type IssuanceFormValues = z.infer<typeof issuanceSchema>;

export default function IssuancePage() {
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedIssuance, setSelectedIssuance] = useState<Issuance | null>(null);


  const form = useForm<IssuanceFormValues>({
    resolver: zodResolver(issuanceSchema),
    defaultValues: {
      clientId: "",
      items: [{ productId: "", quantity: 1 }],
      remarks: "",
    },
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
    try {
      await addIssuance(data);
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
                 <Select onValueChange={(value) => form.setValue('clientId', value)} defaultValue={form.getValues('clientId')}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a client or project" />
                    </SelectTrigger>
                    <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clientName} - {c.projectName}</SelectItem>)}
                    </SelectContent>
                </Select>
                {form.formState.errors.clientId && <p className="text-sm text-destructive">{form.formState.errors.clientId.message}</p>}
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between items-center">
                    <Label>Items to Issue</Label>
                </div>
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const selectedProductId = form.watch(`items.${index}.productId`);
                    const selectedProduct = products.find(p => p.id === selectedProductId);

                    return (
                      <div key={field.id} className="flex items-start gap-2">
                        <div className="flex-1">
                            <Select onValueChange={(value) => form.setValue(`items.${index}.productId`, value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a product" />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="relative">
                            <Input 
                                type="number" 
                                placeholder="Qty" 
                                className="w-24"
                                {...form.register(`items.${index}.quantity`)}
                            />
                            {selectedProduct && <span className="absolute -bottom-4 right-1 text-xs text-muted-foreground">Stock: {selectedProduct.stock}</span>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                            <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                   })}
                </div>
                 {form.formState.errors.items && <p className="text-sm text-destructive">{typeof form.formState.errors.items === 'string' ? form.formState.errors.items : 'Please add at least one item.'}</p>}
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
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (
              issuances.map((issuance) => (
                <TableRow key={issuance.id} className="cursor-pointer" onClick={() => setSelectedIssuance(issuance)}>
                  <TableCell className="font-medium">{issuance.issuanceNumber}</TableCell>
                  <TableCell>{issuance.client.clientName} - {issuance.client.projectName}</TableCell>
                  <TableCell>{formatDate(issuance.date)}</TableCell>
                  <TableCell>{issuance.items.length}</TableCell>
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
                        <DropdownMenuItem onClick={(e) => {e.stopPropagation(); setSelectedIssuance(issuance)}}>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Print</DropdownMenuItem>
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
            <Button>Print Issuance Form</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    </>
  );
}
