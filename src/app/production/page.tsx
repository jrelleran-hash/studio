
"use client";

import { useState, useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, X, ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";

import { useData } from "@/context/data-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { addMaterialRequisition } from "@/services/data-service";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const materialRequisitionItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

const createMaterialRequisitionSchema = (products: any[]) => z.object({
  projectId: z.string().min(1, "A project must be selected."),
  items: z.array(materialRequisitionItemSchema).min(1, "At least one material is required.")
    .superRefine((items, ctx) => {
        items.forEach((item, index) => {
            const product = products.find(p => p.id === item.productId);
            if (product && product.stock < item.quantity) {
                ctx.addIssue({
                    path: [`items.${index}.quantity`],
                    message: `Stock insufficient. Only ${product.stock} available.`,
                    code: z.ZodIssueCode.custom
                });
            }
        });
    }),
});

type MaterialRequisitionFormValues = z.infer<ReturnType<typeof createMaterialRequisitionSchema>>;

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Fulfilled: "default",
  Pending: "secondary",
  Rejected: "destructive",
  Approved: "outline",
};

export default function ProductionPage() {
  const { clients, products, materialRequisitions, loading, refetchData } = useData();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const [productPopovers, setProductPopovers] = useState<Record<number, boolean>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const materialRequisitionSchema = useMemo(() => createMaterialRequisitionSchema(products), [products]);

  const form = useForm<MaterialRequisitionFormValues>({
    resolver: zodResolver(materialRequisitionSchema),
    defaultValues: {
      items: [{ productId: "", quantity: 1 }],
    },
    mode: "onChange",
  });

  const { control, handleSubmit } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const onSubmit = async (data: MaterialRequisitionFormValues) => {
    if (!userProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to make a request.'});
        return;
    }
    try {
      await addMaterialRequisition({ ...data, requestedBy: userProfile.uid });
      toast({ title: 'Success', description: 'Material requisition has been submitted.'});
      form.reset({ items: [{ productId: "", quantity: 1 }], projectId: "" });
      setIsDialogOpen(false);
      await refetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit request.";
      toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    }
  };

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Production Management</h1>
        <p className="text-muted-foreground">Create material requisitions and manage production workflows.</p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Recent Requisitions</CardTitle>
                    <CardDescription>A log of the most recent material requests.</CardDescription>
                </div>
                 <DialogTrigger asChild>
                    <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Requisition</Button>
                </DialogTrigger>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>MRF #</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : materialRequisitions.length > 0 ? (
                            materialRequisitions.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell>{req.mrfNumber}</TableCell>
                                    <TableCell>{req.projectName || 'General Use'}</TableCell>
                                    <TableCell>{format(req.date.toDate(), 'PP')}</TableCell>
                                    <TableCell>{req.requestedByName}</TableCell>
                                    <TableCell><Badge variant={statusVariant[req.status] || 'default'}>{req.status}</Badge></TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No material requisitions have been created yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Material Requisition</DialogTitle>
            <DialogDescription>Request materials from the warehouse for a specific project.</DialogDescription>
          </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general-use">General Use</SelectItem>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.projectName} ({c.clientName})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                 {form.formState.errors.projectId && <p className="text-sm text-destructive">{form.formState.errors.projectId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Materials</Label>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
                       <div className="flex flex-col gap-1">
                        <Controller
                            control={form.control}
                            name={`items.${index}.productId`}
                            render={({ field: controllerField }) => (
                                <Popover open={productPopovers[index]} onOpenChange={(open) => setProductPopovers(prev => ({...prev, [index]: open}))}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between font-normal", !controllerField.value && "text-muted-foreground")}
                                        >
                                            {controllerField.value ? products.find(p => p.id === controllerField.value)?.name : "Select material"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search material..." />
                                            <CommandEmpty>No materials found.</CommandEmpty>
                                            <CommandList>
                                                <CommandGroup>
                                                    {products.map(p => (
                                                        <CommandItem
                                                            key={p.id}
                                                            value={p.name}
                                                            onSelect={() => {
                                                                controllerField.onChange(p.id)
                                                                setProductPopovers(prev => ({...prev, [index]: false}));
                                                            }}
                                                        >
                                                             <div className="flex items-center justify-between w-full">
                                                                <div className="flex items-center">
                                                                    <Check className={cn("mr-2 h-4 w-4", controllerField.value === p.id ? "opacity-100" : "opacity-0")} />
                                                                    {p.name}
                                                                </div>
                                                                <span className="ml-auto text-xs text-muted-foreground">Stock: {p.stock}</span>
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
                       <div className="flex flex-col gap-1">
                            <Input
                                type="number"
                                placeholder="Qty"
                                className="w-24"
                                {...form.register(`items.${index}.quantity`)}
                            />
                             {form.formState.errors.items?.[index]?.quantity && <p className="text-xs text-destructive">{form.formState.errors.items?.[index]?.quantity?.message}</p>}
                       </div>
                         <Button variant="ghost" size="icon" className="shrink-0 mt-1" onClick={() => remove(index)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1 })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Material
                </Button>
                 {form.formState.errors.items && !Array.isArray(form.formState.errors.items) && <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>}
              </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting || !form.formState.isValid}>
                    {form.formState.isSubmitting ? "Submitting..." : "Submit Material Requisition"}
              </Button>
            </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
    