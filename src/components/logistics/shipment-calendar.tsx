
"use client";

import { useState, useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Shipment, PurchaseOrder } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp } from "lucide-react";

interface ShipmentCalendarProps {
  shipments: Shipment[];
  purchaseOrders: PurchaseOrder[];
  onShipmentSelect: (shipment: Shipment) => void;
  onPurchaseOrderSelect: (po: PurchaseOrder) => void;
}

const outboundStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
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
};

export function ShipmentCalendar({ shipments, purchaseOrders, onShipmentSelect, onPurchaseOrderSelect }: ShipmentCalendarProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const { outboundDates, inboundDates } = useMemo(() => {
    const outbound = shipments.map(s => s.estimatedDeliveryDate).filter(Boolean) as Date[];
    const inbound = purchaseOrders.map(po => po.expectedDate).filter(Boolean) as Date[];
    return { outboundDates: outbound, inboundDates: inbound };
  }, [shipments, purchaseOrders]);

  const shipmentsForSelectedDate = useMemo(() => {
    if (!date) return [];
    return shipments.filter(s => s.estimatedDeliveryDate && isSameDay(s.estimatedDeliveryDate, date));
  }, [shipments, date]);

  const posForSelectedDate = useMemo(() => {
    if (!date) return [];
    return purchaseOrders.filter(po => po.expectedDate && isSameDay(po.expectedDate, date));
  }, [purchaseOrders, date]);


  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          modifiers={{ outbound: outboundDates, inbound: inboundDates }}
          modifiersClassNames={{
            outbound: 'border-primary',
            inbound: 'border-destructive',
          }}
           modifiersStyles={{
            outbound: { 
              border: "2px solid hsl(var(--chart-1))",
              borderRadius: 'var(--radius)',
            },
             inbound: { 
              border: "2px solid hsl(var(--chart-2))",
              borderRadius: 'var(--radius)',
            },
          }}
          className="rounded-md border"
        />
        <div className="flex justify-center gap-4 mt-2 text-sm">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]"></div>
                <span>Outbound</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]"></div>
                <span>Inbound</span>
            </div>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {date ? `Schedule for ${format(date, "PPP")}` : "Select a date"}
          </CardTitle>
          <CardDescription>
            {shipmentsForSelectedDate.length + posForSelectedDate.length > 0
              ? `${shipmentsForSelectedDate.length} outbound and ${posForSelectedDate.length} inbound item(s) scheduled.`
              : "No activity scheduled for this date."}
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto">
          <div className="space-y-4">
             {shipmentsForSelectedDate.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2 text-sm"><ArrowUp className="w-4 h-4 text-muted-foreground"/> Outbound Deliveries</h4>
                    {shipmentsForSelectedDate.map(shipment => (
                    <div 
                        key={shipment.id}
                        className="p-3 rounded-md border bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={() => onShipmentSelect(shipment)}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold">{shipment.issuance.client.clientName}</p>
                                <p className="text-sm text-muted-foreground">{shipment.shipmentNumber}</p>
                            </div>
                            <Badge variant={outboundStatusVariant[shipment.status]}>{shipment.status}</Badge>
                        </div>
                    </div>
                    ))}
                </div>
            )}
            {posForSelectedDate.length > 0 && (
                 <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2 text-sm"><ArrowDown className="w-4 h-4 text-muted-foreground"/> Inbound Arrivals</h4>
                    {posForSelectedDate.map(po => (
                    <div 
                        key={po.id}
                        className="p-3 rounded-md border bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={() => onPurchaseOrderSelect(po)}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold">{po.supplier.name}</p>
                                <p className="text-sm text-muted-foreground">{po.poNumber}</p>
                            </div>
                            <Badge variant={inboundStatusVariant[po.status]}>{po.status}</Badge>
                        </div>
                    </div>
                    ))}
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    