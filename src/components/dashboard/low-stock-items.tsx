
"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getLowStockProducts } from "@/services/data-service";
import type { Product } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { Package } from "lucide-react";

export function LowStockItems() {
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<Product | null>(null);

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      try {
        const fetchedItems = await getLowStockProducts();
        setLowStockItems(fetchedItems);
      } catch (error) {
        console.error("Failed to fetch low stock items", error);
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, []);
  
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
              </div>
            ))
          ) : lowStockItems.length > 0 ? (
            lowStockItems.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center gap-4 p-2 cursor-pointer hover:bg-muted/50 rounded-lg -m-2" 
                onClick={() => handleDetailsClick(item)}
              >
                <div className="p-2 bg-muted/50 rounded-md">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Stock: {item.stock}</p>
                </div>
              </div>
            ))
          ) : (
             <div className="text-sm text-muted-foreground text-center py-10">
                No items are currently low on stock.
            </div>
          )}
        </div>

        {selectedItemForDetails && (
          <Dialog open={!!selectedItemForDetails} onOpenChange={(open) => !open && setSelectedItemForDetails(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedItemForDetails.name}</DialogTitle>
                <DialogDescription>SKU: {selectedItemForDetails.sku}</DialogDescription>
              </DialogHeader>
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
               <div>
                  <h3 className="font-semibold">Supplier</h3>
                  <p className="text-sm text-muted-foreground">{selectedItemForDetails.supplier || 'Not specified'}</p>
                </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedItemForDetails(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

    