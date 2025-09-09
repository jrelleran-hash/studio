
"use client";

import { useState, useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Shipment } from "@/types";
import { Badge } from "@/components/ui/badge";

interface ShipmentCalendarProps {
  shipments: Shipment[];
  onShipmentSelect: (shipment: Shipment) => void;
}

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Delivered: "default",
  "In Transit": "secondary",
  Pending: "outline",
  Delayed: "destructive",
  Cancelled: "destructive",
};

export function ShipmentCalendar({ shipments, onShipmentSelect }: ShipmentCalendarProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const shipmentDates = useMemo(() => {
    return shipments.map(s => s.estimatedDeliveryDate).filter(Boolean) as Date[];
  }, [shipments]);

  const shipmentsForSelectedDate = useMemo(() => {
    if (!date) return [];
    return shipments.filter(s => s.estimatedDeliveryDate && isSameDay(s.estimatedDeliveryDate, date));
  }, [shipments, date]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          modifiers={{ highlighted: shipmentDates }}
          modifiersStyles={{
            highlighted: { 
              border: "2px solid hsl(var(--primary))",
              borderRadius: 'var(--radius)',
            },
          }}
          className="rounded-md border"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {date ? `Shipments for ${format(date, "PPP")}` : "Select a date"}
          </CardTitle>
          <CardDescription>
            {shipmentsForSelectedDate.length > 0
              ? `${shipmentsForSelectedDate.length} shipment(s) scheduled.`
              : "No shipments scheduled for this date."}
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto">
          <div className="space-y-4">
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
                    <Badge variant={statusVariant[shipment.status]}>{shipment.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
