

"use client";

import React, { useMemo, useState } from "react";
import type { Product, ProductLocation } from "@/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


interface LocationTree {
  [zone: string]: {
    [aisle: string]: {
      [rack: string]: Product[];
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

const Breadcrumbs = ({ path, onNavigate }: { path: string[], onNavigate: (index: number) => void }) => {
    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Button variant="link" className="p-0 h-auto" onClick={() => onNavigate(-1)}>Warehouse</Button>
            {path.map((item, index) => (
                <React.Fragment key={item}>
                    <ChevronRight className="h-4 w-4" />
                    <Button 
                        variant="link" 
                        className="p-0 h-auto"
                        onClick={() => onNavigate(index)}
                        disabled={index === path.length -1}
                    >
                        {item}
                    </Button>
                </React.Fragment>
            ))}
        </div>
    )
}

export function WarehouseMap({ products, onProductSelect }: WarehouseMapProps) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedAisle, setSelectedAisle] = useState<string | null>(null);

  const locationTree: LocationTree = useMemo(() => {
    const tree: LocationTree = {};
    products.forEach(product => {
        const loc = product.location;
        if (loc) {
            const zone = loc.zone || 'Un-Zoned';
            const aisle = loc.aisle || 'Un-Aisled';
            const rack = loc.rack || 'Un-Racked';
            
            if (!tree[zone]) tree[zone] = {};
            if (!tree[zone][aisle]) tree[zone][aisle] = {};
            if (!tree[zone][aisle][rack]) tree[zone][aisle][rack] = [];
            
            tree[zone][aisle][rack].push(product);
        }
    });
    return tree;
  }, [products]);
  
  const getProductsInBin = (zone: string, aisle: string, rack: string, level: string, bin: string): Product[] => {
    return products.filter(p => 
        p.location?.zone === zone && 
        p.location?.aisle === aisle && 
        p.location?.rack === rack &&
        p.location?.level === level &&
        p.location?.bin === bin
    );
  }

  const racksInAisle = selectedZone && selectedAisle ? locationTree[selectedZone]?.[selectedAisle] || {} : {};
  
  const rackStructure = useMemo(() => {
    const structure: { [rack: string]: { [level: string]: Set<string> }} = {};
    if(selectedZone && selectedAisle) {
        products.forEach(p => {
            const loc = p.location;
            if(loc?.zone === selectedZone && loc?.aisle === selectedAisle && loc?.rack) {
                if(!structure[loc.rack]) structure[loc.rack] = {};
                if(loc.level) {
                    if(!structure[loc.rack][loc.level]) structure[loc.rack][loc.level] = new Set();
                    if(loc.bin) structure[loc.rack][loc.level].add(loc.bin);
                }
            }
        });
    }
    return structure;
  }, [selectedZone, selectedAisle, products]);

  const handleBreadcrumbNav = (index: number) => {
    if(index === -1) {
        setSelectedZone(null);
        setSelectedAisle(null);
    } else if (index === 0) {
        setSelectedAisle(null);
    }
  }

  const path = [selectedZone, selectedAisle].filter(Boolean) as string[];

  return (
    <TooltipProvider>
      <div className="p-4 border rounded-lg min-h-[600px] flex flex-col">
        <Breadcrumbs path={path} onNavigate={handleBreadcrumbNav} />
        
        <div className="flex-1">
            {/* Level 1: Zones */}
            {!selectedZone && (
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                    {Object.keys(locationTree).sort().map(zone => (
                        <Card key={zone} onClick={() => setSelectedZone(zone)} className="cursor-pointer hover:border-primary transition-colors">
                            <CardHeader>
                                <CardTitle>{zone}</CardTitle>
                                <CardDescription>{Object.keys(locationTree[zone]).length} aisles</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                 </div>
            )}
            
            {/* Level 2: Aisles */}
            {selectedZone && !selectedAisle && (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                    {Object.keys(locationTree[selectedZone]).sort().map(aisle => (
                        <Card key={aisle} onClick={() => setSelectedAisle(aisle)} className="cursor-pointer hover:border-primary transition-colors">
                             <CardHeader>
                                <CardTitle>{aisle}</CardTitle>
                                <CardDescription>{Object.keys(locationTree[selectedZone][aisle]).length} racks</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}
            
            {/* Level 3: Racks and Bins */}
            {selectedZone && selectedAisle && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {Object.keys(rackStructure).sort().map(rack => (
                        <Card key={rack}>
                             <CardHeader>
                                <CardTitle>{rack}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col-reverse gap-2">
                                {Object.keys(rackStructure[rack]).sort((a,b) => parseInt(b) - parseInt(a)).map(level => (
                                    <div key={level} className="flex items-center gap-4">
                                        <div className="w-12 text-sm text-muted-foreground font-semibold">Level {level}</div>
                                        <div className="flex-1 grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2">
                                            {Array.from(rackStructure[rack][level]).sort((a,b) => parseInt(a) - parseInt(b)).map(bin => {
                                                const productsInBin = getProductsInBin(selectedZone, selectedAisle!, rack, level, bin);
                                                const status = getBinStatus(productsInBin);
                                                return (
                                                <Tooltip key={bin} delayDuration={100}>
                                                    <TooltipTrigger asChild>
                                                        <div className={cn(
                                                            "h-16 border rounded-md flex items-center justify-center cursor-pointer transition-colors shadow-inner",
                                                            binStatusClasses[status]
                                                        )}>
                                                        <p className="text-sm font-mono text-center text-muted-foreground">{bin}</p>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {productsInBin.length > 0 ? (
                                                            <div className="space-y-2 p-1">
                                                            {productsInBin.map(p => (
                                                                <div key={p.id} className="flex items-center gap-2" onClick={() => onProductSelect(p)}>
                                                                    <div className="flex-1">
                                                                    <p className="text-sm font-medium">{p.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                                                                    </div>
                                                                    <Badge variant="secondary">{p.stock}</Badge>
                                                                </div>
                                                            ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground p-1">Empty Bin</p>
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
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
    </TooltipProvider>
  );
}
