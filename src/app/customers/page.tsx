
"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, MoreHorizontal, Upload, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getCustomers, addCustomer, updateCustomer, deleteCustomer } from "@/services/data-service";
import { importCustomersAction } from "@/app/actions";
import type { Customer } from "@/types";

const customerSchema = z.object({
  projectName: z.string().min(1, "Project name is required."),
  clientName: z.string().min(1, "Client name is required."),
  boqNumber: z.string().min(1, "BOQ number is required."),
  address: z.string().min(1, "Address is required."),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const { toast } = useToast();
  const [sheetLink, setSheetLink] = useState("");

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      projectName: "",
      clientName: "",
      boqNumber: "",
      address: "",
    },
  });

  const editForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  });

  async function fetchCustomers() {
    setLoading(true);
    try {
      const fetchedCustomers = await getCustomers();
      setCustomers(fetchedCustomers);
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch customers.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);
  
  useEffect(() => {
    if (editingCustomer) {
      editForm.reset(editingCustomer);
    }
  }, [editingCustomer, editForm]);


  const onAddSubmit = async (data: CustomerFormValues) => {
    try {
      await addCustomer(data);
      toast({ title: "Success", description: "Customer added successfully." });
      setIsAddDialogOpen(false);
      form.reset();
      fetchCustomers(); // Refresh the list
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add customer. Please try again.",
      });
    }
  };

  const onEditSubmit = async (data: CustomerFormValues) => {
    if (!editingCustomer) return;
    try {
      await updateCustomer(editingCustomer.id, data);
      toast({ title: "Success", description: "Customer updated successfully." });
      setIsEditDialogOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
       console.error(error);
       toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update customer. Please try again.",
      });
    }
  };

  const handleImport = async () => {
    if (!sheetLink) {
       toast({
        variant: "destructive",
        title: "No link provided",
        description: "Please provide a link to the spreadsheet.",
      });
      return;
    }
    
    setIsImporting(true);
    const result = await importCustomersAction({ sheetUrl: sheetLink });
    setIsImporting(false);

    if (result.success) {
      toast({
        title: "Import Successful",
        description: `${result.importedCount} customers were imported.`,
      });
      setIsImportDialogOpen(false);
      setSheetLink("");
      fetchCustomers(); // Refresh the customer list
    } else {
       toast({
        variant: "destructive",
        title: "Import Failed",
        description: result.error || "An unknown error occurred.",
      });
    }
  };
  
  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (customerId: string) => {
    setDeletingCustomerId(customerId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCustomerId) return;
    try {
      await deleteCustomer(deletingCustomerId);
      toast({ title: "Success", description: "Customer deleted successfully." });
      fetchCustomers();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete customer. Please try again.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingCustomerId(null);
    }
  };


  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Customers</CardTitle>
          <CardDescription>Manage your customer database.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Upload className="h-4 w-4" />
                  Import from Sheet
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Import Customers</DialogTitle>
                <DialogDescription>
                  Enter the public link to your spreadsheet to import new customers.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="space-y-2">
                    <Label htmlFor="customer-sheet-link">Spreadsheet Link</Label>
                    <Input 
                      id="customer-sheet-link" 
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetLink}
                      onChange={(e) => setSheetLink(e.target.value)}
                      disabled={isImporting}
                    />
                 </div>
              </div>
              <DialogFooter>
                 <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={isImporting}>Cancel</Button>
                 <Button type="button" onClick={handleImport} disabled={isImporting}>
                  {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isImporting ? 'Importing...' : 'Import'}
                 </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>Fill in the details for the new customer.</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input id="projectName" {...form.register("projectName")} />
                  {form.formState.errors.projectName && <p className="text-sm text-destructive">{form.formState.errors.projectName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input id="clientName" {...form.register("clientName")} />
                  {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="boqNumber">BOQ Number</Label>
                  <Input id="boqNumber" {...form.register("boqNumber")} />
                  {form.formState.errors.boqNumber && <p className="text-sm text-destructive">{form.formState.errors.boqNumber.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" {...form.register("address")} />
                  {form.formState.errors.address && <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Adding..." : "Add Customer"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Client Name</TableHead>
              <TableHead>BOQ Number</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.projectName}</TableCell>
                  <TableCell>{customer.clientName}</TableCell>
                  <TableCell>{customer.boqNumber}</TableCell>
                  <TableCell>{customer.address}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEditClick(customer)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteClick(customer.id)} className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
      
    {editingCustomer && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Customer</DialogTitle>
                <DialogDescription>Update the details for {editingCustomer.clientName}.</DialogDescription>
              </DialogHeader>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-projectName">Project Name</Label>
                  <Input id="edit-projectName" {...editForm.register("projectName")} />
                  {editForm.formState.errors.projectName && <p className="text-sm text-destructive">{editForm.formState.errors.projectName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-clientName">Client Name</Label>
                  <Input id="edit-clientName" {...editForm.register("clientName")} />
                  {editForm.formState.errors.clientName && <p className="text-sm text-destructive">{editForm.formState.errors.clientName.message}</p>}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="edit-boqNumber">BOQ Number</Label>
                  <Input id="edit-boqNumber" {...editForm.register("boqNumber")} />
                  {editForm.formState.errors.boqNumber && <p className="text-sm text-destructive">{editForm.formState.errors.boqNumber.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" {...editForm.register("address")} />
                  {editForm.formState.errors.address && <p className="text-sm text-destructive">{editForm.formState.errors.address.message}</p>}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={editForm.formState.isSubmitting}>
                    {editForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
    )}
    
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            customer from your records.
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

    