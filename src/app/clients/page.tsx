

"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
import { addClient, updateClient, deleteClient } from "@/services/data-service";
import { useData } from "@/context/data-context";

import type { Client } from "@/types";

// Base schema for the form fields
const baseClientSchema = z.object({
  projectName: z.string().min(1, "Project name is required."),
  clientName: z.string().min(1, "Client name is required."),
  boqNumber: z.string().min(1, "BOQ number is required."),
  address: z.string().min(1, "Address is required."),
});

// Function to create a refined schema for validation
const createClientSchema = (clients: Client[], currentClientId?: string) => {
  return baseClientSchema.superRefine((data, ctx) => {
    // Check for duplicate BOQ Number
    const boqExists = clients.some(
      c => c.id !== currentClientId && c.boqNumber.trim().toLowerCase() === data.boqNumber.trim().toLowerCase()
    );
    if (boqExists) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `BOQ Number "${data.boqNumber}" already exists.`,
        path: ["boqNumber"],
      });
    }

    // Check for duplicate record (Project, Client, Address)
    const recordExists = clients.some(
      c =>
        c.id !== currentClientId &&
        c.projectName.trim().toLowerCase() === data.projectName.trim().toLowerCase() &&
        c.clientName.trim().toLowerCase() === data.clientName.trim().toLowerCase() &&
        c.address.trim().toLowerCase() === data.address.trim().toLowerCase()
    );
    if (recordExists) {
       const errorMessage = "A client with this Project Name, Client Name, and Address already exists.";
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorMessage, path: ["projectName"] });
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorMessage, path: ["clientName"] });
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorMessage, path: ["address"] });
    }
  });
};


type ClientFormValues = z.infer<typeof baseClientSchema>;

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

export default function ClientsPage() {
  const { clients, loading, refetchData } = useData();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const { toast } = useToast();

  // Memoize schemas to avoid re-creating them on every render
  const addClientSchema = useMemo(() => createClientSchema(clients), [clients]);
  const editClientSchema = useMemo(() => createClientSchema(clients, editingClient?.id), [clients, editingClient?.id]);
  
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(addClientSchema),
    mode: 'onBlur',
  });

  const editForm = useForm<ClientFormValues>({
    resolver: zodResolver(editClientSchema),
    mode: 'onBlur',
  });
  
  // Effect to reset edit form when the editing client changes
  useEffect(() => {
    if (editingClient) {
      editForm.reset(editingClient);
    } else {
      editForm.reset();
    }
  }, [editingClient, editForm]);


  const onAddSubmit = async (data: ClientFormValues) => {
    try {
      await addClient(data);
      toast({ title: "Success", description: "Client added successfully." });
      setIsAddDialogOpen(false);
      form.reset();
      await refetchData(); // Refresh the list
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add client. Please try again.",
      });
    }
  };

  const onEditSubmit = async (data: ClientFormValues) => {
    if (!editingClient) return;
    
    try {
      await updateClient(editingClient.id, data);
      toast({ title: "Success", description: "Client updated successfully." });
      setIsEditDialogOpen(false);
      setEditingClient(null);
      await refetchData();
    } catch (error) {
       console.error(error);
       toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update client. Please try again.",
      });
    }
  };

  
  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (clientId: string) => {
    setDeletingClientId(clientId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingClientId) return;
    try {
      await deleteClient(deletingClientId);
      toast({ title: "Success", description: "Client deleted successfully." });
      await refetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete client. Please try again.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingClientId(null);
    }
  };
  
  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    return format(timestamp.toDate(), 'PPpp');
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Clients</CardTitle>
          <CardDescription>Manage your client database.</CardDescription>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <Dialog open={isAddDialogOpen} onOpenChange={(isOpen) => {
            setIsAddDialogOpen(isOpen);
            if(!isOpen) form.reset();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 w-full md:w-auto">
                <PlusCircle />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Fill in the details for the new client.</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input 
                    id="projectName" 
                    {...form.register("projectName")} 
                    onChange={(e) => {
                      const { value } = e.target;
                      form.setValue("projectName", toTitleCase(value), { shouldValidate: true });
                    }}
                  />
                  {form.formState.errors.projectName && <p className="text-sm text-destructive">{form.formState.errors.projectName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input 
                    id="clientName" 
                    {...form.register("clientName")} 
                    onChange={(e) => {
                      const { value } = e.target;
                      form.setValue("clientName", toTitleCase(value), { shouldValidate: true });
                    }}
                  />
                  {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="boqNumber">BOQ Number</Label>
                  <Input 
                    id="boqNumber" 
                    {...form.register("boqNumber")}
                  />
                  {form.formState.errors.boqNumber && <p className="text-sm text-destructive">{form.formState.errors.boqNumber.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address" 
                    {...form.register("address")}
                   />
                  {form.formState.errors.address && <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={!form.formState.isValid || form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Adding..." : "Add Client"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead>BOQ Number</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell>{client.projectName}</TableCell>
                      <TableCell>{client.boqNumber}</TableCell>
                      <TableCell>{client.address}</TableCell>
                      <TableCell>{formatDate(client.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditClick(client)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteClick(client.id)} className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </div>
        <div className="grid gap-4 md:hidden">
            {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                    </CardContent>
                    </Card>
                ))
            ) : (
                clients.map((client) => (
                    <Card key={client.id} className="w-full cursor-pointer" onClick={() => handleEditClick(client)}>
                        <CardHeader className="flex flex-row justify-between items-start">
                            <div>
                                <CardTitle className="text-base">{client.clientName}</CardTitle>
                                <CardDescription>{client.projectName}</CardDescription>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleEditClick(client)}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteClick(client.id)} className="text-destructive">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                             <p><span className="font-medium">BOQ:</span> {client.boqNumber}</p>
                             <p><span className="font-medium">Address:</span> {client.address}</p>
                        </CardContent>
                        <CardFooter className="text-xs text-muted-foreground">
                            Added on {formatDate(client.createdAt)}
                        </CardFooter>
                    </Card>
                ))
            )}
        </div>
      </CardContent>
    </Card>
      
    <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
        setIsEditDialogOpen(isOpen);
        if(!isOpen) {
            setEditingClient(null);
            editForm.reset();
        }
    }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            {editingClient && <DialogDescription>Update the details for {editingClient.clientName}.</DialogDescription>}
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="edit-projectName">Project Name</Label>
                <Input 
                id="edit-projectName" 
                {...editForm.register("projectName")} 
                onChange={(e) => {
                    const { value } = e.target;
                    editForm.setValue("projectName", toTitleCase(value), { shouldValidate: true });
                }}
                />
                {editForm.formState.errors.projectName && <p className="text-sm text-destructive">{editForm.formState.errors.projectName.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-clientName">Client Name</Label>
                <Input 
                id="edit-clientName" 
                {...editForm.register("clientName")} 
                onChange={(e) => {
                    const { value } = e.target;
                    editForm.setValue("clientName", toTitleCase(value), { shouldValidate: true });
                }} 
                />
                {editForm.formState.errors.clientName && <p className="text-sm text-destructive">{editForm.formState.errors.clientName.message}</p>}
            </div>
                <div className="space-y-2">
                <Label htmlFor="edit-boqNumber">BOQ Number</Label>
                <Input 
                id="edit-boqNumber" 
                {...editForm.register("boqNumber")}
                />
                {editForm.formState.errors.boqNumber && <p className="text-sm text-destructive">{editForm.formState.errors.boqNumber.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input 
                id="edit-address" 
                {...editForm.register("address")}
                />
                {editForm.formState.errors.address && <p className="text-sm text-destructive">{editForm.formState.errors.address.message}</p>}
            </div>
            <DialogFooter>
                <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={!editForm.formState.isValid || editForm.formState.isSubmitting}>
                {editForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
            </DialogFooter>
            </form>
        </DialogContent>
        </Dialog>
    
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            client from your records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
