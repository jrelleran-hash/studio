
"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Tool } from "@/types";
import { getDisposalItems, disposeItemsAndTools, partOutTools } from "@/services/data-service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, ChevronDown, PlusCircle, X, Package } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const conditionVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Good: "default",
  "Needs Repair": "secondary",
  Damaged: "destructive",
};

interface DisposalItem {
    id: string;
    type: 'product' | 'tool';
    name: string;
    sku?: string;
    serialNumber?: string;
    quantity: number;
    source: string; // e.g., RMA-12345 or Tool ID
    dateMarked: Date;
}

const salvagedPartSchema = z.object({
  partName: z.string().min(1, "Part name is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  condition: z.enum(["Good", "Usable", "Poor"]),
});

const partsOutSchema = z.object({
  notes: z.string().optional(),
  parts: z.array(salvagedPartSchema).min(1, "At least one salvaged part is required."),
});
type PartsOutFormValues = z.infer<typeof partsOutSchema>;


export default function WasteManagementPage() {
  const { tools, loading: initialLoading, refetchData } = useData();
  const { toast } = useToast();
  
  const [disposalItems, setDisposalItems] = useState<DisposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDisposeDialogOpen, setIsDisposeDialogOpen] = useState(false);
  const [isPartsOutDialogOpen, setIsPartsOutDialogOpen] = useState(false);
  const [disposalReason, setDisposalReason] = useState<"For Parts Out" | "Recycle" | "Dispose">("Dispose");
  const [detailedTool, setDetailedTool] = useState<DisposalItem | null>(null);
  const [detailedProduct, setDetailedProduct] = useState<DisposalItem | null>(null);


  const damagedTools = useMemo(() => {
    return tools.filter(t => t.condition === "Damaged");
  }, [tools]);
  
  const productsForDisposal = useMemo(() => disposalItems.filter(item => item.type === 'product'), [disposalItems]);
  const toolsForDisposal = useMemo(() => disposalItems.filter(item => item.type === 'tool'), [disposalItems]);

  const partsOutForm = useForm<PartsOutFormValues>({
    resolver: zodResolver(partsOutSchema),
    defaultValues: { parts: [{ partName: "", quantity: 1, condition: "Usable"}] }
  });
  
  const { fields, append, remove } = useFieldArray({
      control: partsOutForm.control,
      name: "parts"
  });

  const toolsToPartOut = useMemo(() => {
    return tools.filter(tool => selectedItems.has(tool.id));
  }, [selectedItems, tools]);

  const fetchDisposalItems = async () => {
    setLoading(true);
    const items = await getDisposalItems();
    
    const allItems: DisposalItem[] = items.map(item => ({
        id: `${item.returnId}-${item.productId}`,
        type: 'product',
        name: item.productName,
        sku: item.productSku,
        quantity: item.disposalQuantity,
        source: `RMA: ${item.rmaNumber}`,
        dateMarked: item.inspectionDate,
    }));
    
    damagedTools.forEach(tool => {
        allItems.push({
            id: tool.id,
            type: 'tool',
            name: tool.name,
            serialNumber: tool.serialNumber,
            quantity: 1,
            source: `Tool ID: ${tool.id.substring(0,6)}`,
            dateMarked: tool.createdAt,
        });
    });

    setDisposalItems(allItems.sort((a, b) => b.dateMarked.getTime() - a.dateMarked.getTime()));
    setLoading(false);
  }

  useEffect(() => {
    if(!initialLoading) fetchDisposalItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoading, tools]);
  
  useEffect(() => {
    if (!isPartsOutDialogOpen) {
        partsOutForm.reset({ parts: [{ partName: "", quantity: 1, condition: "Usable"}] });
    }
  }, [isPartsOutDialogOpen, partsOutForm]);


  const handleSelectAll = (checked: boolean, list: DisposalItem[]) => {
    const newSelection = new Set(selectedItems);
    if(checked) {
        list.forEach(item => newSelection.add(item.id));
    } else {
        list.forEach(item => newSelection.delete(item.id));
    }
    setSelectedItems(newSelection);
  }

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedItems);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedItems(newSelection);
  }

  const handleDisposeClick = (reason: "For Parts Out" | "Recycle" | "Dispose", singleItemId?: string) => {
    const itemsToProcess = singleItemId ? new Set([singleItemId]) : selectedItems;

    if (reason === 'For Parts Out') {
        const hasProducts = Array.from(itemsToProcess).some(id => disposalItems.find(item => item.id === id)?.type === 'product');
        const selectedTools = Array.from(itemsToProcess).map(id => disposalItems.find(item => item.id === id)).filter(item => item?.type === 'tool');

        if (hasProducts || selectedTools.length === 0) {
            toast({ variant: 'destructive', title: 'Invalid Selection', description: 'You can only part out tools, not products.' });
            return;
        }
        
        // Update selected items to only include the tools being parted out
        setSelectedItems(new Set(selectedTools.map(t => t!.id)));

        setIsPartsOutDialogOpen(true);
    } else {
        if(singleItemId) {
            setSelectedItems(new Set([singleItemId]));
        }
        setDisposalReason(reason);
        setIsDisposeDialogOpen(true);
    }
  }
  
  const handleDisposeConfirm = async () => {
    const itemsToDispose = Array.from(selectedItems).map(id => {
        const item = disposalItems.find(i => i.id === id);
        if(!item) return null;
        return {
            id: item.type === 'product' ? item.source.split('-')[1] : item.id, // A bit of a hack to get original doc ID
            type: item.type,
            sourceId: item.type === 'product' ? item.source.split('RMA: ')[1] : item.id
        }
    }).filter(Boolean) as {id: string, type: 'product' | 'tool', sourceId: string}[];

    try {
        await disposeItemsAndTools(itemsToDispose, disposalReason);
        toast({ title: "Success", description: "Selected items have been disposed." });
        await refetchData();
        await fetchDisposalItems();
        setSelectedItems(new Set());
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to dispose items.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
    } finally {
        setIsDisposeDialogOpen(false);
    }
  }

  const onPartsOutSubmit = async (data: PartsOutFormValues) => {
    try {
      const toolIds = toolsToPartOut.map(t => t.id);
      await partOutTools(toolIds, data.parts, data.notes);
      toast({ title: "Success", description: "Tools have been parted out and salvaged parts are recorded." });
      await refetchData();
      await fetchDisposalItems();
      setSelectedItems(new Set());
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "Failed to part out tools.";
       toast({ variant: "destructive", title: "Error", description: errorMessage });
    } finally {
      setIsPartsOutDialogOpen(false);
    }
  };
  
  const isAllProductsSelected = productsForDisposal.length > 0 && productsForDisposal.every(item => selectedItems.has(item.id));
  const isAllToolsSelected = toolsForDisposal.length > 0 && toolsForDisposal.every(item => selectedItems.has(item.id));


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Waste Management</h1>
        <p className="text-muted-foreground">Manage and dispose of damaged, defective, or expired items.</p>
      </div>

       <Tabs defaultValue="products">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="tools">Tools</TabsTrigger>
            </TabsList>
            {selectedItems.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Dispose Selected ({selectedItems.size})
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleDisposeClick("For Parts Out")}>
                      For Parts Out
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDisposeClick("Recycle")}>
                      Recycle
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDisposeClick("Dispose")}
                    >
                      Dispose Permanently
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}
          </div>
          <TabsContent value="products">
             <Card>
                <CardHeader>
                    <CardTitle>Products for Disposal</CardTitle>
                    <CardDescription>Items marked for disposal during quality control inspections.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"><Checkbox checked={isAllProductsSelected} onCheckedChange={(c) => handleSelectAll(!!c, productsForDisposal)} /></TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Date Marked</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading || initialLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={6}><Skeleton className="h-8" /></TableCell>
                                    </TableRow>
                                ))
                            ) : productsForDisposal.length > 0 ? (
                                productsForDisposal.map((item) => (
                                    <TableRow key={item.id} onClick={() => setDetailedProduct(item)} className="cursor-pointer">
                                        <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={(c) => handleSelectItem(item.id, !!c)} /></TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.sku}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>{item.source}</TableCell>
                                        <TableCell>{format(item.dateMarked, "PPP")}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">No products are currently marked for disposal.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tools">
             <Card>
                <CardHeader>
                    <CardTitle>Damaged Tools</CardTitle>
                    <CardDescription>Tools that are marked as damaged and out of service.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"><Checkbox checked={isAllToolsSelected} onCheckedChange={(c) => handleSelectAll(!!c, toolsForDisposal)} /></TableHead>
                                <TableHead>Tool</TableHead>
                                <TableHead>Serial #</TableHead>
                                <TableHead>Date Added</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {loading || initialLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-8" /></TableCell>
                                    </TableRow>
                                ))
                            ) : toolsForDisposal.length > 0 ? (
                                toolsForDisposal.map((item) => (
                                    <TableRow key={item.id} onClick={() => setDetailedTool(item)} className="cursor-pointer">
                                        <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={(c) => handleSelectItem(item.id, !!c)} /></TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.serialNumber}</TableCell>
                                        <TableCell>{format(item.dateMarked, "PPP")}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No tools are currently marked as damaged.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </TabsContent>
       </Tabs>
       
        <AlertDialog open={isDisposeDialogOpen} onOpenChange={setIsDisposeDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action will permanently remove the selected items from the system according to the reason: <strong className="text-foreground">{disposalReason}</strong>. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisposeConfirm} className={buttonVariants({ variant: "destructive" })}>
                        Confirm Disposal
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isPartsOutDialogOpen} onOpenChange={setIsPartsOutDialogOpen}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Salvage Parts from Tools</DialogTitle>
                    <DialogDescription>
                        Log the usable parts salvaged from the selected tools before they are disposed of.
                    </DialogDescription>
                </DialogHeader>
                 <form onSubmit={partsOutForm.handleSubmit(onPartsOutSubmit)}>
                    <div className="py-4 space-y-4">
                       <div>
                            <h4 className="font-semibold text-sm mb-2">Tools being parted out:</h4>
                            <div className="flex flex-wrap gap-2">
                                {toolsToPartOut.map(tool => (
                                    <Badge key={tool.id} variant="secondary">{tool.name} ({tool.serialNumber})</Badge>
                                ))}
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                             <Label>Salvaged Parts</Label>
                             <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-start p-3 border rounded-md">
                                        <div className="space-y-1">
                                            <Label htmlFor={`parts.${index}.partName`} className="sr-only">Part Name</Label>
                                            <Input
                                                id={`parts.${index}.partName`}
                                                placeholder="Part Name"
                                                {...partsOutForm.register(`parts.${index}.partName`)}
                                            />
                                            {partsOutForm.formState.errors.parts?.[index]?.partName && <p className="text-xs text-destructive">{partsOutForm.formState.errors.parts?.[index]?.partName?.message}</p>}
                                        </div>
                                         <div className="space-y-1">
                                             <Label htmlFor={`parts.${index}.quantity`} className="sr-only">Quantity</Label>
                                             <Input
                                                id={`parts.${index}.quantity`}
                                                type="number"
                                                placeholder="Qty"
                                                {...partsOutForm.register(`parts.${index}.quantity`)}
                                            />
                                            {partsOutForm.formState.errors.parts?.[index]?.quantity && <p className="text-xs text-destructive">{partsOutForm.formState.errors.parts?.[index]?.quantity?.message}</p>}
                                        </div>
                                        <div className="space-y-1">
                                             <Label htmlFor={`parts.${index}.condition`} className="sr-only">Condition</Label>
                                            <Controller
                                                control={partsOutForm.control}
                                                name={`parts.${index}.condition`}
                                                render={({ field: controllerField }) => (
                                                    <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value}>
                                                        <SelectTrigger><SelectValue placeholder="Condition..." /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Good">Good</SelectItem>
                                                            <SelectItem value="Usable">Usable</SelectItem>
                                                            <SelectItem value="Poor">Poor</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                         <Button variant="ghost" size="icon" onClick={() => remove(index)}><X className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                             </div>
                             <Button type="button" variant="outline" size="sm" onClick={() => append({ partName: "", quantity: 1, condition: "Usable" })}>
                                 <PlusCircle className="mr-2 h-4 w-4" />Add Part
                             </Button>
                        </div>
                        
                        <div className="space-y-2">
                             <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea id="notes" {...partsOutForm.register("notes")} placeholder="Any additional notes about the parting out process..."/>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsPartsOutDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={partsOutForm.formState.isSubmitting}>
                            {partsOutForm.formState.isSubmitting ? "Processing..." : "Confirm & Dispose Tools"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        
        {detailedTool && (
             <Dialog open={!!detailedTool} onOpenChange={(open) => !open && setDetailedTool(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{detailedTool.name}</DialogTitle>
                        <DialogDescription>Serial #: {detailedTool.serialNumber}</DialogDescription>
                    </DialogHeader>
                     <div className="py-4 space-y-2">
                        <p><strong>Status:</strong> <Badge variant="destructive">Damaged</Badge></p>
                        <p><strong>Source:</strong> {detailedTool.source}</p>
                        <p><strong>Date Marked for Disposal:</strong> {format(detailedTool.dateMarked, "PPP")}</p>
                    </div>
                    <DialogFooter className="!justify-between">
                         <Button variant="outline" onClick={() => setDetailedTool(null)}>Close</Button>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Dispose Tool
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleDisposeClick("For Parts Out", detailedTool.id)}>
                                    For Parts Out
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDisposeClick("Recycle", detailedTool.id)}>
                                    Recycle
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDisposeClick("Dispose", detailedTool.id)}
                                >
                                Dispose Permanently
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}

        {detailedProduct && (
             <Dialog open={!!detailedProduct} onOpenChange={(open) => !open && setDetailedProduct(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{detailedProduct.name}</DialogTitle>
                        <DialogDescription>SKU: {detailedProduct.sku}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                         <p><strong>Quantity for Disposal:</strong> {detailedProduct.quantity}</p>
                        <p><strong>Source:</strong> {detailedProduct.source}</p>
                        <p><strong>Date Marked for Disposal:</strong> {format(detailedProduct.dateMarked, "PPP")}</p>
                    </div>
                    <DialogFooter>
                         <Button variant="outline" onClick={() => setDetailedProduct(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
    </div>
  );
}

    