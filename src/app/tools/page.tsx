
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ToolManagementPage() {
  // Placeholder data - this will be replaced with data from your database
  const tools = [
    { id: "1", name: "Drill", status: "Available", condition: "Good" },
    { id: "2", name: "Grinder", status: "In Use", condition: "Good", borrowedBy: "John Doe", dateBorrowed: "2023-10-26" },
    { id: "3", name: "Welding Machine", status: "Available", condition: "Needs Repair" },
    { id: "4", name: "Ladder", status: "Available", condition: "Good" },
    { id: "5", name: "Generator", status: "In Use", condition: "Good", borrowedBy: "Jane Smith", dateBorrowed: "2023-10-25" },
  ];

  const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
    "Available": "default",
    "In Use": "secondary",
    "Needs Repair": "destructive",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Management</CardTitle>
        <CardDescription>Track all tools, their status, and who is accountable for them.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Accountability</TableHead>
              <TableHead>Date Borrowed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map((tool) => (
              <TableRow key={tool.id}>
                <TableCell className="font-medium">{tool.name}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[tool.status]}>{tool.status}</Badge>
                </TableCell>
                <TableCell>{tool.condition}</TableCell>
                <TableCell>{tool.borrowedBy || 'N/A'}</TableCell>
                <TableCell>{tool.dateBorrowed || 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
