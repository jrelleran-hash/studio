
"use client";

import { useMemo } from "react";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

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

    if (outOfStockCount > 0) return "out-of-stock";
    if (lowStockCount > 0) return "low-stock";
    return "in-stock";
};

const binStatusClasses = {
    "empty": "bg-muted/20 border-dashed",
    "in-stock": "bg-green-500/20 border-green-500/50 hover:bg-green-500/30",
    "low-stock": "bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30",
    "out-of-stock": "bg-destructive/20 border-destructive/50 hover:bg-destructive/30",
};


export function WarehouseMap({ products, onProductSelect }: WarehouseMapProps) {
  const locationTree = useMemo(() => {
    const tree: LocationTree = {};
    products.forEach(product => {
      const loc = product.location;
      if (loc && (loc.zone || loc.aisle || loc.rack)) {
        const zone = loc.zone || 'Unzoned';
        const aisle = loc.aisle || 'No Aisle';
        const rackId = `${loc.rack || 'No Rack'}-${loc.level || 'No Level'}-${loc.bin || 'No Bin'}`;

        if (!tree[zone]) tree[zone] = {};
        if (!tree[zone][aisle]) tree[zone][aisle] = {};
        if (!tree[zone][aisle][rackId]) tree[zone][aisle][rackId] = [];
        
        tree[zone][aisle][rackId].push(product);
      }
    });
    return tree;
  }, [products]);

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {Object.keys(locationTree).sort().map(zone => (
          <div key={zone} className="p-4 border rounded-lg">
            <h2 className="text-xl font-bold font-headline mb-4">Zone: {zone}</h2>
            <div className="flex flex-col gap-8">
              {Object.keys(locationTree[zone]).sort().map(aisle => (
                <div key={aisle}>
                  <h3 className="text-lg font-semibold mb-2">Aisle: {aisle}</h3>
                  <div className="flex flex-wrap gap-4">
                    {Object.keys(locationTree[zone][aisle]).sort().map(rackId => {
                      const productsInBin = locationTree[zone][aisle][rackId];
                      const status = getBinStatus(productsInBin);
                      
                      return (
                        <Tooltip key={rackId} delayDuration={100}>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              "w-24 h-16 border-2 rounded-md flex items-center justify-center cursor-pointer transition-colors",
                              binStatusClasses[status]
                            )}>
                              <p className="text-xs font-mono text-center text-muted-foreground">{rackId}</p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {productsInBin.length > 0 ? (
                                <div className="space-y-2">
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
                                <p className="text-sm text-muted-foreground">Empty Bin</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
