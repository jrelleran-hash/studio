
"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";

import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { JobOrder, JobOrderItem } from "@/types";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const jobStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Pending: "secondary",
  "In Progress": "outline",
  Completed: "default",
  "QC Passed": "default",
  Dispatched: "default",
};

const itemStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Pending: "secondary",
  "In Progress": "outline",
  Completed: "default",
  "QC Passed": "default",
  Dispatched: "default",
};

const JobOrderRow = ({ job }: { job: JobOrder }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <>
            <TableRow>
                <TableCell className="font-medium">{job.jobOrderNumber}</TableCell>
                <TableCell>{job.projectName}</TableCell>
                <TableCell>{job.assignedToName || 'Unassigned'}</TableCell>
                <TableCell>{format(job.date.toDate(), 'PP')}</TableCell>
                <TableCell>
                    <Badge variant={jobStatusVariant[job.status] || 'default'}>{job.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setIsOpen(!isOpen)}>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                        <span className="sr-only">Toggle Details</span>
                    </Button>
                </TableCell>
            </TableRow>
            {isOpen && (
                <TableRow className="bg-muted/50">
                    <TableCell colSpan={6} className="p-0">
                        <div className="p-4">
                            <h4 className="text-sm font-semibold mb-2">Items for Job Order {job.jobOrderNumber}:</h4>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Quantity</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {job.items.map((item, index) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{(item.productRef as any)?.name || 'Loading...'}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>
                                                <Badge variant={itemStatusVariant[item.status] || 'default'}>{item.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}

export default function FabricationPage() {
  const { jobOrders, loading } = useData();

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Fabrication Jobs</h1>
        <p className="text-muted-foreground">Monitor the status of all ongoing and pending fabrication jobs.</p>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Job Order List</CardTitle>
          <CardDescription>A log of all fabrication jobs created from material requisitions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Order #</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Details</TableHead>
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
                            <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
                        </TableRow>
                    ))
                ) : jobOrders.length > 0 ? (
                    jobOrders.map(job => (
                        <JobOrderRow key={job.id} job={job} />
                    ))
                ) : (
                     <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            No fabrication jobs found.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
