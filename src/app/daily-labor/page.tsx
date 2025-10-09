
"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";

import { useData } from "@/context/data-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addLaborEntry } from "@/services/data-service";
import { formatCurrency } from "@/lib/currency";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, User, Briefcase, Factory } from "lucide-react";
import { cn } from "@/lib/utils";

const laborEntrySchema = z.object({
  date: z.date({ required_error: "Date is required."}),
  userId: z.string().min(1, "Worker is required."),
  jobOrderId: z.string().min(1, "Job Order is required."),
  hoursWorked: z.coerce.number().min(0.5, "Minimum 0.5 hours.").max(24, "Maximum 24 hours."),
});

type LaborEntryFormValues = z.infer<typeof laborEntrySchema>;

export default function DailyLaborPage() {
  const { users, jobOrders, laborEntries, loading, refetchData } = useData();
  const { toast } = useToast();

  const form = useForm<LaborEntryFormValues>({
    resolver: zodResolver(laborEntrySchema),
    defaultValues: {
      date: new Date(),
      hoursWorked: 8,
    }
  });
  
  const { handleSubmit, control, register, formState: { errors } } = form;

  const onSubmit = async (data: LaborEntryFormValues) => {
    try {
      await addLaborEntry(data);
      toast({
        title: "Success",
        description: "Labor entry has been logged successfully.",
      });
      form.reset({
        date: new Date(),
        hoursWorked: 8,
        userId: '',
        jobOrderId: ''
      });
      await refetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to log labor entry.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };
  
  const formatDate = (date: Date) => {
      return format(date, 'PPP');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Daily Labor Tracker</h1>
        <p className="text-muted-foreground">Log hours worked by your team on different production jobs.</p>
      </div>
      
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>New Labor Entry</CardTitle>
                <CardDescription>Log a new work entry for a team member.</CardDescription>
            </CardHeader>
            <CardContent>
                 <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Controller
                            control={control}
                            name="date"
                            render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                </Popover>
                            )}
                        />
                         {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Worker</Label>
                        <Controller
                            name="userId"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><div className="flex items-center gap-2"><User /> <SelectValue placeholder="Select a worker" /></div></SelectTrigger>
                                    <SelectContent>
                                        {users.map(u => <SelectItem key={u.uid} value={u.uid}>{u.firstName} {u.lastName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {errors.userId && <p className="text-sm text-destructive">{errors.userId.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Job Order</Label>
                        <Controller
                            name="jobOrderId"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><div className="flex items-center gap-2"><Factory /> <SelectValue placeholder="Select a Job Order" /></div></SelectTrigger>
                                    <SelectContent>
                                        {jobOrders.map(jo => <SelectItem key={jo.id} value={jo.id}>{jo.jobOrderNumber} ({jo.projectName})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {errors.jobOrderId && <p className="text-sm text-destructive">{errors.jobOrderId.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="hoursWorked">Hours Worked</Label>
                        <Input id="hoursWorked" type="number" step="0.5" {...register("hoursWorked")} />
                         {errors.hoursWorked && <p className="text-sm text-destructive">{errors.hoursWorked.message}</p>}
                    </div>
                    <div className="pt-2">
                        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Logging..." : "Log Entry"}
                        </Button>
                    </div>
                 </form>
            </CardContent>
        </Card>
        
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Recent Labor Entries</CardTitle>
                <CardDescription>A log of the most recent hours worked.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Worker</TableHead>
                            <TableHead>Job Order</TableHead>
                            <TableHead className="text-right">Hours</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : laborEntries.length > 0 ? (
                            laborEntries.map(entry => (
                                <TableRow key={entry.id}>
                                    <TableCell>{formatDate(entry.date)}</TableCell>
                                    <TableCell>{entry.userName}</TableCell>
                                    <TableCell>{entry.jobOrderNumber}</TableCell>
                                    <TableCell className="text-right">{entry.hoursWorked}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(entry.cost)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No labor entries have been logged yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
