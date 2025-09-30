

"use client";

import { useState } from "react";
import { useData } from "@/context/data-context";
import { WarehouseMap } from "@/components/warehouse/warehouse-map";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import Link from "next/link";
import { Package } from "lucide-react";

export default function WarehousePage() {
    const { products, loading } = useData();
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold font-headline tracking-tight">Warehouse Map</h1>
                <p className="text-muted-foreground">A virtual representation of your inventory storage.</p>
            </div>
             {loading ? (
                <Skeleton className="h-[500px] w-full" />
            ) : (
                <WarehouseMap products={products} onProductSelect={setSelectedProduct} />
            )}

             {selectedProduct && (
                <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{selectedProduct.name}</DialogTitle>
                            <DialogDescription>SKU: {selectedProduct.sku}</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-[100px_1fr] gap-4 py-4">
                             <div className="h-[100px] w-[100px] bg-muted/50 rounded-lg flex items-center justify-center">
                                <Package className="h-12 w-12 text-muted-foreground" />
                            </div>
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
                        <DialogFooter className="!justify-between">
                            <Button variant="outline" onClick={() => setSelectedProduct(null)}>Close</Button>
                            <Button asChild>
                                <Link href={`/inventory?edit=${selectedProduct.id}`}>Edit Product</Link>
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

  
