
"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { deleteReturn, processReturn } from "@/services/data-service";
import { useToast } from "@/hooks/use-toast";
import type { Return, OutboundReturn } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const inboundStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Pending: "secondary",
  Received: "outline",
  Completed: "default",
  Cancelled: "destructive",
};

const outboundStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Pending: "secondary",
  Shipped: "outline",
  Completed: "default",
  Cancelled: "destructive",
};


export default function ReturnsPage() {
  const { returns, outboundReturns, loading, refetchData } = useData();
  const { user } = useAuth();
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [selectedOutboundReturn, setSelectedOutboundReturn] = useState<OutboundReturn | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingReturnId, setDeletingReturnId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();


  const handleProcessReturn = async (returnId: string, status: "Received" | "Cancelled") => {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
        return;
    }
    try {
      await processReturn(returnId, status, user.displayName || user.email || "System");
      toast({ title: "Success", description: `Return marked as ${status}.` });
      await refetchData();
      setSelectedReturn(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };

  const handleInspectClick = (returnId: string) => {
    setSelectedReturn(null);
    router.push('/quality-control');
  }

  const handleDeleteClick = (returnId: string) => {
    setDeletingReturnId(returnId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingReturnId) return;
    try {
      await deleteReturn(deletingReturnId);
      toast({ title: "Success", description: "Return record deleted successfully." });
      await refetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete return.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    } finally {
        setDeletingReturnId(null);
        setIsDeleteDialogOpen(false);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return format(date, 'PPP');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Returns Management</h1>
        <p className="text-muted-foreground">Track and process all customer and supplier returns.</p>
      </div>

       <Tabs defaultValue="inbound">
          <TabsList className="mb-4">
              <TabsTrigger value="inbound">Inbound (From Customers)</TabsTrigger>
              <TabsTrigger value="outbound">Outbound (To Suppliers)</TabsTrigger>
          </TabsList>
          <TabsContent value="inbound">
             <Card>
              <CardHeader>
                <CardTitle>Inbound Returns</CardTitle>
                <CardDescription>A log of all initiated returns from customers.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RMA #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issuance #</TableHead>
                      <TableHead>Date Initiated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : returns.length > 0 ? (
                      returns.map((ret) => (
                        <TableRow key={ret.id}>
                          <TableCell className="font-medium" onClick={() => setSelectedReturn(ret)}>{ret.rmaNumber}</TableCell>
                          <TableCell onClick={() => setSelectedReturn(ret)}>{ret.client.clientName}</TableCell>
                          <TableCell onClick={() => setSelectedReturn(ret)}>{ret.issuanceNumber}</TableCell>
                          <TableCell onClick={() => setSelectedReturn(ret)}>{formatDate(ret.dateInitiated)}</TableCell>
                          <TableCell onClick={() => setSelectedReturn(ret)}><Badge variant={inboundStatusVariant[ret.status]}>{ret.status}</Badge></TableCell>
                          <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => setSelectedReturn(ret)}>View Details</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDeleteClick(ret.id)} className="text-destructive">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">No inbound returns found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="outbound">
            <Card>
              <CardHeader>
                <CardTitle>Outbound Returns</CardTitle>
                <CardDescription>A log of all returns to suppliers.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>RTS #</TableHead>
                              <TableHead>Supplier</TableHead>
                              <TableHead>PO #</TableHead>
                              <TableHead>Date Initiated</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                           {loading ? (
                              Array.from({ length: 8 }).map((_, i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                  <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                                </TableRow>
                              ))
                            ) : outboundReturns.length > 0 ? (
                              outboundReturns.map((ret) => (
                                <TableRow key={ret.id} onClick={() => setSelectedOutboundReturn(ret)} className="cursor-pointer">
                                  <TableCell className="font-medium">{ret.rtsNumber}</TableCell>
                                  <TableCell>{ret.supplier.name}</TableCell>
                                  <TableCell>{ret.poNumber}</TableCell>
                                  <TableCell>{formatDate(ret.dateInitiated)}</TableCell>
                                  <TableCell><Badge variant={outboundStatusVariant[ret.status]}>{ret.status}</Badge></TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="outline" size="sm">View Details</Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No outbound returns found.</TableCell>
                              </TableRow>
                            )}
                      </TableBody>
                  </Table>
              </CardContent>
            </Card>
          </TabsContent>
      </Tabs>

      
      {selectedReturn && (
        <Dialog open={!!selectedReturn} onOpenChange={(open) => !open && setSelectedReturn(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return Details: {selectedReturn.rmaNumber}</DialogTitle>
              <DialogDescription>
                From Issuance: {selectedReturn.issuanceNumber} for {selectedReturn.client.clientName}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <strong>Reason for Return:</strong>
                <p className="text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">{selectedReturn.reason}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Items being returned:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedReturn.items.map(item => (
                    <li key={item.productId}>{item.quantity} x {item.name} ({item.sku})</li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
                <Button 
                    variant="destructive" 
                    onClick={() => handleProcessReturn(selectedReturn.id, "Cancelled")}
                    disabled={selectedReturn.status !== 'Pending'}
                >
                    Cancel Return
                </Button>
              <div className="flex gap-2">
                 {selectedReturn.status === 'Pending' && (
                    <Button 
                        variant="outline"
                        onClick={() => handleProcessReturn(selectedReturn.id, "Received")}
                    >
                        Mark as Received
                    </Button>
                 )}
                <Button 
                    onClick={() => handleInspectClick(selectedReturn.id)}
                    disabled={selectedReturn.status !== 'Received'}
                >
                    Inspect Items
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedOutboundReturn && (
        <Dialog open={!!selectedOutboundReturn} onOpenChange={(open) => !open && setSelectedOutboundReturn(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Outbound Return: {selectedOutboundReturn.rtsNumber}</DialogTitle>
              <DialogDescription>
                To Supplier: {selectedOutboundReturn.supplier.name} for PO: {selectedOutboundReturn.poNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <strong>Reason for Return:</strong>
                <p className="text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">{selectedOutboundReturn.reason}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Items being returned:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {selectedOutboundReturn.items.map(item => (
                    <li key={item.productId}>{item.quantity} x {item.name} ({item.sku})</li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setSelectedOutboundReturn(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this
                return record. This action does not affect inventory.
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
    </div>
  );
}
