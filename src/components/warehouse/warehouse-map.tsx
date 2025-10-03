
"use client";

import React, { useMemo, useState } from "react";
import type { Product, ProductLocation } from "@/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


interface LocationTree {
  [zone: string]: {
    [rack: string]: {
      [aisle: string]: Product[];
    };
  };
}

interface WarehouseMapProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
}

const getBinStatus = (productsInBin: Product[]): "in-stock" | "low-stock" | "out-of-stock" | "empty" => {
    if (productsInBin.length === 0) return "empty";
    const outOfStockCount = productsInBin.filter(p => p.stock === 0).length;
    const lowStockCount = productsInBin.filter(p => p.stock > 0 && p.stock <= p.reorderLimit).length;

    if (productsInBin.some(p => p.stock > 0 && p.stock <= p.reorderLimit)) return "low-stock";
    if (productsInBin.every(p => p.stock === 0)) return "out-of-stock";
    return "in-stock";
};

const binStatusClasses = {
    "empty": "bg-muted/20 border-dashed hover:bg-muted/40",
    "in-stock": "bg-green-500/20 border-green-500/50 hover:bg-green-500/30",
    "low-stock": "bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30",
    "out-of-stock": "bg-destructive/20 border-destructive/50 hover:bg-destructive/30",
};

const Breadcrumbs = ({ path, onNavigate }: { path: {key: string, value: string}[], onNavigate: (index: number) => void }) => {
    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Button variant="link" className="p-0 h-auto" onClick={() => onNavigate(-1)}>Warehouse</Button>
            {path.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight className="h-4 w-4" />
                    <Button 
                        variant="link" 
                        className="p-0 h-auto"
                        onClick={() => onNavigate(index)}
                        disabled={index === path.length -1}
                    >
                        {item.key}: {item.value}
                    </Button>
                </React.Fragment>
            ))}
        </div>
    )
}

export function WarehouseMap({ products, onProductSelect }: WarehouseMapProps) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const [selectedBinProducts, setSelectedBinProducts] = useState<Product[] | null>(null);

  const locationTree = useMemo(() => {
    const tree: LocationTree = {};
    products.forEach(product => {
      const loc = product.location;
      if (loc) {
        const zone = loc.zone || 'Un-Zoned';
        const rack = loc.rack || 'Un-Racked';
        const aisle = loc.aisle || 'Un-Aisled';
        
        if (!tree[zone]) tree[zone] = {};
        if (!tree[zone][rack]) tree[zone][rack] = {};
        if (!tree[zone][rack][aisle]) tree[zone][rack][aisle] = [];
        
        tree[zone][rack][aisle].push(product);
      }
    });
    return tree;
  }, [products]);
  
  const getProductsInBin = (zone: string, rack: string, aisle: string, level: string, bin: string): Product[] => {
    return products.filter(p => 
        p.location?.zone === zone && 
        p.location?.rack === rack &&
        p.location?.aisle === aisle &&
        p.location?.level === level &&
        p.location?.bin === bin
    );
  }
  
  const aisleStructure = useMemo(() => {
    const structure: { [aisle: string]: { [level: string]: Set<string> }} = {};
    if(selectedZone && selectedRack) {
        products.forEach(p => {
            const loc = p.location;
            if(loc?.zone === selectedZone && loc?.rack === selectedRack && loc?.aisle) {
                if(!structure[loc.aisle]) structure[loc.aisle] = {};
                if(loc.level) {
                    if(!structure[loc.aisle][loc.level]) structure[loc.aisle][loc.level] = new Set();
                    if(loc.bin) structure[loc.aisle][loc.level].add(loc.bin);
                }
            }
        });
    }
    return structure;
  }, [selectedZone, selectedRack, products]);

  const handleBreadcrumbNav = (index: number) => {
    if(index === -1) {
        setSelectedZone(null);
        setSelectedRack(null);
    } else if (index === 0) {
        setSelectedRack(null);
    }
  }

  const path: {key: string, value: string}[] = [];
  if (selectedZone) path.push({ key: 'Zone', value: selectedZone});
  if (selectedRack) path.push({ key: 'Rack', value: selectedRack});

  return (
    <Dialog onOpenChange={(open) => !open && setSelectedBinProducts(null)}>
      <div className="p-4 border rounded-lg min-h-[600px] flex flex-col">
        <Breadcrumbs path={path} onNavigate={handleBreadcrumbNav} />
        
        <div className="flex-1">
            {/* Level 1: Zones */}
            {!selectedZone && (
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                    {Object.keys(locationTree).sort().map(zone => (
                        <Card key={zone} onClick={() => setSelectedZone(zone)} className="cursor-pointer hover:border-primary transition-colors">
                            <CardHeader>
                                <CardTitle>Zone: {zone}</CardTitle>
                                <CardDescription>{Object.keys(locationTree[zone]).length} racks</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                 </div>
            )}
            
            {/* Level 2: Racks */}
            {selectedZone && !selectedRack && (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                    {Object.keys(locationTree[selectedZone]).sort().map(rack => (
                        <Card key={rack} onClick={() => setSelectedRack(rack)} className="cursor-pointer hover:border-primary transition-colors">
                             <CardHeader>
                                <CardTitle>Rack: {rack}</CardTitle>
                                <CardDescription>{Object.keys(locationTree[selectedZone][rack]).length} aisles</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}
            
            {/* Level 3: Aisles and Bins */}
            {selectedZone && selectedRack && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {Object.keys(aisleStructure).sort().map(aisle => (
                        <Card key={aisle}>
                             <CardHeader>
                                <CardTitle>Aisle: {aisle}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col-reverse gap-2">
                                {Object.keys(aisleStructure[aisle]).sort((a,b) => parseInt(b) - parseInt(a)).map(level => (
                                    <div key={level} className="flex items-center gap-4">
                                        <div className="w-16 text-sm text-muted-foreground font-semibold">Level: {level}</div>
                                        <div className="flex-1 grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2">
                                            {Array.from(aisleStructure[aisle][level]).sort((a,b) => parseInt(a) - parseInt(b)).map(bin => {
                                                const productsInBin = getProductsInBin(selectedZone, selectedRack, aisle, level, bin);
                                                const status = getBinStatus(productsInBin);
                                                return (
                                                <DialogTrigger key={bin} asChild>
                                                    <div 
                                                        className={cn(
                                                            "h-16 border rounded-md flex items-center justify-center cursor-pointer transition-colors shadow-inner",
                                                            binStatusClasses[status]
                                                        )}
                                                        onClick={() => setSelectedBinProducts(productsInBin)}
                                                    >
                                                        <p className="text-sm font-mono text-center text-muted-foreground">Bin: {bin}</p>
                                                    </div>
                                                </DialogTrigger>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
      </div>
       <DialogContent>
        <DialogHeader>
          <DialogTitle>Bin Contents</DialogTitle>
          <DialogDescription>
            Products stored in this bin.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-96 overflow-y-auto">
          {selectedBinProducts && selectedBinProducts.length > 0 ? (
            <div className="space-y-2">
              {selectedBinProducts.map(p => (
                <DialogClose key={p.id} asChild>
                    <div 
                      className="flex items-center gap-4 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => onProductSelect(p)}
                    >
                      <div className="p-2 bg-muted/50 rounded-md">
                          <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </div>
                      <Badge variant="secondary">Qty: {p.stock}</Badge>
                    </div>
                </DialogClose>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">This bin is empty.</p>
          )}
        </div>
         <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
