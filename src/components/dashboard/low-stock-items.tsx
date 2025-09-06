"use client";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const lowStockItems = [
  {
    name: "Ergo-Comfort Mouse",
    stock: 8,
    sku: "EC-M-001",
    img: "https://picsum.photos/100/100?random=1",
    aiHint: "computer mouse",
  },
  {
    name: "Mechanical Keyboard",
    stock: 5,
    sku: "MK-K-003",
    img: "https://picsum.photos/100/100?random=2",
    aiHint: "computer keyboard",
  },
  {
    name: "4K UHD Monitor",
    stock: 2,
    sku: "4K-M-007",
    img: "https://picsum.photos/100/100?random=3",
    aiHint: "computer monitor",
  },
];

type Item = (typeof lowStockItems)[0];

export function LowStockItems() {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isReorderOpen, setIsReorderOpen] = useState(false);

  const handleReorderClick = () => {
    setIsReorderOpen(true);
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
          {lowStockItems.map((item) => (
            <div key={item.sku} className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg" onClick={() => setSelectedItem(item)}>
              <Image
                alt={item.name}
                className="rounded-md"
                height={48}
                width={48}
                src={item.img}
                data-ai-hint={item.aiHint}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">Stock: {item.stock}</p>
              </div>
            </div>
          ))}
        </div>

        {selectedItem && (
          <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedItem.name}</DialogTitle>
                <DialogDescription>SKU: {selectedItem.sku}</DialogDescription>
              </DialogHeader>
              <div className="flex gap-4">
                <Image
                  alt={selectedItem.name}
                  className="rounded-lg"
                  height={100}
                  width={100}
                  src={selectedItem.img}
                  data-ai-hint={selectedItem.aiHint}
                />
                <div>
                  <h3 className="font-semibold">Current Stock</h3>
                  <p className="text-4xl font-bold font-headline text-destructive">{selectedItem.stock}</p>
                  <p className="text-sm text-muted-foreground">units</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedItem(null)}>Cancel</Button>
                <Button onClick={handleReorderClick}>Reorder</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {selectedItem && (
          <Dialog open={isReorderOpen} onOpenChange={setIsReorderOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Reordering: {selectedItem.name}</DialogDescription>
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
                <Button variant="outline" onClick={() => setIsReorderOpen(false)}>Cancel</Button>
                <Button onClick={() => { setIsReorderOpen(false); setSelectedItem(null); }}>Submit PO</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
