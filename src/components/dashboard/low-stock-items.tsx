
"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLowStockProducts } from "@/services/data-service";
import type { Product } from "@/types";
import { Skeleton } from "../ui/skeleton";


export function LowStockItems() {
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<Product | null>(null);
  const [selectedItemForReorder, setSelectedItemForReorder] = useState<Product | null>(null);

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const fetchedItems = await getLowStockProducts();
      setLowStockItems(fetchedItems);
      setLoading(false);
    }
    fetchItems();
  }, []);

  const handleReorderClick = (item: Product) => {
    setSelectedItemForReorder(item);
  };
  
  const handleDetailsClick = (item: Product) => {
    setSelectedItemForDetails(item);
  };

  return (
    <Card className="card-gradient h-full">
      <CardHeader>
        <CardTitle>Low Stock Items</CardTitle>
        <CardDescription>
          Items that need to be reordered soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
             Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 p-2">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                 <Skeleton className="h-8 w-20" />
              </div>
            ))
          ) : (
            lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-2">
                <div 
                  className="flex items-center gap-4 flex-1 cursor-pointer hover:bg-muted/50 p-2 rounded-lg -m-2" 
                  onClick={() => handleDetailsClick(item)}
                >
                    <Image
                      alt={item.name}
                      className="rounded-md"
                      height={48}
                      width={48}
                      src={`https://picsum.photos/seed/${item.id}/100/100`}
                    />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Stock: {item.stock}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleReorderClick(item)}>
                  Reorder
                </Button>
              </div>
            ))
          )}
        </div>

        {selectedItemForDetails && (
          <Dialog open={!!selectedItemForDetails} onOpenChange={(open) => !open && setSelectedItemForDetails(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedItemForDetails.name}</DialogTitle>
                <DialogDescription>SKU: {selectedItemForDetails.sku}</DialogDescription>
              </DialogHeader>
              <div className="flex gap-4">
                <Image
                  alt={selectedItemForDetails.name}
                  className="rounded-lg"
                  height={100}
                  width={100}
                  src={`https://picsum.photos/seed/${selectedItemForDetails.id}/100/100`}
                />
                <div className="grid grid-cols-2 gap-4 flex-1">
                   <div>
                    <h3 className="font-semibold">Current Stock</h3>
                    <p className="text-4xl font-bold font-headline text-destructive">{selectedItemForDetails.stock}</p>
                    <p className="text-sm text-muted-foreground">units</p>
                  </div>
                   <div>
                    <h3 className="font-semibold">Reorder At</h3>
                    <p className="text-4xl font-bold font-headline">{selectedItemForDetails.reorderLimit}</p>
                    <p className="text-sm text-muted-foreground">units</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedItemForDetails(null)}>Close</Button>
                <Button onClick={() => {
                  setSelectedItemForDetails(null);
                  handleReorderClick(selectedItemForDetails);
                }}>Reorder</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
        {selectedItemForReorder && (
          <Dialog open={!!selectedItemForReorder} onOpenChange={(open) => !open && setSelectedItemForReorder(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Reordering: {selectedItemForReorder.name}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="quantity" className="text-right">Quantity</Label>
                  <Input id="quantity" defaultValue="50" className="col-span-3" type="number" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="supplier" className="text-right">Supplier</Label>
                  <Input id="supplier" defaultValue="Default Supplier Inc." className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedItemForReorder(null)}>Cancel</Button>
                <Button onClick={() => { setSelectedItemForReorder(null); }}>Submit PO</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      </CardContent>
    </Card>
  );
}
