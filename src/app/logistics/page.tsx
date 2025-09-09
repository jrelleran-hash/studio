
"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getShipments, updateShipmentStatus } from "@/services/data-service";
import { useData } from "@/context/data-context";
import type { Shipment } from "@/types";
import { MoreHorizontal, Package, Truck, CheckCircle, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/analytics/kpi-card";


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Delivered: "default",
  "In Transit": "secondary",
  Pending: "outline",
  Delayed: "destructive",
  Cancelled: "destructive",
};

type StatusFilter = "all" | Shipment['status'];

export default function LogisticsPage() {
    const { refetchData } = useData();
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const { toast } = useToast();

    const fetchShipments = async () => {
        setLoading(true);
        try {
            const fetchedShipments = await getShipments();
            setShipments(fetchedShipments);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch shipments."
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShipments();
    }, [toast]);
    
    const handleStatusChange = async (shipmentId: string, status: Shipment['status']) => {
        try {
            await updateShipmentStatus(shipmentId, status);
            toast({ title: "Success", description: `Shipment marked as ${status}.` });
            await fetchShipments(); // Refetch to update list and KPIs
            await refetchData(); // Refetch global data context if needed
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update shipment status."
            });
        }
    };

    const filteredShipments = shipments.filter(shipment => 
        statusFilter === 'all' || shipment.status === statusFilter
    );
    
    const kpiData = {
        total: shipments.length,
        pending: shipments.filter(s => s.status === 'Pending').length,
        inTransit: shipments.filter(s => s.status === 'In Transit').length,
        delivered: shipments.filter(s => s.status === 'Delivered').length,
    }

    const formatDate = (date?: Date) => {
        if (!date) return 'N/A';
        return format(date, 'PP');
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold font-headline tracking-tight">
                    Logistics & Shipments
                </h1>
                <p className="text-muted-foreground">
                    Track and manage all outgoing shipments.
                </p>
            </div>
            
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                title="Total Shipments"
                value={kpiData.total.toString()}
                icon={<Package className="size-5 text-muted-foreground" />}
                loading={loading}
                />
                <KpiCard
                title="Pending"
                value={kpiData.pending.toString()}
                icon={<Hourglass className="size-5 text-muted-foreground" />}
                loading={loading}
                />
                <KpiCard
                title="In Transit"
                value={kpiData.inTransit.toString()}
                icon={<Truck className="size-5 text-muted-foreground" />}
                loading={loading}
                />
                <KpiCard
                title="Delivered"
                value={kpiData.delivered.toString()}
                icon={<CheckCircle className="size-5 text-muted-foreground" />}
                loading={loading}
                />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                         <div>
                            <CardTitle>Shipment History</CardTitle>
                            <CardDescription>A log of all shipments.</CardDescription>
                         </div>
                         <div className="flex items-center gap-2">
                            {(["all", "Pending", "In Transit", "Delivered", "Delayed", "Cancelled"] as StatusFilter[]).map((filter) => (
                                <Button
                                key={filter}
                                variant={statusFilter === filter ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter(filter)}
                                className="capitalize"
                                >
                                {filter}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Shipment #</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Issuance #</TableHead>
                                <TableHead>Date Created</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Carrier</TableHead>
                                <TableHead>Est. Delivery</TableHead>
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
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredShipments.length > 0 ? (
                                filteredShipments.map((shipment) => (
                                    <TableRow key={shipment.id} onClick={() => setSelectedShipment(shipment)} className="cursor-pointer">
                                        <TableCell className="font-medium">{shipment.shipmentNumber}</TableCell>
                                        <TableCell>{shipment.issuance.client.clientName}</TableCell>
                                        <TableCell>{shipment.issuance.issuanceNumber}</TableCell>
                                        <TableCell>{formatDate(shipment.createdAt)}</TableCell>
                                        <TableCell><Badge variant={statusVariant[shipment.status]}>{shipment.status}</Badge></TableCell>
                                        <TableCell>{shipment.shippingProvider}</TableCell>
                                        <TableCell>{formatDate(shipment.estimatedDeliveryDate)}</TableCell>
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
                                                    <DropdownMenuItem onClick={() => setSelectedShipment(shipment)}>View Details</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleStatusChange(shipment.id, 'In Transit')}>Mark In Transit</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(shipment.id, 'Delivered')}>Mark Delivered</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(shipment.id, 'Delayed')}>Mark Delayed</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(shipment.id, 'Cancelled')} className="text-destructive">Cancel Shipment</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">No shipments found for this filter.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            {selectedShipment && (
                <Dialog open={!!selectedShipment} onOpenChange={(open) => !open && setSelectedShipment(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Shipment Details: {selectedShipment.shipmentNumber}</DialogTitle>
                            <DialogDescription>
                                Tracking #: {selectedShipment.trackingNumber || 'N/A'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><p><strong>Client:</strong></p><p className="text-sm text-muted-foreground">{selectedShipment.issuance.client.clientName}</p></div>
                                <div><p><strong>Address:</strong></p><p className="text-sm text-muted-foreground">{selectedShipment.issuance.client.address}</p></div>
                                <div><p><strong>Status:</strong></p><p><Badge variant={statusVariant[selectedShipment.status]}>{selectedShipment.status}</Badge></p></div>
                                <div><p><strong>Carrier:</strong></p><p className="text-sm text-muted-foreground">{selectedShipment.shippingProvider}</p></div>
                                <div><p><strong>Est. Delivery:</strong></p><p className="text-sm text-muted-foreground">{formatDate(selectedShipment.estimatedDeliveryDate)}</p></div>
                                <div><p><strong>Delivered On:</strong></p><p className="text-sm text-muted-foreground">{formatDate(selectedShipment.actualDeliveryDate)}</p></div>
                            </div>
                            <div>
                                <h4 className="font-semibold mt-2">Items:</h4>
                                <ul className="list-disc list-inside text-muted-foreground">
                                    {selectedShipment.issuance.items.map(item => (
                                    <li key={item.product.id}>{item.quantity} x {item.product.name}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedShipment(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
