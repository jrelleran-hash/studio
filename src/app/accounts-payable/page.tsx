
"use client";

import { useState, useMemo } from "react";
import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseOrder } from "@/types";
import { payPurchaseOrder } from "@/services/data-service";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { Banknote, CheckCircle } from "lucide-react";
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

const paymentStatusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
    Paid: "default",
    Unpaid: "secondary",
};

export default function AccountsPayablePage() {
    const { purchaseOrders, loading, refetchData } = useData();
    const { toast } = useToast();
    const [payingPO, setPayingPO] = useState<PurchaseOrder | null>(null);

    const unpaidPurchaseOrders = useMemo(() => {
        return purchaseOrders.filter(po => po.status === 'Completed' && po.paymentStatus === 'Unpaid');
    }, [purchaseOrders]);

    const handlePayConfirm = async () => {
        if (!payingPO) return;

        try {
            await payPurchaseOrder(payingPO.id, payingPO.total);
            toast({
                title: "Payment Recorded",
                description: `Purchase order ${payingPO.poNumber} has been marked as paid.`,
            });
            await refetchData();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to record payment.";
            toast({
                variant: "destructive",
                title: "Error",
                description: errorMessage,
            });
        } finally {
            setPayingPO(null);
        }
    };

    const formatDate = (date?: Date) => {
        if (!date) return 'N/A';
        return format(date, 'PPP');
    };

    return (
        <>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold font-headline tracking-tight">Accounts Payable</h1>
                    <p className="text-muted-foreground">Manage and record payments for outstanding purchase orders.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Bills to Pay</CardTitle>
                        <CardDescription>
                            These are completed purchase orders awaiting payment to suppliers.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Date Received</TableHead>
                                    <TableHead>Amount Due</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : unpaidPurchaseOrders.length > 0 ? (
                                    unpaidPurchaseOrders.map((po) => (
                                        <TableRow key={po.id}>
                                            <TableCell className="font-medium">{po.poNumber}</TableCell>
                                            <TableCell>{po.supplier.name}</TableCell>
                                            <TableCell>{formatDate(po.receivedDate)}</TableCell>
                                            <TableCell>{formatCurrency(po.total)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => setPayingPO(po)}>
                                                    <Banknote className="mr-2 h-4 w-4" />
                                                    Record Payment
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No outstanding bills.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={!!payingPO} onOpenChange={(open) => !open && setPayingPO(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to mark purchase order{" "}
                            <strong>{payingPO?.poNumber}</strong> for{" "}
                            <strong>{formatCurrency(payingPO?.total || 0)}</strong> as paid?
                            This will create corresponding entries in the General Ledger.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePayConfirm}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Confirm Payment
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
