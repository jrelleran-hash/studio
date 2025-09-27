
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryReport } from "@/components/reports/inventory-report";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("inventory");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate, view, and export detailed reports for your business operations.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory Report</TabsTrigger>
          <TabsTrigger value="sales" disabled>Sales Report</TabsTrigger>
          <TabsTrigger value="procurement" disabled>Procurement Report</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <InventoryReport />
        </TabsContent>
        <TabsContent value="sales">
          {/* Sales Report Component will go here */}
        </TabsContent>
        <TabsContent value="procurement">
          {/* Procurement Report Component will go here */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
