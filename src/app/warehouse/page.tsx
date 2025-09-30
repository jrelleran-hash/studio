
"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useData } from "@/context/data-context";
import type { Product, ProductLocation } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";

interface LocationTree {
  [zone: string]: {
    [aisle: string]: {
      [rack: string]: {
        [level: string]: {
          [bin: string]: Product[];
        };
      };
    };
  };
}

const getStatus = (product: Product): { text: string; variant: "default" | "secondary" | "destructive" } => {
    if (product.stock === 0) return { text: "Out of Stock", variant: "destructive" };
    if (product.stock <= product.reorderLimit) return { text: "Low Stock", variant: "secondary" };
    return { text: "In Stock", variant: "default" };
};


export default function WarehousePage() {
    const { products, loading } = useData();
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const locationTree = useMemo(() => {
        const tree: LocationTree = {};
        products.forEach(product => {
            const loc = product.location;
            if (loc && (loc.zone || loc.aisle || loc.rack || loc.level || loc.bin)) {
                const zone = loc.zone || 'Unzoned';
                const aisle = loc.aisle || 'No Aisle';
                const rack = loc.rack || 'No Rack';
                const level = loc.level || 'No Level';
                const bin = loc.bin || 'No Bin';

                if (!tree[zone]) tree[zone] = {};
                if (!tree[zone][aisle]) tree[zone][aisle] = {};
                if (!tree[zone][aisle][rack]) tree[zone][aisle][rack] = {};
                if (!tree[zone][aisle][rack][level]) tree[zone][aisle][rack][level] = {};
                if (!tree[zone][aisle][rack][level][bin]) tree[zone][aisle][rack][level][bin] = [];
                
                tree[zone][aisle][rack][level][bin].push(product);
            }
        });
        return tree;
    }, [products]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold font-headline tracking-tight">Warehouse Map</h1>
                <p className="text-muted-foreground">A virtual representation of your inventory storage.</p>
            </div>
             {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : (
                <Accordion type="multiple" className="w-full space-y-2">
                {Object.keys(locationTree).sort().map(zone => (
                    <AccordionItem key={zone} value={zone} className="border-none">
                        <Card className="bg-card/50">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <CardTitle className="text-lg">Zone: {zone}</CardTitle>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                 <Accordion type="multiple" className="w-full space-y-2">
                                    {Object.keys(locationTree[zone]).sort().map(aisle => (
                                        <AccordionItem key={aisle} value={aisle} className="border-none">
                                            <Card className="bg-card/70">
                                                <AccordionTrigger className="p-3 hover:no-underline">
                                                    <CardTitle className="text-base">Aisle: {aisle}</CardTitle>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-3 pb-3">
                                                    {Object.keys(locationTree[zone][aisle]).sort().map(rack => (
                                                         <div key={rack} className="mt-2">
                                                            <h4 className="font-semibold px-1">Rack: {rack}</h4>
                                                            {Object.keys(locationTree[zone][aisle][rack]).sort().map(level => (
                                                                <div key={level} className="mt-1 ml-2">
                                                                    <h5 className="text-sm font-medium px-1">Level: {level}</h5>
                                                                     {Object.keys(locationTree[zone][aisle][rack][level]).sort().map(bin => (
                                                                        <div key={bin} className="ml-4 my-2 p-3 rounded-lg border">
                                                                            <h6 className="font-semibold text-sm">Bin: {bin}</h6>
                                                                            <div className="mt-2 space-y-3">
                                                                                {locationTree[zone][aisle][rack][level][bin].map(product => (
                                                                                    <div 
                                                                                        key={product.id} 
                                                                                        className="flex items-center gap-3 cursor-pointer group"
                                                                                        onClick={() => setSelectedProduct(product)}
                                                                                    >
                                                                                        <Image
                                                                                            alt={product.name}
                                                                                            className="rounded-md aspect-square object-cover"
                                                                                            height={32}
                                                                                            width={32}
                                                                                            src={product.photoURL || `https://picsum.photos/seed/${product.id}/100/100`}
                                                                                        />
                                                                                        <div className="flex-1">
                                                                                            <p className="text-sm font-medium group-hover:underline">{product.name}</p>
                                                                                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                                                                                        </div>
                                                                                        <Badge variant={getStatus(product).variant}>{product.stock}</Badge>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                     ))}
                                                                </div>
                                                             ))}
                                                        </div>
                                                    ))}
                                                </AccordionContent>
                                            </Card>
                                        </AccordionItem>
                                    ))}
                                 </Accordion>
                            </AccordionContent>
                        </Card>
                    </AccordionItem>
                ))}
                </Accordion>
            )}

             {selectedProduct && (
                <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{selectedProduct.name}</DialogTitle>
                            <DialogDescription>SKU: {selectedProduct.sku}</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-[100px_1fr] gap-4 py-4">
                            <Image
                                alt={selectedProduct.name}
                                className="rounded-lg aspect-square object-cover"
                                height={100}
                                width={100}
                                src={selectedProduct.photoURL || `https://picsum.photos/seed/${selectedProduct.id}/100/100`}
                            />
                             <div className="space-y-2">
                                <p><strong>Category:</strong> {selectedProduct.category}</p>
                                <p><strong>Price:</strong> {formatCurrency(selectedProduct.price)}</p>
                                <p><strong>Supplier:</strong> {selectedProduct.supplier || "N/A"}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <h3 className="font-semibold text-muted-foreground">Stock</h3>
                                <p className="text-3xl font-bold font-headline">{selectedProduct.stock}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-muted-foreground">Reorder At</h3>
                                <p className="text-3xl font-bold font-headline">{selectedProduct.reorderLimit}</p>
                            </div>
                             <div>
                                <h3 className="font-semibold text-muted-foreground">Max Stock</h3>
                                <p className="text-3xl font-bold font-headline">{selectedProduct.maxStockLevel}</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedProduct(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
