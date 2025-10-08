
"use client";

import { useState, useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { PlusCircle, X, Briefcase, ChevronsUpDown, Check } from "lucide-react";

import { useData } from "@/context/data-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addMaterialRequisition } from "@/services/data-service";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { MaterialRequisition } from "@/types";

const requisitionItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

const requisitionSchema = z.object({
  projectId: z.string().min(1, "A project must be selected."),
  items: z.array(requisitionItemSchema).min(1, "At least one material is required."),
});

type RequisitionFormValues = z.infer<typeof requisitionSchema>;

export default function ProductionPage() {
  const { clients, products, loading, refetchData } = useData();
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [isClientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [productPopovers, setProductPopovers] = useState<Record<number, boolean>>({});

  const form = useForm<RequisitionFormValues>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: {
      items: [{ productId: "", quantity: 1 }],
    },
  });
  
  const { control, handleSubmit, register, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const onSubmit = async (data: RequisitionFormValues) => {
    if (!userProfile) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to create a request." });
        return;
    }
    try {
      await addMaterialRequisition({
        ...data,
        requestedBy: userProfile.uid,
      });
      toast({
        title: "Success",
        description: "Material requisition has been submitted.",
      });
      form.reset({
        projectId: "",
        items: [{ productId: "", quantity: 1 }],
      });
      await refetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit requisition.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };
  
  const formatDate = (date: Date) => {
      return format(date, 'PPP');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Production Management</h1>
        <p className="text-muted-foreground">Create material requisitions and manage production workflows.</p>
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>New Material Requisition</CardTitle>
                <CardDescription>Request materials from the warehouse for a specific project.</CardDescription>
            </CardHeader>
            <CardContent>
                 <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Project</Label>
                        <Controller
                            name="projectId"
                            control={control}
                            render={({ field }) => (
                                <Popover open={isClientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Briefcase />
                                                {field.value
                                                    ? clients.find(c => c.id === field.value)?.projectName
                                                    : "Select a project"}
                                            </div>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search project..." />
                                            <CommandEmpty>No project found.</CommandEmpty>
                                            <CommandList>
                                                <CommandGroup>
                                                    {clients.map(c => (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={c.id}
                                                            onSelect={(currentValue) => {
                                                                field.onChange(currentValue === field.value ? "" : currentValue)
                                                                setClientPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", field.value === c.id ? "opacity-100" : "opacity-0")} />
                                                            {c.projectName} ({c.clientName})
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                         {errors.projectId && <p className="text-sm text-destructive">{errors.projectId.message}</p>}
                    </div>

                    <div className="space-y-4">
                      <Label>Materials</Label>
                      {fields.map((item, index) => {
                        const selectedProduct = products.find(p => p.id === form.watch(`items.${index}.productId`));
                        return (
                            <div key={item.id} className="grid grid-cols-[1fr_100px_auto] gap-2 items-start p-3 border rounded-md">
                                <div className="flex flex-col gap-1">
                                    <Controller
                                      name={`items.${index}.productId`}
                                      control={control}
                                      render={({ field }) => (
                                        <Popover open={productPopovers[index]} onOpenChange={(open) => setProductPopovers(prev => ({ ...prev, [index]: open }))}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                                    {field.value ? products.find(p => p.id === field.value)?.name : "Select material"}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                 <Command>
                                                    <CommandInput placeholder="Search material..." />
                                                    <CommandEmpty>No material found.</CommandEmpty>
                                                    <CommandList>
                                                        {products.map(p => (
                                                            <CommandItem
                                                                key={p.id}
                                                                value={p.name}
                                                                onSelect={() => {
                                                                    field.onChange(p.id)
                                                                    setProductPopovers(prev => ({...prev, [index]: false}))
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", field.value === p.id ? "opacity-100" : "opacity-0")} />
                                                                {p.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandList>
                                                 </Command>
                                            </PopoverContent>
                                        </Popover>
                                      )}
                                    />
                                    {selectedProduct && <p className="text-xs text-muted-foreground px-1">Stock: {selectedProduct.stock}</p>}
                                    {errors.items?.[index]?.productId && <p className="text-xs text-destructive">{errors.items[index]?.productId?.message}</p>}
                                </div>
                                <div>
                                    <Input type="number" placeholder="Qty" {...register(`items.${index}.quantity`)} />
                                    {errors.items?.[index]?.quantity && <p className="text-xs text-destructive">{errors.items[index]?.quantity?.message}</p>}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => remove(index)}><X className="h-4 w-4" /></Button>
                            </div>
                        )
                      })}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => append({ productId: "", quantity: 1 })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Material
                      </Button>
                       {errors.items && <p className="text-sm text-destructive mt-2">{errors.items.root?.message || errors.items.message}</p>}
                    </div>
                    
                    <div className="pt-2">
                        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Submitting..." : "Submit Material Requisition"}
                        </Button>
                    </div>
                 </form>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Recent Requisitions</CardTitle>
                <CardDescription>A log of the most recent material requests.</CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground text-center py-10">No material requisitions have been created yet.</p>
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
