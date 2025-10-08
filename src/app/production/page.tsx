
"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";

import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addExpense } from "@/services/data-service";
import { formatCurrency } from "@/lib/currency";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Briefcase, DollarSign, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const expenseCategories = [
    "Material Purchases",
    "Labor Wages",
    "Transportation / Logistics",
    "Tools & Equipment Maintenance",
    "Overheads",
    "Marketing / Client Acquisition",
    "Subcontractor Fees",
    "Other"
];

const expenseSchema = z.object({
  date: z.date({ required_error: "Date is required."}),
  clientId: z.string().optional(),
  category: z.string().min(1, "Category is required."),
  description: z.string().min(1, "Description is required."),
  payee: z.string().min(1, "Payee is required."),
  amount: z.coerce.number().min(0.01, "Amount must be greater than zero."),
  paymentMode: z.string().min(1, "Payment mode is required."),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export default function ProductionPage() {
  const { clients, expenses, loading, refetchData } = useData();
  const { toast } = useToast();

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date(),
      paymentMode: "Cash",
    }
  });
  
  const { handleSubmit, control, register, formState: { errors } } = form;

  const onSubmit = async (data: ExpenseFormValues) => {
    try {
      await addExpense(data);
      toast({
        title: "Success",
        description: "Expense has been logged successfully.",
      });
      form.reset({
        date: new Date(),
        paymentMode: "Cash",
        clientId: '',
        category: '',
        description: '',
        payee: '',
        amount: undefined,
      });
      await refetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to log expense.";
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
        <h1 className="text-2xl font-bold font-headline tracking-tight">Production & Expenses</h1>
        <p className="text-muted-foreground">Log expenses related to projects and general operations.</p>
      </div>
      
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>New Expense Entry</CardTitle>
                <CardDescription>Log a new business or project-related expense.</CardDescription>
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
                        <Label>Category</Label>
                        <Controller
                            name="category"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><div className="flex items-center gap-2"><Tag /> <SelectValue placeholder="Select a category" /></div></SelectTrigger>
                                    <SelectContent>
                                        {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Project (Optional)</Label>
                        <Controller
                            name="clientId"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><div className="flex items-center gap-2"><Briefcase /> <SelectValue placeholder="Select a project" /></div></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None (General Expense)</SelectItem>
                                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.projectName} ({c.clientName})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" {...register("description")} />
                        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="payee">Supplier / Payee</Label>
                        <Input id="payee" {...register("payee")} />
                        {errors.payee && <p className="text-sm text-destructive">{errors.payee.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input id="amount" type="number" step="0.01" {...register("amount")} />
                         {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Payment Mode</Label>
                        <Controller
                            name="paymentMode"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><div className="flex items-center gap-2"><DollarSign /> <SelectValue placeholder="Select payment mode" /></div></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="GCash">GCash</SelectItem>
                                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    <div className="pt-2">
                        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Logging..." : "Log Expense"}
                        </Button>
                    </div>
                 </form>
            </CardContent>
        </Card>
        
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Recent Expenses</CardTitle>
                <CardDescription>A log of the most recent expenses.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : expenses.length > 0 ? (
                            expenses.map(entry => (
                                <TableRow key={entry.id}>
                                    <TableCell>{formatDate(entry.date)}</TableCell>
                                    <TableCell>{entry.description}</TableCell>
                                    <TableCell><Badge variant="outline">{entry.category}</Badge></TableCell>
                                    <TableCell>{entry.projectName || 'N/A'}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No expenses have been logged yet.
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

    