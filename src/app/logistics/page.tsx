
"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays } from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { updateShipmentStatus, addShipment, updatePurchaseOrderStatus } from "@/services/data-service";
import { useData } from "@/context/data-context";
import type { Shipment, Issuance, PurchaseOrder, Return, OutboundReturn } from "@/types";
import { MoreHorizontal, Package, Truck, CheckCircle, Hourglass, CalendarDays, List, PlusCircle, ArrowDown, ArrowUp, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ShipmentCalendar } from "@/components/logistics/shipment-calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const outboudStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Delivered: "default",
  "In Transit": "secondary",
  Pending: "outline",
  Delayed: "destructive",
  Cancelled: "destructive",
};

const inboundStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Pending: "secondary",
  Received: "default",
  Shipped: "outline",
  Restocked: "default",
  Completed: "default",
};

const outboundReturnStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Pending: "secondary",
  Shipped: "outline",
  Completed: "default",
  Cancelled: "destructive",
};


const createShipmentSchema = z.object({
    issuanceId: z.string().min(1, "An issuance must be selected"),
    shippingProvider: z.string().min(1, "Shipping provider is required"),
    trackingNumber: z.string().optional(),
    estimatedDeliveryDate: z.date({
        required_error: "An estimated delivery date is required.",
    }),
});

type ShipmentFormValues = z.infer<typeof createShipmentSchema>;


type ShipmentStatusFilter = "all" | Shipment['status'];
type POReturnStatusFilter = "all" | PurchaseOrder['status'];
type OutboundReturnStatusFilter = "all" | OutboundReturn['status'];
type InboundReturnStatusFilter = "all" | Return['status'];
type ViewMode = "list" | "calendar";

export default function LogisticsPage() {
    const { shipments, purchaseOrders, unshippedIssuances, returns, outboundReturns, loading, refetchData } = useData();
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [selectedOutboundReturn, setSelectedOutboundReturn] = useState<OutboundReturn | null>(null);
    
    // Filter states
    const [shipmentStatusFilter, setShipmentStatusFilter] = useState<ShipmentStatusFilter>("all");
    const [poStatusFilter, setPoStatusFilter] = useState<POReturnStatusFilter>("all");
    const [outboundReturnStatusFilter, setOutboundReturnStatusFilter] = useState<OutboundReturnStatusFilter>("all");
    const [inboundReturnStatusFilter, setInboundReturnStatusFilter] = useState<InboundReturnStatusFilter>("all");

    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("outbound");
    const { toast } = useToast();

     const shipmentForm = useForm<ShipmentFormValues>({
        resolver: zodResolver(createShipmentSchema),
        defaultValues: {
            issuanceId: "",
            shippingProvider: "",
            trackingNumber: "",
            estimatedDeliveryDate: addDays(new Date(), 7),
        },
    });

    useEffect(() => {
        if (!isCreateShipmentOpen) {
            shipmentForm.reset();
        }
    }, [isCreateShipmentOpen, shipmentForm]);

    const handleStatusChange = async (shipmentId: string, status: Shipment['status']) => {
        try {
            await updateShipmentStatus(shipmentId, status);
            toast({ title: "Success", description: `Shipment marked as ${status}.` });
            await refetchData();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update shipment status."
            });
        }
    };
    
    const handlePOStatusChange = async (poId: string, status: PurchaseOrder['status']) => {
        try {
          await updatePurchaseOrderStatus(poId, status);
          toast({ title: "Success", description: `Purchase Order marked as ${status}.` });
          await refetchData();
        } catch (error) {
          console.error(error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update purchase order status.",
          });
        }
    };

    const onShipmentSubmit = async (data: ShipmentFormValues) => {
        try {
          await addShipment(data);
          toast({ title: "Success", description: "New shipment created successfully." });
          setIsCreateShipmentOpen(false);
          await refetchData();
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({
                variant: "destructive",
                title: "Error",
                description: errorMessage,
            });
        }
    };

    const filteredShipments = useMemo(() => shipments.filter(shipment => 
        shipmentStatusFilter === 'all' || shipment.status === shipmentStatusFilter
    ), [shipments, shipmentStatusFilter]);

    const filteredPurchaseOrders = useMemo(() => purchaseOrders.filter(po =>
        poStatusFilter === 'all' || po.status === poStatusFilter
    ), [purchaseOrders, poStatusFilter]);

    const filteredOutboundReturns = useMemo(() => outboundReturns.filter(ret =>
        outboundReturnStatusFilter === 'all' || ret.status === outboundReturnStatusFilter
    ), [outboundReturns, outboundReturnStatusFilter]);

    const filteredInboundReturns = useMemo(() => returns.filter(ret =>
        inboundReturnStatusFilter === 'all' || ret.status === inboundReturnStatusFilter
    ), [returns, inboundReturnStatusFilter]);
    
    const kpiData = {
        totalOutbound: shipments.length + outboundReturns.length,
        inTransit: shipments.filter(s => s.status === 'In Transit').length,
        delivered: shipments.filter(s => s.status === 'Delivered').length,
        totalInbound: purchaseOrders.length + returns.length,
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
                    Track and manage all inbound and outbound shipments.
                </p>
            </div>
            
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Outbound Movements"
                    value={kpiData.totalOutbound.toString()}
                    icon={<ArrowUp className="size-5 text-muted-foreground" />}
                    loading={loading}
                />
                 <KpiCard
                    title="Inbound Movements"
                    value={kpiData.totalInbound.toString()}
                    icon={<ArrowDown className="size-5 text-muted-foreground" />}
                    loading={loading}
                />
                <KpiCard
                    title="In Transit"
                    value={kpiData.inTransit.toString()}
                    icon={<Truck className="size-5 text-muted-foreground" />}
                    loading={loading}
                />
                <KpiCard
                    title="Delivered / Received"
                    value={kpiData.delivered.toString()}
                    icon={<CheckCircle className="size-5 text-muted-foreground" />}
                    loading={loading}
                />
            </div>
            
             <div className="flex items-center justify-between">
                <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                      <TabsTrigger value="outbound">Outbound</TabsTrigger>
                      <TabsTrigger value="inbound">Inbound</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2">
                    <Button variant={viewMode === 'list' ? 'secondary' : 'outline'} size="sm" onClick={() => setViewMode('list')}><List className="mr-2 h-4 w-4" />List</Button>
                    <Button variant={viewMode === 'calendar' ? 'secondary' : 'outline'} size="sm" onClick={() => setViewMode('calendar')}><CalendarDays className="mr-2 h-4 w-4" />Calendar</Button>
                </div>
            </div>

            {viewMode === 'list' ? (
             <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="outbound">
                    <Tabs defaultValue="deliveries">
                        <TabsList className="mb-4">
                            <TabsTrigger value="deliveries">Site Deliveries</TabsTrigger>
                            <TabsTrigger value="returns">Returns to Supplier</TabsTrigger>
                        </TabsList>
                        <TabsContent value="deliveries">
                            <Card>
                                <CardHeader>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <CardTitle>Site Deliveries</CardTitle>
                                            <CardDescription>A log of all shipments to clients.</CardDescription>
                                        </div>
                                        <Dialog open={isCreateShipmentOpen} onOpenChange={setIsCreateShipmentOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="gap-1">
                                                <PlusCircle className="h-4 w-4" />
                                                Create Shipment
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Create Shipment</DialogTitle>
                                                <DialogDescription>
                                                    Select an issuance to create a new shipment.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <form onSubmit={shipmentForm.handleSubmit(onShipmentSubmit)} className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="issuanceId">Issuance to Ship</Label>
                                                    <Controller
                                                        control={shipmentForm.control}
                                                        name="issuanceId"
                                                        render={({ field }) => (
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select an issuance..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {unshippedIssuances.map(iss => (
                                                                        <SelectItem key={iss.id} value={iss.id}>
                                                                            {iss.issuanceNumber} - {iss.client.clientName}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    />
                                                    {shipmentForm.formState.errors.issuanceId && <p className="text-sm text-destructive">{shipmentForm.formState.errors.issuanceId.message}</p>}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="shippingProvider">Shipping Provider</Label>
                                                    <Input id="shippingProvider" {...shipmentForm.register("shippingProvider")} />
                                                    {shipmentForm.formState.errors.shippingProvider && <p className="text-sm text-destructive">{shipmentForm.formState.errors.shippingProvider.message}</p>}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="trackingNumber">Tracking Number (Optional)</Label>
                                                    <Input id="trackingNumber" {...shipmentForm.register("trackingNumber")} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Estimated Delivery Date</Label>
                                                    <Controller
                                                        control={shipmentForm.control}
                                                        name="estimatedDeliveryDate"
                                                        render={({ field }) => (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full justify-start text-left font-normal",
                                                                    !field.value && "text-muted-foreground"
                                                                )}
                                                                >
                                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0">
                                                                <Calendar
                                                                mode="single"
                                                                selected={field.value}
                                                                onSelect={field.onChange}
                                                                initialFocus
                                                                />
                                                            </PopoverContent>
                                                            </Popover>
                                                        )}
                                                    />
                                                    {shipmentForm.formState.errors.estimatedDeliveryDate && <p className="text-sm text-destructive">{shipmentForm.formState.errors.estimatedDeliveryDate.message}</p>}
                                                </div>
                                                <DialogFooter>
                                                    <Button type="button" variant="outline" onClick={() => setIsCreateShipmentOpen(false)}>Cancel</Button>
                                                    <Button type="submit" disabled={shipmentForm.formState.isSubmitting}>
                                                        {shipmentForm.formState.isSubmitting ? "Creating..." : "Create Shipment"}
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                        <div className="flex items-center gap-2 mb-4">
                                            {(["all", "Pending", "In Transit", "Delivered", "Delayed", "Cancelled"] as ShipmentStatusFilter[]).map((filter) => (
                                                <Button
                                                key={filter}
                                                variant={shipmentStatusFilter === filter ? "secondary" : "outline"}
                                                size="sm"
                                                onClick={() => setShipmentStatusFilter(filter)}
                                                className="capitalize"
                                                >
                                                {filter}
                                                </Button>
                                            ))}
                                        </div>
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
                                                            <TableCell><Badge variant={outboudStatusVariant[shipment.status]}>{shipment.status}</Badge></TableCell>
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
                        </TabsContent>
                         <TabsContent value="returns">
                           <Card>
                                <CardHeader>
                                    <CardTitle>Returns to Supplier</CardTitle>
                                    <CardDescription>A log of all returns to suppliers.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2 mb-4">
                                        {(["all", "Pending", "Shipped", "Completed", "Cancelled"] as OutboundReturnStatusFilter[]).map((filter) => (
                                            <Button
                                            key={filter}
                                            variant={outboundReturnStatusFilter === filter ? "secondary" : "outline"}
                                            size="sm"
                                            onClick={() => setOutboundReturnStatusFilter(filter)}
                                            className="capitalize"
                                            >
                                            {filter}
                                            </Button>
                                        ))}
                                    </div>
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
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : filteredOutboundReturns.length > 0 ? (
                                                filteredOutboundReturns.map((ret) => (
                                                    <TableRow key={ret.id} onClick={() => setSelectedOutboundReturn(ret)} className="cursor-pointer">
                                                        <TableCell className="font-medium">{ret.rtsNumber}</TableCell>
                                                        <TableCell>{ret.supplier.name}</TableCell>
                                                        <TableCell>{ret.poNumber}</TableCell>
                                                        <TableCell>{formatDate(ret.dateInitiated)}</TableCell>
                                                        <TableCell><Badge variant={outboundReturnStatusVariant[ret.status]}>{ret.status}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                           <Button variant="outline" size="sm">View</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center">No outbound returns found for this filter.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
                <TabsContent value="inbound">
                    <Tabs defaultValue="po">
                        <TabsList className="mb-4">
                            <TabsTrigger value="po">Purchase Orders</TabsTrigger>
                            <TabsTrigger value="returns">Returns from Client</TabsTrigger>
                        </TabsList>
                        <TabsContent value="po">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Inbound Shipments (POs)</CardTitle>
                                    <CardDescription>A log of all purchase orders from suppliers.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2 mb-4">
                                        {(["all", "Pending", "Shipped", "Received"] as POReturnStatusFilter[]).map((filter) => (
                                            <Button
                                            key={filter}
                                            variant={poStatusFilter === filter ? "secondary" : "outline"}
                                            size="sm"
                                            onClick={() => setPoStatusFilter(filter)}
                                            className="capitalize"
                                            >
                                            {filter}
                                            </Button>
                                        ))}
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>PO Number</TableHead>
                                                <TableHead>Supplier</TableHead>
                                                <TableHead>Order Date</TableHead>
                                                <TableHead>Expected Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : filteredPurchaseOrders.length > 0 ? (
                                                filteredPurchaseOrders.map((po) => (
                                                    <TableRow key={po.id} onClick={() => setSelectedPO(po)} className="cursor-pointer">
                                                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                                                        <TableCell>{po.supplier.name}</TableCell>
                                                        <TableCell>{formatDate(po.orderDate)}</TableCell>
                                                        <TableCell>{formatDate(po.expectedDate)}</TableCell>
                                                        <TableCell><Badge variant={inboundStatusVariant[po.status]}>{po.status}</Badge></TableCell>
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
                                                                    <DropdownMenuItem onClick={() => setSelectedPO(po)}>View Details</DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    {po.status === 'Pending' && (
                                                                        <DropdownMenuItem onClick={() => handlePOStatusChange(po.id, 'Shipped')}>Mark as Shipped</DropdownMenuItem>
                                                                    )}
                                                                    {po.status === 'Shipped' && (
                                                                        <DropdownMenuItem onClick={() => handlePOStatusChange(po.id, 'Received')}>Mark as Received</DropdownMenuItem>
                                                                    )}
                                                                    {po.status === 'Received' && <DropdownMenuItem disabled>Order Received</DropdownMenuItem>}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center">No purchase orders found for this filter.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="returns">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Inbound Returns from Client</CardTitle>
                                    <CardDescription>A log of all customer returns.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2 mb-4">
                                        {(["all", "Pending", "Received", "Completed", "Cancelled"] as InboundReturnStatusFilter[]).map((filter) => (
                                            <Button
                                            key={filter}
                                            variant={inboundReturnStatusFilter === filter ? "secondary" : "outline"}
                                            size="sm"
                                            onClick={() => setInboundReturnStatusFilter(filter)}
                                            className="capitalize"
                                            >
                                            {filter}
                                            </Button>
                                        ))}
                                    </div>
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
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : filteredInboundReturns.length > 0 ? (
                                                filteredInboundReturns.map((ret) => (
                                                    <TableRow key={ret.id}>
                                                        <TableCell className="font-medium">{ret.rmaNumber}</TableCell>
                                                        <TableCell>{ret.client.clientName}</TableCell>
                                                        <TableCell>{ret.issuanceNumber}</TableCell>
                                                        <TableCell>{formatDate(ret.dateInitiated)}</TableCell>
                                                        <TableCell><Badge variant={inboundStatusVariant[ret.status]}>{ret.status}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="outline" size="sm">View</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                 <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center">No returns found for this filter.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
            ) : (
                <ShipmentCalendar shipments={shipments} purchaseOrders={purchaseOrders} onShipmentSelect={setSelectedShipment} onPurchaseOrderSelect={setSelectedPO} />
            )}
           
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
                                <div><p><strong>Status:</strong></p><p><Badge variant={outboudStatusVariant[selectedShipment.status]}>{selectedShipment.status}</Badge></p></div>
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
             {selectedPO && (
                <Dialog open={!!selectedPO} onOpenChange={(open) => !open && setSelectedPO(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Purchase Order: {selectedPO.poNumber}</DialogTitle>
                            <DialogDescription>
                                Supplier: {selectedPO.supplier.name}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <p><strong>Order Date:</strong> {format(selectedPO.orderDate, 'PPP')}</p>
                            <p><strong>Expected Date:</strong> {selectedPO.expectedDate ? format(selectedPO.expectedDate, 'PPP') : 'N/A'}</p>
                            <p><strong>Status:</strong> <Badge variant={inboundStatusVariant[selectedPO.status]}>{selectedPO.status}</Badge></p>
                            {selectedPO.receivedDate && <p><strong>Date Received:</strong> {format(selectedPO.receivedDate, 'PPP')}</p>}
                            <div>
                                <h4 className="font-semibold mt-2">Items:</h4>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
                                    {selectedPO.items.map(item => (
                                        <li key={item.product.id}>
                                            {item.quantity} x {item.product.name} ({item.product.sku})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedPO(null)}>Close</Button>
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
        </div>
    );
}
