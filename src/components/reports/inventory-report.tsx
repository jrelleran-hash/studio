
"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import type { Product, ProductHistory } from "@/types";

// Function to convert array of objects to CSV
const convertToCSV = (data: any[], headers: { label: string; key: string }[]) => {
  const headerRow = headers.map(h => h.label).join(',');
  const bodyRows = data.map(row => {
    return headers.map(header => {
      const value = row[header.key];
      const stringValue = typeof value === 'string' ? value.replace(/"/g, '""') : value;
      return `"${stringValue}"`;
    }).join(',');
  });
  return [headerRow, ...bodyRows].join('\n');
};

const downloadCSV = (csvString: string, filename: string) => {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};


const getStockForDate = (product: Product, date: Date): number => {
    if (!product.history || product.history.length === 0) {
        return 0; // Or initial stock if available
    }

    // Filter history for entries on or before the target date
    const relevantHistory = product.history
        .map(h => ({ ...h, dateUpdated: h.dateUpdated.toDate() }))
        .filter(h => h.dateUpdated <= date)
        .sort((a, b) => b.dateUpdated.getTime() - a.dateUpdated.getTime());

    // The most recent entry is the stock level at that time
    return relevantHistory.length > 0 ? relevantHistory[0].stock : 0;
};

export function InventoryReport() {
  const { products, loading } = useData();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!dateRange?.to) {
        return products.map(p => ({
            ...p,
            inventoryValue: p.stock * p.price,
        }));
    }
    
    // Create a new Date object for the end of the day
    const endOfRangeDate = new Date(dateRange.to);
    endOfRangeDate.setHours(23, 59, 59, 999);

    return products.map(product => {
      const stockOnDate = getStockForDate(product, endOfRangeDate);
      return {
        ...product,
        stock: stockOnDate,
        inventoryValue: stockOnDate * product.price,
      };
    });
  }, [products, dateRange]);
  
  const totalInventoryValue = useMemo(() => {
    return filteredProducts.reduce((total, product) => total + product.inventoryValue, 0);
  }, [filteredProducts]);

  const handleExport = () => {
    const headers = [
      { label: "SKU", key: "sku" },
      { label: "Product Name", key: "name" },
      { label: "Stock", key: "stock" },
      { label: "Price", key: "price" },
      { label: "Inventory Value", key: "inventoryValue" },
      { label: "Supplier", key: "supplier" },
    ];
    const csvData = convertToCSV(filteredProducts, headers);
    const dateSuffix = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : 'current';
    downloadCSV(csvData, `inventory-report-${dateSuffix}.csv`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <CardTitle>Inventory Report</CardTitle>
                <CardDescription>
                A detailed view of your product inventory. Select a date to see a historical snapshot.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-[260px] justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                        dateRange.to ? (
                        `As of ${format(dateRange.to, "LLL dd, y")}`
                        ) : (
                        format(dateRange.from, "LLL dd, y")
                        )
                    ) : (
                        <span>Pick a date</span>
                    )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                        if (range?.from && !range.to) {
                            range.to = range.from; // Select single date if only one is picked
                        }
                        setDateRange(range);
                        setIsPopoverOpen(false);
                    }}
                    numberOfMonths={1}
                    />
                </PopoverContent>
                </Popover>
                 <Button onClick={handleExport} variant="outline" size="sm">
                    <Download className="mr-2" />
                    Export CSV
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Inventory Value</TableHead>
              <TableHead>Supplier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : (
              filteredProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono">{product.sku}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-center">{product.stock}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.inventoryValue)}</TableCell>
                  <TableCell>{product.supplier || "N/A"}</TableCell>
                </TableRow>
              ))
            )}
             {!loading && (
                <TableRow className="font-bold bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={4} className="text-right">Total Inventory Value</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalInventoryValue)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
