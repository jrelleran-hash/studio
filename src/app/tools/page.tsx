
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Wrench, Calendar as CalendarIcon, User, History, CheckCircle, XCircle, ArrowUpRight, ArrowDownLeft, ShieldQuestion, Recycle, UserCheck } from "lucide-react";
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
import { addTool, updateTool, deleteTool, borrowTool, returnTool, getToolHistory, assignToolForAccountability, recallTool } from "@/services/data-service";
import type { Tool, ToolBorrowRecord, UserProfile } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const toolSchema = z.object({
  name: z.string().min(1, "Tool name is required."),
  serialNumber: z.string().min(1, "Serial number is required."),
  purchaseDate: z.date().optional(),
  condition: z.enum(["Good", "Needs Repair", "Damaged"]),
});

type ToolFormValues = z.infer<typeof toolSchema>;

const borrowSchema = z.object({
    borrowedBy: z.string().min(1, "Please select who is borrowing the tool."),
    notes: z.string().optional(),
});

type BorrowFormValues = z.infer<typeof borrowSchema>;

const returnSchema = z.object({
    condition: z.enum(["Good", "Needs Repair", "Damaged"]),
    notes: z.string().optional(),
});

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

export default function ToolManagementPage() {
  const { tools, users, loading, refetchData } = useData();
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

  const toolForm = useForm<ToolFormValues>({
    resolver: zodResolver(toolSchema),
    defaultValues: { condition: "Good" },
  });

  const borrowForm = useForm<BorrowFormValues>();
  const returnForm = useForm<ReturnFormValues>();
  const assignForm = useForm<AssignFormValues>();
  const recallForm = useForm<RecallFormValues>();

  useEffect(() => { if (isAddDialogOpen) toolForm.reset({ condition: "Good" }); }, [isAddDialogOpen, toolForm]);
  useEffect(() => { if (editingTool) { toolForm.reset({ ...editingTool, purchaseDate: editingTool.purchaseDate }); setIsEditDialogOpen(true); } else { setIsEditDialogOpen(false); } }, [editingTool, toolForm]);
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
    if (!borrowingTool) return;
    try {
        await borrowTool(borrowingTool.id, data.borrowedBy, data.notes);
        toast({ title: "Success", description: "Tool checked out." });
        setBorrowingTool(null);
        await refetchData();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to check out tool.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };
  
  const onReturnSubmit = async (data: ReturnFormValues) => {
    if (!returningTool) return;
    try {
        await returnTool(returningTool.id, data.condition, data.notes);
        toast({ title: "Success", description: "Tool returned successfully." });
        setReturningTool(null);
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
      toast({ title: "Success", description: "Tool recalled successfully." });
      setRecallingTool(null);
      await refetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to recall tool.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };


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
  
  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return format(date, 'PP');
  }
  
  const getCurrentUser = (tool: Tool) => {
    if (tool.status === 'Assigned') return tool.assignedToUserName;
    if (tool.status === 'In Use') return tool.currentBorrowRecord?.borrowedByName;
    return 'N/A';
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
            <CardTitle>Tool Management</CardTitle>
            <CardDescription>Track all tools, their status, and who is accountable for them.</CardDescription>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><PlusCircle />Add Tool</Button>
            </DialogTrigger>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Add New Tool</DialogTitle>
                </DialogHeader>
                <form onSubmit={toolForm.handleSubmit(onAddSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Tool Name</Label>
                        <Input id="name" {...toolForm.register("name")} />
                        {toolForm.formState.errors.name && <p className="text-sm text-destructive">{toolForm.formState.errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="serialNumber">Serial Number</Label>
                        <Input id="serialNumber" {...toolForm.register("serialNumber")} />
                        {toolForm.formState.errors.serialNumber && <p className="text-sm text-destructive">{toolForm.formState.errors.serialNumber.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Purchase Date (Optional)</Label>
                            <Controller
                                control={toolForm.control}
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
                            <Label htmlFor="condition">Condition</Label>
                            <Controller
                                name="condition"
                                control={toolForm.control}
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
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={toolForm.formState.isSubmitting}>Add Tool</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Serial #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Current User</TableHead>
              <TableHead>Date Issued</TableHead>
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
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                ))
            ) : tools.map((tool) => (
              <TableRow key={tool.id}>
                <TableCell className="font-medium">{tool.name}</TableCell>
                <TableCell>{tool.serialNumber}</TableCell>
                <TableCell><Badge variant={statusVariant[tool.status]}>{tool.status}</Badge></TableCell>
                <TableCell><Badge variant={conditionVariant[tool.condition]}>{tool.condition}</Badge></TableCell>
                <TableCell>{getCurrentUser(tool)}</TableCell>
                <TableCell>{tool.status === 'In Use' ? formatDate(tool.currentBorrowRecord?.dateBorrowed as Date) : 'N/A'}</TableCell>
                <TableCell className="text-right">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            
                            {tool.status === 'Available' && (
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

                            {(tool.status === 'In Use' || tool.status === 'Assigned') && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <ArrowDownLeft className="mr-2 h-4 w-4" /> Retrieve Tool
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem onClick={() => setReturningTool(tool)} disabled={tool.status !== 'In Use'}>
                                            <ArrowDownLeft className="mr-2" /> Return (from Borrow)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setRecallingTool(tool)} disabled={tool.status !== 'Assigned'}>
                                            <Recycle className="mr-2" /> Recall (from Accountability)
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    {/* Edit Dialog */}
    <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && setEditingTool(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Tool</DialogTitle>
                <DialogDescription>Update details for {editingTool?.name}</DialogDescription>
            </DialogHeader>
             <form onSubmit={toolForm.handleSubmit(onEditSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Tool Name</Label>
                        <Input id="name" {...toolForm.register("name")} />
                        {toolForm.formState.errors.name && <p className="text-sm text-destructive">{toolForm.formState.errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="serialNumber">Serial Number</Label>
                        <Input id="serialNumber" {...toolForm.register("serialNumber")} />
                        {toolForm.formState.errors.serialNumber && <p className="text-sm text-destructive">{toolForm.formState.errors.serialNumber.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Purchase Date (Optional)</Label>
                            <Controller
                                control={toolForm.control}
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
                            <Label htmlFor="condition">Condition</Label>
                            <Controller
                                name="condition"
                                control={toolForm.control}
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
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditingTool(null)}>Cancel</Button>
                        <Button type="submit" disabled={toolForm.formState.isSubmitting}>Save Changes</Button>
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
                <DialogDescription>Update the tool's condition upon return from temporary use.</DialogDescription>
            </DialogHeader>
            <form onSubmit={returnForm.handleSubmit(onReturnSubmit)} className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="condition-return">Condition on Return</Label>
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
                    <Label htmlFor="notes-return">Notes (Optional)</Label>
                    <Textarea id="notes-return" {...returnForm.register("notes")} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setReturningTool(null)}>Cancel</Button>
                    <Button type="submit" disabled={returnForm.formState.isSubmitting}>Confirm Return</Button>
                </DialogFooter>
            </form>
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

    {/* Recall Dialog */}
    <Dialog open={isRecallDialogOpen} onOpenChange={(open) => !open && setRecallingTool(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Recall Tool: {recallingTool?.name}</DialogTitle>
                <DialogDescription>Recall this tool and update its condition.</DialogDescription>
            </DialogHeader>
             <form onSubmit={recallForm.handleSubmit(onRecallSubmit)} className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="condition-recall">Condition on Recall</Label>
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
                    <Label htmlFor="notes-recall">Notes (Optional)</Label>
                    <Textarea id="notes-recall" {...recallForm.register("notes")} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setRecallingTool(null)}>Cancel</Button>
                    <Button type="submit" disabled={recallForm.formState.isSubmitting}>Confirm Recall</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    
    {/* History Dialog */}
    <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => !open && setHistoryTool(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Borrow History: {historyTool?.name}</DialogTitle>
                <DialogDescription>A log of who has borrowed this tool.</DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto -mx-6 px-6">
                 {historyLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : toolHistory.length > 0 ? (
                     <ul className="space-y-4">
                        {toolHistory.map(record => (
                            <li key={record.id} className="flex items-start gap-4">
                                <div className="flex-shrink-0 mt-1">
                                    {record.dateReturned ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-yellow-500" />}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">{record.borrowedByName}</p>
                                    <p className="text-sm text-muted-foreground">Borrowed: {formatDate(record.dateBorrowed)}</p>
                                    {record.dateReturned && <p className="text-sm text-muted-foreground">Returned: {formatDate(record.dateReturned)}</p>}
                                    {record.notes && <p className="text-xs text-muted-foreground mt-1 border-l-2 pl-2">Note: {record.notes}</p>}
                                </div>
                            </li>
                        ))}
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
    </>
  );
}
