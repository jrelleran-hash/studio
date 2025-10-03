
"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Tool } from "@/types";
import { updateToolConditionAndStatus } from "@/services/data-service";

const maintenanceSchema = z.object({
  condition: z.enum(["Good", "Needs Repair", "Damaged"]),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

const conditionVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Good: "default",
  "Needs Repair": "secondary",
  Damaged: "destructive",
};

export default function ToolMaintenancePage() {
  const { tools, loading, refetchData } = useData();
  const { toast } = useToast();

  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  const maintenanceTools = useMemo(() => {
    return tools.filter(t => t.status === "Under Maintenance");
  }, [tools]);

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
  });

  const onMaintenanceComplete = async (data: MaintenanceFormValues) => {
    if (!selectedTool) return;
    try {
      await updateToolConditionAndStatus(selectedTool.id, data.condition, 'Available');
      toast({ title: "Success", description: "Tool status updated to Available." });
      setSelectedTool(null);
      await refetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update tool status." });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Tool Maintenance</h1>
        <p className="text-muted-foreground">Manage and track tools that are currently under repair.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Queue</CardTitle>
          <CardDescription>
            These tools are marked as "Under Maintenance" and are unavailable for use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead>Serial #</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : maintenanceTools.length > 0 ? (
                maintenanceTools.map(tool => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-medium">{tool.name}</TableCell>
                    <TableCell>{tool.serialNumber}</TableCell>
                    <TableCell><Badge variant={conditionVariant[tool.condition]}>{tool.condition}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedTool(tool)}>Complete Maintenance</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No tools are currently under maintenance.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedTool && (
        <Dialog open={!!selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Maintenance for {selectedTool.name}</DialogTitle>
              <DialogDescription>
                Update the tool's condition to make it available again.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onMaintenanceComplete)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="condition">New Condition</Label>
                <Controller
                  name="condition"
                  control={form.control}
                  defaultValue={selectedTool.condition}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Needs Repair">Needs Repair (Still)</SelectItem>
                        <SelectItem value="Damaged">Damaged (Out of service)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setSelectedTool(null)}>Cancel</Button>
                <Button type="submit">Complete & Make Available</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
