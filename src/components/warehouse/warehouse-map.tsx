

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
      <div className="p-4 border rounded-lg min-h-[600px] flex flex-col [perspective:2000px]">
        <Breadcrumbs path={path} onNavigate={handleBreadcrumbNav} />
        
        <div className="flex-1 flex items-center justify-center">
            <div 
              className="w-full h-full relative transition-transform duration-500 ease-in-out"
              style={{ transformStyle: 'preserve-3d', transform: 'rotateX(55deg) rotateZ(0deg) rotateY(-45deg)'}}
            >
                {/* Level 1: Zones */}
                <div className={cn(
                    "absolute inset-0 grid grid-cols-2 gap-8 p-8 transition-all duration-500", 
                    selectedZone ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
                )}>
                    {Object.keys(locationTree).sort().map(zone => (
                        <div key={zone} onClick={() => setSelectedZone(zone)} className="p-6 border rounded-lg cursor-pointer bg-background/80 backdrop-blur-sm hover:bg-muted/80 hover:border-primary/50 transition-all flex items-center justify-center h-48 shadow-lg transform hover:-translate-y-2">
                            <h2 className="text-2xl font-bold font-headline">{zone}</h2>
                        </div>
                    ))}
                </div>
                
                {/* Level 2: Aisles */}
                {selectedZone && (
                     <div className={cn(
                        "absolute inset-0 grid grid-cols-2 gap-6 p-4 transition-all duration-500", 
                        selectedZone && !selectedAisle ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                    )}>
                        {Object.keys(locationTree[selectedZone]).sort().map(aisle => (
                            <div key={aisle} onClick={() => setSelectedAisle(aisle)} className="p-6 border rounded-lg cursor-pointer bg-background/80 backdrop-blur-sm hover:bg-muted/80 hover:border-primary/50 transition-all flex items-center justify-center h-40 shadow-md transform hover:-translate-y-1">
                                <h3 className="text-xl font-semibold">{aisle}</h3>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Level 3: Racks and Bins */}
                {selectedZone && selectedAisle && (
                    <div className="absolute inset-0 space-y-12 animate-in fade-in duration-500">
                        {Object.keys(rackStructure).sort().map(rack => (
                            <div key={rack}>
                                <h4 className="font-semibold text-lg mb-2 text-center">{rack}</h4>
                                 <div className="flex flex-col-reverse gap-1 p-2 border rounded-lg bg-background/50 shadow-inner">
                                    {Object.keys(rackStructure[rack]).sort((a,b) => parseInt(b) - parseInt(a)).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <div className="w-10 text-xs text-muted-foreground/50 text-center font-semibold -rotate-90">L{level}</div>
                                            <div className="flex-1 grid grid-cols-6 gap-1">
                                                 {Array.from(rackStructure[rack][level]).sort((a,b) => parseInt(a) - parseInt(b)).map(bin => {
                                                    const productsInBin = getProductsInBin(selectedZone, selectedAisle!, rack, level, bin);
                                                    const status = getBinStatus(productsInBin);
                                                    return (
                                                    <Tooltip key={bin} delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <div className={cn(
                                                                "h-16 border rounded-md flex items-center justify-center cursor-pointer transition-colors shadow-sm",
                                                                binStatusClasses[status]
                                                            )}>
                                                            <p className="text-xs font-mono text-center text-muted-foreground/70">B{bin}</p>
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
                                 </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
    </TooltipProvider>
  );
}


    