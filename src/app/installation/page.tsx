"use client";

import { useState, useMemo, useEffect } from "react";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, CheckCircle, Clock, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobOrder, JobOrderItem, Installation } from "@/types";
import { DateRange } from "react-day-picker";
import { addInstallation } from "@/services/data-service";

const installationSchema = z.object({
  assignedCrewId: z.string().min(1, "A crew must be assigned."),
  dateRange: z.object({
    from: z.date({ required_error: "A start date is required." }),
    to: z.date({ required_error: "An end date is required." }),
  }),
});
type InstallationFormValues = z.infer<typeof installationSchema>;

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Scheduled: "secondary",
  "In Progress": "outline",
  Completed: "default",
  "Punchlist Required": "destructive",
};

export default function InstallationPage() {
  const { jobOrders, users, installations, loading, refetchData } = useData();
  const { toast } = useToast();
  
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);

  const installationQueue = useMemo(() => {
    return jobOrders.flatMap(job =>
      job.items
        .filter(item => item.status === 'QC Passed')
        .map(item => ({ job, item }))
    );
  }, [jobOrders]);

  const form = useForm<InstallationFormValues>({
    resolver: zodResolver(installationSchema),
  });

  useEffect(() => {
    if (!isSchedulingOpen) {
        form.reset();
        setSelectedItems(new Set());
    }
  }, [isSchedulingOpen, form]);

  const onScheduleSubmit = async (data: InstallationFormValues) => {
    const itemsToInstall = Array.from(selectedItems).map(id => {
      const [jobId, itemId] = id.split('::');
      return { jobId, itemId };
    });

    try {
        await addInstallation({
            assignedCrewId: data.assignedCrewId,
            startDate: data.dateRange.from,
            endDate: data.dateRange.to,
            items: itemsToInstall,
        });
        toast({ title: "Success", description: "New installation has been scheduled." });
        setIsSchedulingOpen(false);
        await refetchData();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to schedule installation.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(installationQueue.map(i => `${i.job.id}::${i.item.id}`)));
    } else {
      setSelectedItems(new Set());
    }
  };
  
  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedItems);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedItems(newSelection);
  };

  const isAllSelected = installationQueue.length > 0 && selectedItems.size === installationQueue.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Installation & Turnover</h1>
        <p className="text-muted-foreground">Schedule on-site installations and track project completion.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Installation Queue</CardTitle>
            <CardDescription>Items that have passed QC and are ready for site installation.</CardDescription>
          </div>
          <Button size="sm" disabled={selectedItems.size === 0} onClick={() => setIsSchedulingOpen(true)}>
            Schedule Installation ({selectedItems.size})
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"><Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} /></TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Job Order #</TableHead>
                <TableHead>Project</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8" /></TableCell></TableRow>
                ))
              ) : installationQueue.length > 0 ? (
                installationQueue.map(({ job, item }) => {
                  const itemId = `${job.id}::${item.id}`;
                  return (
                    <TableRow key={itemId}>
                      <TableCell><Checkbox checked={selectedItems.has(itemId)} onCheckedChange={(c) => handleSelectItem(itemId, !!c)} /></TableCell>
                      <TableCell className="font-medium">{(item.productRef as any)?.name || 'N/A'}</TableCell>
                      <TableCell>{job.jobOrderNumber}</TableCell>
                      <TableCell>{job.projectName}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">No items are currently ready for installation.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Installations</CardTitle>
          <CardDescription>All ongoing and upcoming site installations.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Installation #</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Assigned Crew</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8" /></TableCell></TableRow>
                        ))
                    ) : installations.length > 0 ? (
                        installations.map(install => (
                            <TableRow key={install.id}>
                                <TableCell>{install.installationNumber}</TableCell>
                                <TableCell>{install.projectName}</TableCell>
                                <TableCell>{install.assignedCrewName}</TableCell>
                                <TableCell>{format(install.scheduledStartDate, 'PP')} - {format(install.scheduledEndDate, 'PP')}</TableCell>
                                <TableCell>{install.status}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                         <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">No installations scheduled.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={isSchedulingOpen} onOpenChange={setIsSchedulingOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Schedule Installation</DialogTitle>
                <DialogDescription>Assign a crew and set the dates for the installation of {selectedItems.size} item(s).</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onScheduleSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label>Assign Crew</Label>
                    <Controller
                        name="assignedCrewId"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select a crew/user..." /></SelectTrigger>
                                <SelectContent>
                                    {users.map(u => <SelectItem key={u.uid} value={u.uid}>{u.firstName} {u.lastName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {form.formState.errors.assignedCrewId && <p className="text-sm text-destructive">{form.formState.errors.assignedCrewId.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label>Installation Dates</Label>
                    <Controller
                        name="dateRange"
                        control={form.control}
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal", !field.value?.from && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value?.from ? (field.value.to ? <>{format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}</> : format(field.value.from, "LLL dd, y")) : <span>Pick a date range</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="range" defaultMonth={field.value?.from} selected={field.value as DateRange} onSelect={field.onChange} numberOfMonths={2} />
                                </PopoverContent>
                            </Popover>
                        )}
                    />
                    {form.formState.errors.dateRange && <p className="text-sm text-destructive">{form.formState.errors.dateRange.root?.message}</p>}
                 </div>
                 <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsSchedulingOpen(false)}>Cancel</Button>
                    <Button type="submit">Confirm Schedule</Button>
                 </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
