
"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";

import { useData } from "@/context/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { JobOrder } from "@/types";

const jobStatusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  Pending: "secondary",
  "In Progress": "outline",
  Completed: "default",
  "QC Passed": "default",
  Dispatched: "default",
};

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
                        </TableRow>
                    ))
                ) : jobOrders.length > 0 ? (
                    jobOrders.map(job => (
                        <TableRow key={job.id}>
                            <TableCell>{job.jobOrderNumber}</TableCell>
                            <TableCell>{job.projectName}</TableCell>
                            <TableCell>{job.assignedToName || 'Unassigned'}</TableCell>
                            <TableCell>{format(job.date.toDate(), 'PP')}</TableCell>
                            <TableCell><Badge variant={jobStatusVariant[job.status] || 'default'}>{job.status}</Badge></TableCell>
                        </TableRow>
                    ))
                ) : (
                     <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
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

    