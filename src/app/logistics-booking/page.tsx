
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, Calendar as CalendarIcon, Truck } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const bookingSchema = z.object({
  bookingType: z.enum(["Inbound", "Outbound"]),
  serviceType: z.enum(["Standard", "Express", "Bulk"]),
  pickupAddress: z.string().min(1, "Pickup address is required."),
  deliveryAddress: z.string().min(1, "Delivery address is required."),
  pickupDate: z.date({ required_error: "Pickup date is required." }),
  itemDescription: z.string().min(1, "Item description is required."),
  specialInstructions: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export default function LogisticsBookingPage() {
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
  });

  const onSubmit = (data: BookingFormValues) => {
    console.log(data);
    toast({
      title: "Booking Created",
      description: "Your logistics booking has been successfully created.",
    });
    setIsBookingDialogOpen(false);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline tracking-tight">
            Logistics Booking
          </h1>
          <p className="text-muted-foreground">
            Schedule new inbound or outbound shipments.
          </p>
        </div>
        <Dialog
          open={isBookingDialogOpen}
          onOpenChange={setIsBookingDialogOpen}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Logistics Booking</DialogTitle>
              <DialogDescription>
                Fill in the details to schedule a new shipment.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Booking Type</Label>
                  <Controller
                    name="bookingType"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select booking type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Inbound">Inbound</SelectItem>
                          <SelectItem value="Outbound">Outbound</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Controller
                    name="serviceType"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select service type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Standard">Standard</SelectItem>
                          <SelectItem value="Express">Express</SelectItem>
                          <SelectItem value="Bulk">Bulk</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickupAddress">Pickup Address</Label>
                  <Textarea
                    id="pickupAddress"
                    {...form.register("pickupAddress")}
                  />
                  {form.formState.errors.pickupAddress && <p className="text-sm text-destructive">{form.formState.errors.pickupAddress.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryAddress">Delivery Address</Label>
                  <Textarea
                    id="deliveryAddress"
                    {...form.register("deliveryAddress")}
                  />
                   {form.formState.errors.deliveryAddress && <p className="text-sm text-destructive">{form.formState.errors.deliveryAddress.message}</p>}
                </div>
              </div>
                <div className="space-y-2">
                    <Label>Preferred Pickup Date</Label>
                     <Controller
                        control={form.control}
                        name="pickupDate"
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
                                <CalendarIcon className="mr-2 h-4 w-4" />
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
                    {form.formState.errors.pickupDate && <p className="text-sm text-destructive">{form.formState.errors.pickupDate.message}</p>}
                </div>

              <div className="space-y-2">
                <Label htmlFor="itemDescription">Item Description</Label>
                <Textarea
                  id="itemDescription"
                  placeholder="e.g., 2 boxes of construction materials, 50kg total"
                  {...form.register("itemDescription")}
                />
                 {form.formState.errors.itemDescription && <p className="text-sm text-destructive">{form.formState.errors.itemDescription.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialInstructions">Special Instructions</Label>
                <Textarea
                  id="specialInstructions"
                  placeholder="e.g., Handle with care, contact person on site is..."
                  {...form.register("specialInstructions")}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBookingDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Booking</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Bookings</CardTitle>
          <CardDescription>
            A list of all your scheduled bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        No bookings created yet.
                    </TableCell>
                </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
