
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Wrench, Calendar as CalendarIcon, User, History, ArrowUpRight, UserCheck, Check, X } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";

import { useData } from "@/context/data-context";
import { useAuth } from "@/hooks/use-auth";
import { addTool, updateTool, deleteTool, borrowTool, returnTool, getToolHistory, assignToolForAccountability, recallTool, approveToolBookingRequest, rejectToolBookingRequest } from "@/services/data-service";
import type { Tool, ToolBorrowRecord, UserProfile, ProductLocation, ToolBookingRequest } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CURRENCY_CONFIG } from "@/config/currency";
import { formatCurrency } from "@/lib/currency";
import { toolSchema, type ToolFormValues } from "@/lib/schemas";


const borrowSchema = z.object({
    borrowedBy: z.string().min(1, "Please select who is borrowing the tool."),
    notes: z.string().optional(),
});

type BorrowFormValues = z.infer<typeof borrowSchema>;

const returnSchema = z.object({
    condition: z.enum(["Good", "Needs Repair", "Damaged"]),
    notes: z.string().optional(),
})
type ReturnFormValues = z.infer<typeof returnSchema>;

const assignSchema = z.object({
    assignedTo: z.string().min(1, "Please select who is accountable for the tool."),
    notes: z.string().optional(),
});

type AssignFormValues = z.infer<typeof assignSchema>;

const recallSchema = z.object({
    condition: z.enum(["Good", "Needs Repair", "Damaged"]),
    notes: z.string().optional(),
});
type RecallFormValues = z.infer<typeof recallSchema>;


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Available: "default",
  "In Use": "secondary",
  Assigned: "secondary",
  "Under Maintenance": "destructive",
};

const conditionVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Good: "default",
  "Needs Repair": "secondary",
  Damaged: "destructive",
};

const requestStatusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
    Pending: "secondary",
    Approved: "default",
    Rejected: "destructive",
};

export default function ToolManagementPage() {
  const { tools, users, toolBookingRequests, loading, refetchData } = useData();
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBorrowDialogOpen, setIsBorrowDialogOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isRecallDialogOpen, setIsRecallDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [borrowingTool, setBorrowingTool] = useState<Tool | null>(null);
  const [returningTool, setReturningTool] = useState<Tool | null>(null);
  const [assigningTool, setAssigningTool] = useState<Tool | null>(null);
  const [recallingTool, setRecallingTool] = useState<Tool | null>(null);
  const [historyTool, setHistoryTool] = useState<Tool | null>(null);
  const [toolHistory, setToolHistory] = useState<ToolBorrowRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [returnVerification, setReturnVerification] = useState<{tool: Tool, formData: ReturnFormValues} | null>(null);
  const [verificationInput, setVerificationInput] = useState("");

  const form = useForm<ToolFormValues>({
    resolver: zodResolver(toolSchema),
    defaultValues: { condition: "Good" },
  });

  const borrowForm = useForm<BorrowFormValues>();
  const returnForm = useForm<ReturnFormValues>();
  const assignForm = useForm<AssignFormValues>();
  const recallForm = useForm<RecallFormValues>();

  const assignedTools = useMemo(() => tools.filter(t => t.status === "Assigned"), [tools]);
  const borrowedTools = useMemo(() => tools.filter(t => t.status === "In Use"), [tools]);
  const pendingRequests = useMemo(() => toolBookingRequests.filter(r => r.status === 'Pending'), [toolBookingRequests]);

  useEffect(() => { if (isAddDialogOpen) form.reset({ condition: "Good" }); }, [isAddDialogOpen, form]);
  useEffect(() => { if (editingTool) { form.reset({ ...editingTool, purchaseDate: editingTool.purchaseDate ? new Date(editingTool.purchaseDate) : undefined }); setIsEditDialogOpen(true); } else { setIsEditDialogOpen(false); } }, [editingTool, form]);
  useEffect(() => { if (borrowingTool) { borrowForm.reset(); setIsBorrowDialogOpen(true); } else { setIsBorrowDialogOpen(false); } }, [borrowingTool, borrowForm]);
  useEffect(() => { if (returningTool) { returnForm.reset({ condition: returningTool.condition }); setIsReturnDialogOpen(true); } else { setIsReturnDialogOpen(false); } }, [returningTool, returnForm]);
  useEffect(() => { if (assigningTool) { assignForm.reset(); setIsAssignDialogOpen(true); } else { setIsAssignDialogOpen(false); } }, [assigningTool, assignForm]);
  useEffect(() => { if (recallingTool) { recallForm.reset({ condition: recallingTool.condition }); setIsRecallDialogOpen(true); } else { setIsRecallDialogOpen(false); } }, [recallingTool, recallForm]);

  useEffect(() => {
    if (historyTool) {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        const history = await getToolHistory(historyTool.id);
        setToolHistory(history);
        setHistoryLoading(false);
      };
      fetchHistory();
      setIsHistoryDialogOpen(true);
    }
  }, [historyTool]);


  const onAddSubmit = async (data: ToolFormValues) => {
    try {
      await addTool(data);
      toast({ title: "Success", description: "Tool added successfully." });
      setIsAddDialogOpen(false);
      await refetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add tool." });
    }
  };

  const onEditSubmit = async (data: ToolFormValues) => {
    if (!editingTool) return;
    try {
      await updateTool(editingTool.id, data);
      toast({ title: "Success", description: "Tool updated successfully." });
      setEditingTool(null);
      await refetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update tool." });
    }
  };

  const onBorrowSubmit = async (data: BorrowFormValues) => {
    if (!borrowingTool || !userProfile) return;
    try {
        const releasedByName = `${userProfile.firstName} ${userProfile.lastName}`;
        await borrowTool(borrowingTool.id, data.borrowedBy, releasedByName, data.notes);
        toast({ title: "Success", description: "Tool checked out." });
        setBorrowingTool(null);
        await refetchData();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to check out tool.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };
  
  const handleReturnVerification = (data: ReturnFormValues) => {
    if (!returningTool) return;
    setReturnVerification({ tool: returningTool, formData: data });
    setIsReturnDialogOpen(false);
  };

  const onReturnSubmit = async () => {
    if (!returnVerification) return;
    
    if (verificationInput !== returnVerification.tool.serialNumber) {
        toast({ variant: "destructive", title: "Verification Failed", description: "Serial number does not match."});
        return;
    }

    try {
        await returnTool(returnVerification.tool.id, returnVerification.formData.condition, returnVerification.formData.notes);
        toast({ title: "Success", description: `Tool state updated to: ${returnVerification.formData.condition}.` });
        setReturnVerification(null);
        setVerificationInput("");
        await refetchData();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to return tool.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };

  const onAssignSubmit = async (data: AssignFormValues) => {
    if (!assigningTool) return;
    try {
      await assignToolForAccountability(assigningTool.id, data.assignedTo);
      toast({ title: "Success", description: "Tool assigned for accountability." });
      setAssigningTool(null);
      await refetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to assign tool.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };

  const onRecallSubmit = async (data: RecallFormValues) => {
    if (!recallingTool) return;
    try {
        await recallTool(recallingTool.id, data.condition, data.notes);
        toast({ title: "Success", description: "Tool has been recalled."});
        setRecallingTool(null);
        await refetchData();
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to recall tool.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };
  
  const handleApproveRequest = async (requestId: string) => {
    if (!userProfile) return;
    try {
      await approveToolBookingRequest(requestId, `${userProfile.firstName} ${userProfile.lastName}`);
      toast({ title: "Approved", description: "Tool booking request has been approved."});
      await refetchData();
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "Failed to approve request.";
       toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectToolBookingRequest(requestId);
      toast({ title: "Rejected", description: "Tool booking request has been rejected."});
      await refetchData();
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "Failed to reject request.";
       toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  }


  const handleDeleteConfirm = async () => {
    if (!deletingToolId) return;
    try {
      await deleteTool(deletingToolId);
      toast({ title: "Success", description: "Tool deleted successfully." });
      await refetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete tool." });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingToolId(null);
    }
  };
  
  const formatDate = (date?: Date | Timestamp) => {
    if (!date) return 'N/A';
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    return format(jsDate, 'PP');
  }
  
  const formatLocation = (location?: ProductLocation) => {
    if (!location) return 'N/A';
    return Object.values(location).filter(Boolean).join(' - ');
  }
  
  const getCurrentUser = (tool: Tool) => {
    if (tool.status === 'Assigned') return tool.assignedToUserName;
    if (tool.status === 'In Use') return tool.currentBorrowRecord?.borrowedByName;
    return 'N/A';
  }

  const toolCategories = ["Hand Tool", "Power Tool", "Measuring Tool", "Safety Equipment", "Other"];

  const returnCondition = returnForm.watch("condition");
  const returnButtonText = useMemo(() => {
    if (returnCondition === "Good") return "Confirm Return";
    if (returnCondition === "Needs Repair") return "Transfer to Maintenance";
    if (returnCondition === "Damaged") return "Forward to Waste Management";
    return "Confirm Return";
  }, [returnCondition]);


  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold font-headline tracking-tight">Tool Management</h1>
            <p className="text-muted-foreground">Track all tools, their status, and who is accountable for them.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><PlusCircle />Add Tool</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                 <DialogHeader>
                    <DialogTitle>Add New Tool</DialogTitle>
                    <DialogDescription>Enter the details for the new tool below.</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="name">Tool Name</Label>
                            <Input id="name" {...form.register("name")} />
                            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="serialNumber">Serial Number</Label>
                            <Input id="serialNumber" {...form.register("serialNumber")} />
                            {form.formState.errors.serialNumber && <p className="text-sm text-destructive">{form.formState.errors.serialNumber.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                             <Controller
                                name="category"
                                control={form.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                        <SelectContent>
                                            {toolCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="space-y-2">
                            <Label>Purchase Date (Optional)</Label>
                            <Controller
                                control={form.control}
                                name="purchaseDate"
                                render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                                </Popover>
                                )}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="purchaseCost">Purchase Cost (Optional)</Label>
                             <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                                <Input id="purchaseCost" type="number" step="0.01" className="pl-8" placeholder="0.00" {...form.register("purchaseCost")} />
                             </div>
                        </div>
                    </div>
                     <div className="space-y-4 rounded-md border p-4">
                        <Label className="text-base">Default Settings</Label>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="borrowDuration">Borrow Duration (Days)</Label>
                                <Input id="borrowDuration" type="number" {...form.register("borrowDuration")} />
                                {form.formState.errors.borrowDuration && <p className="text-sm text-destructive">{form.formState.errors.borrowDuration.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="condition">Condition</Label>
                                <Controller
                                    name="condition"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Good">Good</SelectItem>
                                                <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                                                <SelectItem value="Damaged">Damaged</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4 rounded-md border p-4">
                        <Label className="text-base">Storage Location</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                            <Input placeholder="Zone" {...form.register("location.zone")} />
                            <Input placeholder="Aisle" {...form.register("location.aisle")} />
                            <Input placeholder="Rack" {...form.register("location.rack")} />
                            <Input placeholder="Level" {...form.register("location.level")} />
                            <Input placeholder="Bin" {...form.register("location.bin")} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>Add Tool</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>
      <Tabs defaultValue="inventory">
        <TabsList>
            <TabsTrigger value="inventory">Tool Inventory</TabsTrigger>
            <TabsTrigger value="requests">Request Queue <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge></TabsTrigger>
            <TabsTrigger value="history">Borrow History</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
            <Card>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Tool</TableHead>
                            <TableHead>Serial #</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Condition</TableHead>
                            <TableHead>Current User</TableHead>
                            <TableHead>Date Issued</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : tools.map((tool) => {
                            const user = getCurrentUser(tool);
                            return (
                            <TableRow key={tool.id} className="cursor-pointer" onClick={() => setEditingTool(tool)}>
                                <TableCell className="font-medium">{tool.name}</TableCell>
                                <TableCell>{tool.serialNumber}</TableCell>
                                <TableCell><Badge variant={statusVariant[tool.status]}>{tool.status}</Badge></TableCell>
                                <TableCell><Badge variant={conditionVariant[tool.condition]}>{tool.condition}</Badge></TableCell>
                                <TableCell>{user}</TableCell>
                                <TableCell>{tool.status === 'In Use' && tool.currentBorrowRecord ? formatDate(tool.currentBorrowRecord?.dateBorrowed) : 'N/A'}</TableCell>
                                <TableCell>{formatLocation(tool.location)}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            {tool.status === 'Available' && tool.condition === 'Good' && (
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <ArrowUpRight className="mr-2 h-4 w-4" /> Issue Tool
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent>
                                                        <DropdownMenuItem onClick={() => setBorrowingTool(tool)}>
                                                            <ArrowUpRight className="mr-2" /> Borrow (Temporary)
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setAssigningTool(tool)}>
                                                            <UserCheck className="mr-2" /> Assign Accountability
                                                        </DropdownMenuItem>
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                            )}
                                            <DropdownMenuItem onClick={() => setEditingTool(tool)}>Edit</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setHistoryTool(tool)}>History</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingToolId(tool.id); setIsDeleteDialogOpen(true);}}>Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="requests">
            <Card>
                <CardHeader>
                    <CardTitle>Tool Request Queue</CardTitle>
                    <CardDescription>Review and approve or reject tool booking requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tool</TableHead>
                                <TableHead>Requested By</TableHead>
                                <TableHead>Dates</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5}><Skeleton className="h-8" /></TableCell></TableRow>
                            ) : pendingRequests.length > 0 ? (
                                pendingRequests.map(request => (
                                    <TableRow key={request.id}>
                                        <TableCell>{request.toolName}</TableCell>
                                        <TableCell>{request.requestedByName}</TableCell>
                                        <TableCell>{formatDate(request.startDate)} - {formatDate(request.endDate)}</TableCell>
                                        <TableCell><Badge variant={requestStatusVariant[request.status]}>{request.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleRejectRequest(request.id)}><X className="mr-1" /> Reject</Button>
                                                <Button size="sm" onClick={() => handleApproveRequest(request.id)}><Check className="mr-1" /> Approve</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">No pending tool requests.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="history">
             <Tabs defaultValue="accountability">
                <TabsList>
                    <TabsTrigger value="accountability">Accountability</TabsTrigger>
                    <TabsTrigger value="temporary">Temporary Borrow</TabsTrigger>
                </TabsList>
                <TabsContent value="accountability">
                    <Card>
                        <CardContent className="pt-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tool</TableHead>
                                        <TableHead>Serial #</TableHead>
                                        <TableHead>Accountable Person</TableHead>
                                        <TableHead>Condition</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={5}><Skeleton className="h-8" /></TableCell></TableRow>
                                    ) : assignedTools.length > 0 ? (
                                        assignedTools.map(tool => (
                                            <TableRow key={tool.id}>
                                                <TableCell>{tool.name}</TableCell>
                                                <TableCell>{tool.serialNumber}</TableCell>
                                                <TableCell>{tool.assignedToUserName}</TableCell>
                                                <TableCell><Badge variant={conditionVariant[tool.condition]}>{tool.condition}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => setRecallingTool(tool)}>Recall</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={5} className="h-24 text-center">No tools are currently assigned for accountability.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="temporary">
                     <Card>
                        <CardContent className="pt-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tool</TableHead>
                                        <TableHead>Serial #</TableHead>
                                        <TableHead>Borrowed By</TableHead>
                                        <TableHead>Date Borrowed</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>
                                    ) : borrowedTools.length > 0 ? (
                                        borrowedTools.map(tool => (
                                            <TableRow key={tool.id}>
                                                <TableCell>{tool.name}</TableCell>
                                                <TableCell>{tool.serialNumber}</TableCell>
                                                <TableCell>{tool.currentBorrowRecord?.borrowedByName}</TableCell>
                                                <TableCell>{formatDate(tool.currentBorrowRecord?.dateBorrowed)}</TableCell>
                                                <TableCell>{formatDate(tool.currentBorrowRecord?.dueDate)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => setReturningTool(tool)}>Return</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center">No tools are currently borrowed.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
             </Tabs>
        </TabsContent>
      </Tabs>
    

    {/* Edit Dialog */}
    <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && setEditingTool(null)}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edit Tool</DialogTitle>
                <DialogDescription>Update details for {editingTool?.name}</DialogDescription>
            </DialogHeader>
             <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="edit-name">Tool Name</Label>
                            <Input id="edit-name" {...form.register("name")} />
                            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="edit-serialNumber">Serial Number</Label>
                            <Input id="edit-serialNumber" {...form.register("serialNumber")} />
                            {form.formState.errors.serialNumber && <p className="text-sm text-destructive">{form.formState.errors.serialNumber.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-category">Category</Label>
                             <Controller
                                name="category"
                                control={form.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                        <SelectContent>
                                            {toolCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="space-y-2">
                            <Label>Purchase Date (Optional)</Label>
                            <Controller
                                control={form.control}
                                name="purchaseDate"
                                render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                                </Popover>
                                )}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-purchaseCost">Purchase Cost (Optional)</Label>
                             <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{CURRENCY_CONFIG.symbol}</span>
                                <Input id="edit-purchaseCost" type="number" step="0.01" className="pl-8" placeholder="0.00" {...form.register("purchaseCost")} />
                             </div>
                        </div>
                    </div>
                    <div className="space-y-4 rounded-md border p-4">
                        <Label className="text-base">Default Settings</Label>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="edit-borrowDuration">Borrow Duration (Days)</Label>
                                <Input id="edit-borrowDuration" type="number" {...form.register("borrowDuration")} />
                                {form.formState.errors.borrowDuration && <p className="text-sm text-destructive">{form.formState.errors.borrowDuration.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-condition">Condition</Label>
                                <Controller
                                    name="condition"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                                            <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Good">Good</SelectItem>
                                                <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                                                <SelectItem value="Damaged">Damaged</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                     <div className="space-y-4 rounded-md border p-4">
                        <Label className="text-base">Storage Location</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                            <Input placeholder="Zone" {...form.register("location.zone")} />
                            <Input placeholder="Aisle" {...form.register("location.aisle")} />
                            <Input placeholder="Rack" {...form.register("location.rack")} />
                            <Input placeholder="Level" {...form.register("location.level")} />
                            <Input placeholder="Bin" {...form.register("location.bin")} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditingTool(null)}>Cancel</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>Save Changes</Button>
                    </DialogFooter>
                </form>
        </DialogContent>
    </Dialog>

    {/* Borrow Dialog */}
    <Dialog open={isBorrowDialogOpen} onOpenChange={(open) => !open && setBorrowingTool(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Borrow Tool: {borrowingTool?.name}</DialogTitle>
                <DialogDescription>Assign this tool to a user for temporary use.</DialogDescription>
            </DialogHeader>
            <form onSubmit={borrowForm.handleSubmit(onBorrowSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="borrowedBy">Borrowed By</Label>
                    <Controller
                        name="borrowedBy"
                        control={borrowForm.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
                                        <SelectItem key={user.uid} value={user.uid}>{user.firstName} {user.lastName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {borrowForm.formState.errors.borrowedBy && <p className="text-sm text-destructive">{borrowForm.formState.errors.borrowedBy.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea id="notes" {...borrowForm.register("notes")} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setBorrowingTool(null)}>Cancel</Button>
                    <Button type="submit" disabled={borrowForm.formState.isSubmitting}>Confirm Borrow</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    
     {/* Return Dialog */}
    <Dialog open={isReturnDialogOpen} onOpenChange={(open) => !open && setReturningTool(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Return Tool: {returningTool?.name}</DialogTitle>
                <DialogDescription>Record the condition of the tool upon return.</DialogDescription>
            </DialogHeader>
            <form onSubmit={returnForm.handleSubmit(handleReturnVerification)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="return-condition">Return Condition</Label>
                    <Controller
                        name="condition"
                        control={returnForm.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Good">Good</SelectItem>
                                    <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                                    <SelectItem value="Damaged">Damaged</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="return-notes">Notes (Optional)</Label>
                    <Textarea id="return-notes" {...returnForm.register("notes")} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setReturningTool(null)}>Cancel</Button>
                    <Button type="submit" disabled={returnForm.formState.isSubmitting}>{returnButtonText}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>

    {/* Recall Dialog */}
    <Dialog open={isRecallDialogOpen} onOpenChange={(open) => !open && setRecallingTool(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Recall Tool: {recallingTool?.name}</DialogTitle>
                <DialogDescription>Recall this tool and update its condition.</DialogDescription>
            </DialogHeader>
            <form onSubmit={recallForm.handleSubmit(onRecallSubmit)} className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="recall-condition">New Condition</Label>
                    <Controller
                        name="condition"
                        control={recallForm.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Good">Good</SelectItem>
                                    <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                                    <SelectItem value="Damaged">Damaged</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="recall-notes">Notes (Optional)</Label>
                    <Textarea id="recall-notes" {...recallForm.register("notes")} />
                </div>
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setRecallingTool(null)}>Cancel</Button>
                    <Button type="submit" disabled={recallForm.formState.isSubmitting}>Confirm Recall</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>

    {/* Return Verification Dialog */}
    <Dialog open={!!returnVerification} onOpenChange={(open) => !open && setReturnVerification(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Tool Return</DialogTitle>
          <DialogDescription>
            To confirm you are returning the correct tool, please enter the serial number for{" "}
            <strong>{returnVerification?.tool.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-lg text-center font-mono bg-muted p-4 rounded-md">{returnVerification?.tool.serialNumber}</p>
          <div className="space-y-2">
            <Label htmlFor="verification-input">Enter Serial Number</Label>
            <Input
              id="verification-input"
              value={verificationInput}
              onChange={(e) => setVerificationInput(e.target.value)}
              placeholder="Enter serial number to verify"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setReturnVerification(null); setVerificationInput(""); }}>Cancel</Button>
          <Button onClick={onReturnSubmit}>Submit Return</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Assign Accountability Dialog */}
    <Dialog open={isAssignDialogOpen} onOpenChange={(open) => !open && setAssigningTool(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Assign Accountability: {assigningTool?.name}</DialogTitle>
                <DialogDescription>Assign permanent accountability for this tool to a user.</DialogDescription>
            </DialogHeader>
            <form onSubmit={assignForm.handleSubmit(onAssignSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="assignedTo">Accountable User</Label>
                    <Controller
                        name="assignedTo"
                        control={assignForm.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
                                        <SelectItem key={user.uid} value={user.uid}>{user.firstName} {user.lastName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {assignForm.formState.errors.assignedTo && <p className="text-sm text-destructive">{assignForm.formState.errors.assignedTo.message}</p>}
                </div>
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAssigningTool(null)}>Cancel</Button>
                    <Button type="submit" disabled={assignForm.formState.isSubmitting}>Confirm Assignment</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    
    {/* History Dialog */}
    <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => !open && setHistoryTool(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Borrow History: {historyTool?.name}</DialogTitle>
                <DialogDescription>A log of who has borrowed this tool.</DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto -mx-6 px-6">
                 {historyLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                    </div>
                ) : toolHistory.length > 0 ? (
                     <ul className="space-y-4">
                        {toolHistory.map(record => {
                            const isActive = !record.dateReturned;
                            return (
                                <li key={record.id} className="flex items-start gap-4 p-3 border rounded-md">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="font-medium">{record.borrowedByName}</p>
                                            {isActive && <Badge>In Use</Badge>}
                                        </div>
                                        <div className="text-sm text-muted-foreground space-y-1 mt-1">
                                          <p><strong>Borrowed:</strong> {formatDate(record.dateBorrowed)}</p>
                                          {record.dueDate && <p><strong>Due:</strong> {formatDate(record.dueDate)}</p>}
                                          {record.dateReturned && <p><strong>Returned:</strong> {formatDate(record.dateReturned)}</p>}
                                          {record.returnCondition && <p><strong>Return Condition:</strong> <Badge variant={conditionVariant[record.returnCondition] || 'default'}>{record.returnCondition}</Badge></p>}
                                          {record.releasedBy && <p><strong>Released by:</strong> {record.releasedBy}</p>}
                                        </div>
                                        {record.notes && <p className="text-xs text-muted-foreground mt-2 border-l-2 pl-2 italic">Note: {record.notes}</p>}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p className="text-center text-muted-foreground py-8">No borrow history for this tool.</p>
                )}
            </div>
             <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setHistoryTool(null); setIsHistoryDialogOpen(false); }}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {/* Delete Dialog */}
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone. This will permanently delete this tool.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteConfirm} className={cn(buttonVariants({variant: "destructive"}))}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
