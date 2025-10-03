
"use client";

import { useState, useMemo, useEffect } from "react";
import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Tool } from "@/types";
import { getDisposalItems, disposeItemsAndTools } from "@/services/data-service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

export default function WasteManagementPage() {
  const { tools, loading: initialLoading, refetchData } = useData();
  const { toast } = useToast();
  
  const [disposalItems, setDisposalItems] = useState<DisposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDisposeDialogOpen, setIsDisposeDialogOpen] = useState(false);
  const [disposalReason, setDisposalReason] = useState<"For Parts Out" | "Recycle" | "Dispose">("Dispose");


  const damagedTools = useMemo(() => {
    return tools.filter(t => t.condition === "Damaged");
  }, [tools]);
  
  const productsForDisposal = useMemo(() => disposalItems.filter(item => item.type === 'product'), [disposalItems]);
  const toolsForDisposal = useMemo(() => disposalItems.filter(item => item.type === 'tool'), [disposalItems]);


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
            dateMarked: tool.createdAt.toDate(),
        });
    });

    setDisposalItems(allItems.sort((a, b) => b.dateMarked.getTime() - a.dateMarked.getTime()));
    setLoading(false);
  }

  useEffect(() => {
    if(!initialLoading) fetchDisposalItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoading, tools]);

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

  const handleDisposeClick = (reason: "For Parts Out" | "Recycle" | "Dispose") => {
    setDisposalReason(reason);
    setIsDisposeDialogOpen(true);
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
                                    <TableRow key={item.id}>
                                        <TableCell><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={(c) => handleSelectItem(item.id, !!c)} /></TableCell>
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
                                    <TableRow key={item.id}>
                                        <TableCell><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={(c) => handleSelectItem(item.id, !!c)} /></TableCell>
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

    </div>
  );
}
