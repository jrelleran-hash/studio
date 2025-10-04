
"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Tool, ToolBorrowRecord, ToolMaintenanceRecord } from "@/types";
import { updateToolConditionAndStatus, getToolHistory, getToolMaintenanceHistory, deleteMaintenanceRecords } from "@/services/data-service";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

const maintenanceSchema = z.object({
  condition: z.enum(["Good", "Needs Repair", "Damaged"]),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

type HistoryFilter = "all" | "Repaired" | "Disposed";

const conditionVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Good: "default",
  "Needs Repair": "secondary",
  Damaged: "destructive",
};

const outcomeVariant: { [key: string]: "default" | "destructive" } = {
    Repaired: "default",
    Disposed: "destructive",
};

export default function ToolMaintenancePage() {
  const { tools, loading, refetchData } = useData();
  const { toast } = useToast();

  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [detailedTool, setDetailedTool] = useState<Tool | null>(null);
  const [toolHistory, setToolHistory] = useState<ToolBorrowRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [maintenanceHistory, setMaintenanceHistory] = useState<ToolMaintenanceRecord[]>([]);
  const [maintenanceHistoryLoading, setMaintenanceHistoryLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());
  const [isDeleteHistoryOpen, setIsDeleteHistoryOpen] = useState(false);


  const maintenanceTools = useMemo(() => {
    return tools.filter(t => t.status === "Under Maintenance");
  }, [tools]);
  
  const filteredMaintenanceHistory = useMemo(() => {
    if (historyFilter === 'all') return maintenanceHistory;
    return maintenanceHistory.filter(record => record.outcome === historyFilter);
  }, [maintenanceHistory, historyFilter]);

  const maintenanceEntryRecord = useMemo(() => {
    if (!detailedTool || toolHistory.length === 0) return null;
    return toolHistory.find(record => record.returnCondition === 'Needs Repair' || record.returnCondition === 'Damaged');
  }, [detailedTool, toolHistory]);

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
  });

  const fetchMaintenanceHistory = async () => {
    setMaintenanceHistoryLoading(true);
    const history = await getToolMaintenanceHistory();
    setMaintenanceHistory(history);
    setMaintenanceHistoryLoading(false);
  };

  useEffect(() => {
    fetchMaintenanceHistory();
  }, []);

  useEffect(() => {
    if (detailedTool) {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        const history = await getToolHistory(detailedTool.id);
        setToolHistory(history);
        setHistoryLoading(false);
      };
      fetchHistory();
    }
  }, [detailedTool]);
  
  useEffect(() => {
    setSelectedHistory(new Set());
  }, [historyFilter]);

  const onMaintenanceComplete = async (data: MaintenanceFormValues) => {
    if (!selectedTool) return;
    try {
      let newStatus: Tool['status'] = 'Available';
      let toastDescription = `Tool status updated to ${data.condition === 'Good' ? 'Available' : 'Under Maintenance'}.`;

      if (data.condition === 'Damaged') {
        newStatus = 'Available'; // It will show in waste management due to 'Damaged' condition
        toastDescription = "Tool marked as Damaged and moved to Waste Management.";
      } else if (data.condition === 'Needs Repair') {
        newStatus = 'Under Maintenance';
      }

      await updateToolConditionAndStatus(selectedTool.id, data.condition, newStatus);
      
      toast({ title: "Success", description: toastDescription });
      setSelectedTool(null);
      await refetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update tool status." });
    }
  };
  
  const handleSelectHistory = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedHistory);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedHistory(newSelection);
  };
  
  const handleSelectAllHistory = (checked: boolean) => {
    if (checked) {
      setSelectedHistory(new Set(filteredMaintenanceHistory.map(h => h.id)));
    } else {
      setSelectedHistory(new Set());
    }
  };
  
  const handleDeleteSelectedHistory = async () => {
    try {
      await deleteMaintenanceRecords(Array.from(selectedHistory));
      toast({ title: "Success", description: "Selected history records deleted." });
      await fetchMaintenanceHistory();
      setSelectedHistory(new Set());
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete history records." });
    } finally {
      setIsDeleteHistoryOpen(false);
    }
  };


  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return format(date, 'PPpp');
  };
  
  const formatDateSimple = (date?: Date) => {
    if (!date) return 'N/A';
    return format(date, 'PPP');
  }

  const isAllHistorySelected = filteredMaintenanceHistory.length > 0 && selectedHistory.size === filteredMaintenanceHistory.length;

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Tool Maintenance</h1>
        <p className="text-muted-foreground">Manage and track tools that are currently under repair or have been repaired.</p>
      </div>
      
      <Tabs defaultValue="queue">
          <TabsList>
              <TabsTrigger value="queue">Maintenance Queue</TabsTrigger>
              <TabsTrigger value="history">Maintenance History</TabsTrigger>
          </TabsList>
          <TabsContent value="queue">
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
                        <TableRow key={tool.id} onClick={() => setDetailedTool(tool)} className="cursor-pointer">
                            <TableCell className="font-medium">{tool.name}</TableCell>
                            <TableCell>{tool.serialNumber}</TableCell>
                            <TableCell><Badge variant={conditionVariant[tool.condition]}>{tool.condition}</Badge></TableCell>
                            <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={(e) => {e.stopPropagation(); setSelectedTool(tool);}}>Complete Maintenance</Button>
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
          </TabsContent>
          <TabsContent value="history">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Maintenance History</CardTitle>
                        <CardDescription>A log of all completed maintenance activities.</CardDescription>
                    </div>
                     {selectedHistory.size > 0 && (
                        <Button variant="destructive" size="sm" onClick={() => setIsDeleteHistoryOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected ({selectedHistory.size})
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                        {(["all", "Repaired", "Disposed"] as HistoryFilter[]).map(filter => (
                            <Button
                                key={filter}
                                variant={historyFilter === filter ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => setHistoryFilter(filter)}
                            >
                                {filter}
                            </Button>
                        ))}
                    </div>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"><Checkbox checked={isAllHistorySelected} onCheckedChange={handleSelectAllHistory} aria-label="Select all" /></TableHead>
                                <TableHead>Tool Name</TableHead>
                                <TableHead>Serial #</TableHead>
                                <TableHead>Date Entered</TableHead>
                                <TableHead>Outcome</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {maintenanceHistoryLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredMaintenanceHistory.length > 0 ? (
                                filteredMaintenanceHistory.map(record => (
                                    <TableRow key={record.id}>
                                        <TableCell><Checkbox checked={selectedHistory.has(record.id)} onCheckedChange={(checked) => handleSelectHistory(record.id, !!checked)} /></TableCell>
                                        <TableCell>{record.toolName}</TableCell>
                                        <TableCell>{record.serialNumber}</TableCell>
                                        <TableCell>{formatDateSimple(record.dateEntered)}</TableCell>
                                        <TableCell>
                                            <Badge variant={outcomeVariant[record.outcome]}>{record.outcome}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No maintenance history found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </TabsContent>
      </Tabs>


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
                <Button type="submit">Confirm</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {detailedTool && (
         <Dialog open={!!detailedTool} onOpenChange={(open) => !open && setDetailedTool(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Maintenance Details: {detailedTool.name}</DialogTitle>
              <DialogDescription>Serial #: {detailedTool.serialNumber}</DialogDescription>
            </DialogHeader>
            {historyLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-4 py-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground">Current Condition</p>
                        <p><Badge variant={conditionVariant[detailedTool.condition]}>{detailedTool.condition}</Badge></p>
                    </div>
                     <div>
                        <p className="text-sm font-semibold text-muted-foreground">Status</p>
                        <p><Badge variant="destructive">{detailedTool.status}</Badge></p>
                    </div>
                </div>
                 {maintenanceEntryRecord && (
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Date Sent to Maintenance</p>
                        <p>{formatDate(maintenanceEntryRecord.dateReturned)}</p>
                      </div>
                       <div>
                        <p className="text-sm font-semibold text-muted-foreground">Last User</p>
                        <p>{maintenanceEntryRecord.borrowedByName}</p>
                      </div>
                      {maintenanceEntryRecord.notes && (
                        <div>
                           <p className="text-sm font-semibold text-muted-foreground">Return Notes</p>
                           <p className="text-sm p-2 bg-muted rounded-md">{maintenanceEntryRecord.notes}</p>
                        </div>
                      )}
                    </div>
                )}
                {!maintenanceEntryRecord && <p className="text-sm text-muted-foreground">No specific return record found that initiated this maintenance period.</p>}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailedTool(null)}>Close</Button>
              <Button onClick={(e) => { setDetailedTool(null); setSelectedTool(detailedTool)}}>Complete Maintenance</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={isDeleteHistoryOpen} onOpenChange={setIsDeleteHistoryOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the selected maintenance history records.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSelectedHistory} className={buttonVariants({ variant: "destructive" })}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </>
  );
}
